import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { parseGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import { isContinuumGmailOAuthConfigured } from "@/lib/continuum/gmail/env";
import { createSupabaseGmailConnectionStore } from "@/lib/continuum/gmail/server";
import { loadGmailTokenKek } from "@/lib/continuum/gmail/token-crypto";
import { CONTINUUM_TODAY_READ_MODEL_VERSION, TODAY_SNAPSHOT_KEY } from "@/lib/continuum/today-snapshot";
import { readTodaySourceWatermark } from "@/lib/continuum/today-source-watermark";
import { STERLING_TODAY_PUBLICATIONS_TABLE } from "./publication-store";
import {
  isSterlingTodayPreviewPublisherEnabled,
  isVerifiedSterlingTodayPreviewRuntime,
} from "./server-config";
import { hasSuccessfulGmailIngestionAfterAuthorization } from "./gmail-readiness";
import { loadRealClientAssociationBatch } from "./real-client-association-load";

const DAILY_EVIDENCE_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export type SterlingReadinessReport = {
  generatedAt: string;
  gmail: {
    connectionStatus: string;
    authorizationStatus: "unavailable" | "configured-unverified" | "verified-by-fresh-ingestion";
    authorizationReason: string | null;
    oauthConfigured: boolean;
    tokenCustodyConfigured: boolean;
    lastSuccessfulIngestionAt: string | null;
    checkpointAt: string | null;
    checkpointAgeHours: number | null;
    checkpointStatus: string | null;
    successfulIngestionAfterAuthorization: boolean;
    indexedMessageCount: number;
    indexedThreadCount: number;
    candidateReferencedThreadCount: number;
    indexedCandidateThreadCount: number;
    missingCandidateThreadCount: number;
    fixtureCandidateThreadCount: number;
    currentCandidateThreadCount: number;
    realClientThreadCount: number;
    trustedRealClientThreadCount: number;
    unresolvedRealClientThreadCount: number;
    associationPersistence: "available" | "missing" | "unavailable";
  };
  watermarks: {
    canonicalProjectJob: string;
    founderCorrectionCandidateReview: string;
    todaySource: string;
  };
  today: {
    status: "current" | "stale" | "missing" | "incompatible";
    readModelVersion: string | null;
    lastSuccessfulRebuildAt: string | null;
    correspondenceStatus: string | null;
  };
  sterling: {
    validationReady: boolean;
    publisherEnabled: boolean;
    publicationState: string;
    publishedAt: string | null;
    expiresAt: string | null;
    expired: boolean | null;
  };
  publishingBlockedReasons: readonly string[];
};

export type SterlingReadinessAccess =
  | { ok: true; report: SterlingReadinessReport }
  | { ok: false; reason: "not-preview" | "unauthorized" | "unavailable" };

export function isCorrespondenceReadyForCanonicalRecompute(
  report: SterlingReadinessReport,
): boolean {
  return report.gmail.authorizationStatus === "verified-by-fresh-ingestion" &&
    report.gmail.checkpointStatus === "completed" &&
    report.gmail.successfulIngestionAfterAuthorization &&
    report.gmail.associationPersistence === "available" &&
    report.gmail.unresolvedRealClientThreadCount === 0;
}

function digest(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function ageHours(value: string | null, nowMs: number): number | null {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? Math.round(((nowMs - at) / 3_600_000) * 10) / 10 : null;
}

function watermarkToken(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const token = (value as { token?: unknown }).token;
  return typeof token === "string" ? token : null;
}

export async function buildSterlingReadinessReport(
  client: SupabaseClient,
  now = new Date(),
): Promise<SterlingReadinessReport> {
  const nowMs = now.getTime();
  const [
    connection,
    checkpoints,
    associationBatch,
    candidates,
    jobs,
    projects,
    corrections,
    snapshotResult,
    publicationResult,
    todaySource,
  ] = await Promise.all([
    createSupabaseGmailConnectionStore(client).getFounderConnection(),
    client.from("continuum_gmail_checkpoints")
      .select("job_key,status,updated_at,indexed_count,history_id,error_code")
      .order("updated_at", { ascending: false }),
    loadRealClientAssociationBatch(client, now),
    client.from("continuum_candidates").select("source_system,source_ref,created_at,reviewed_at"),
    client.from("continuum_project_jobs").select("updated_at"),
    client.from("continuum_project_profiles").select("updated_at"),
    client.from("continuum_source_notes")
      .select("updated_at")
      .eq("source_system", "concierge-manual")
      .eq("lifecycle_status", "kept")
      .like("note_text", "Founder current truth v%: %"),
    client.from("continuum_today_snapshots")
      .select("read_model_version,source_watermark,payload,composed_at,updated_at")
      .eq("snapshot_key", TODAY_SNAPSHOT_KEY)
      .limit(1)
      .maybeSingle(),
    client.from(STERLING_TODAY_PUBLICATIONS_TABLE)
      .select("status,published_at,expires_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    readTodaySourceWatermark(client, now),
  ]);
  for (const result of [checkpoints, candidates, jobs, projects, corrections]) {
    if (result.error) throw result.error;
  }

  const checkpointRows = checkpoints.data ?? [];
  const successfulCheckpoints = checkpointRows.filter((row) => row.status === "completed" && !row.error_code);
  const lastSuccessfulIngestionAt = successfulCheckpoints
    .map((row) => String(row.updated_at ?? ""))
    .filter(Boolean)
    .sort()
    .at(-1) ?? connection?.lastSyncAt ?? null;
  const latestCheckpoint = checkpointRows[0] ?? null;
  const indexedThreads = new Set(associationBatch.allIndexedThreadIds);
  const currentProviderThreads = new Set(associationBatch.postAuthorizationThreadIds);
  const candidateThreads = new Set(
    (candidates.data ?? []).flatMap((row) => {
      if (row.source_system !== "gmail") return [];
      const parsed = parseGmailCandidateSourceRef(String(row.source_ref ?? ""));
      return parsed?.threadId ? [parsed.threadId] : [];
    }),
  );
  const indexedCandidateThreadCount = [...candidateThreads].filter((id) => indexedThreads.has(id)).length;
  const currentCandidateThreadCount = [...candidateThreads].filter((id) => currentProviderThreads.has(id)).length;
  const fixtureCandidateThreadCount = candidateThreads.size - currentCandidateThreadCount;
  const kek = loadGmailTokenKek();
  const oauthConfigured = isContinuumGmailOAuthConfigured();
  let authorizationReason: string | null = null;
  if (!kek.ok) authorizationReason = kek.error;
  else if (!connection) authorizationReason = "gmail-connection-missing";
  else if (connection.status !== "connected") authorizationReason = "gmail-connection-disconnected";
  else if (!connection.refreshToken) authorizationReason = "gmail-refresh-token-missing";
  else if (!oauthConfigured) authorizationReason = "oauth-not-configured";

  const snapshot = snapshotResult.error ? null : snapshotResult.data;
  const snapshotWatermark = watermarkToken(snapshot?.source_watermark);
  const snapshotVersion = snapshot?.read_model_version ? String(snapshot.read_model_version) : null;
  const todayStatus = !snapshot
    ? "missing"
    : snapshotVersion !== CONTINUUM_TODAY_READ_MODEL_VERSION
      ? "incompatible"
      : snapshotWatermark === todaySource
        ? "current"
        : "stale";
  const payload = snapshot?.payload && typeof snapshot.payload === "object"
    ? snapshot.payload as Record<string, unknown>
    : null;
  const checkpointAt = latestCheckpoint?.updated_at ? String(latestCheckpoint.updated_at) : null;
  const checkpointAgeHours = ageHours(checkpointAt, nowMs);
  const checkpointFresh = checkpointAgeHours !== null && checkpointAgeHours * 3_600_000 <= DAILY_EVIDENCE_MAX_AGE_MS;
  const successfulIngestionAfterAuthorization = hasSuccessfulGmailIngestionAfterAuthorization(
    connection?.connectedAt,
    checkpointRows.map((row) => ({
      status: row.status == null ? null : String(row.status),
      errorCode: row.error_code == null ? null : String(row.error_code),
      updatedAt: row.updated_at == null ? null : String(row.updated_at),
    })),
  );
  const coverageComplete = associationBatch.currentProviderThreadCount > 0 &&
    associationBatch.unresolvedCurrentProviderThreadCount === 0;
  const correspondenceComplete = payload?.correspondenceStatus === "complete" || payload?.correspondenceStatus === "not-required";

  const blockers: string[] = [];
  if (authorizationReason) blockers.push(`gmail:${authorizationReason}`);
  if (!checkpointFresh) blockers.push("gmail:checkpoint-older-than-36-hours");
  if (!successfulIngestionAfterAuthorization) {
    blockers.push("gmail:new-ingestion-required-after-authorization");
  }
  if (associationBatch.associationPersistence !== "available") {
    blockers.push(`gmail:association-persistence-${associationBatch.associationPersistence}`);
  }
  if (!coverageComplete) {
    blockers.push(`gmail:real-client-associations-unresolved:${associationBatch.unresolvedCurrentProviderThreadCount}`);
  }
  if (todayStatus !== "current") blockers.push(`today:read-model-${todayStatus}`);
  if (!correspondenceComplete) blockers.push("today:correspondence-incomplete");
  if (!isSterlingTodayPreviewPublisherEnabled()) blockers.push("sterling:publisher-disabled");

  const publication = publicationResult.error ? null : publicationResult.data;
  const expiresAt = publication?.expires_at ? String(publication.expires_at) : null;
  const expired = expiresAt ? Date.parse(expiresAt) <= nowMs : null;
  const validationReady = !authorizationReason && checkpointFresh && successfulIngestionAfterAuthorization && coverageComplete &&
    todayStatus === "current" && correspondenceComplete;
  return {
    generatedAt: now.toISOString(),
    gmail: {
      connectionStatus: connection?.status ?? "missing",
      authorizationStatus: authorizationReason
        ? "unavailable"
        : checkpointFresh && successfulIngestionAfterAuthorization
          ? "verified-by-fresh-ingestion"
          : "configured-unverified",
      authorizationReason,
      oauthConfigured,
      tokenCustodyConfigured: kek.ok,
      lastSuccessfulIngestionAt,
      checkpointAt,
      checkpointAgeHours,
      checkpointStatus: latestCheckpoint?.status ? String(latestCheckpoint.status) : null,
      successfulIngestionAfterAuthorization,
      indexedMessageCount: associationBatch.indexedMessageCount,
      indexedThreadCount: associationBatch.indexedThreadCount,
      candidateReferencedThreadCount: candidateThreads.size,
      indexedCandidateThreadCount,
      missingCandidateThreadCount: candidateThreads.size - indexedCandidateThreadCount,
      fixtureCandidateThreadCount,
      currentCandidateThreadCount,
      realClientThreadCount: associationBatch.currentProviderThreadCount,
      trustedRealClientThreadCount: associationBatch.trustedCurrentProviderThreadCount,
      unresolvedRealClientThreadCount: associationBatch.unresolvedCurrentProviderThreadCount,
      associationPersistence: associationBatch.associationPersistence,
    },
    watermarks: {
      canonicalProjectJob: digest([
        (jobs.data ?? []).length,
        (jobs.data ?? []).map((row) => row.updated_at).sort().at(-1) ?? null,
        (projects.data ?? []).length,
        (projects.data ?? []).map((row) => row.updated_at).sort().at(-1) ?? null,
      ]),
      founderCorrectionCandidateReview: digest([
        (corrections.data ?? []).length,
        (corrections.data ?? []).map((row) => row.updated_at).sort().at(-1) ?? null,
        (candidates.data ?? []).length,
        (candidates.data ?? []).map((row) => row.reviewed_at).filter(Boolean).sort().at(-1) ?? null,
      ]),
      todaySource: digest([todaySource]),
    },
    today: {
      status: todayStatus,
      readModelVersion: snapshotVersion,
      lastSuccessfulRebuildAt: snapshot?.composed_at ? String(snapshot.composed_at) : null,
      correspondenceStatus: typeof payload?.correspondenceStatus === "string" ? payload.correspondenceStatus : null,
    },
    sterling: {
      validationReady,
      publisherEnabled: isSterlingTodayPreviewPublisherEnabled(),
      publicationState: publication?.status ? String(publication.status) : "none",
      publishedAt: publication?.published_at ? String(publication.published_at) : null,
      expiresAt,
      expired,
    },
    publishingBlockedReasons: blockers,
  };
}

export async function getAuthenticatedSterlingReadiness(): Promise<SterlingReadinessAccess> {
  if (!isVerifiedSterlingTodayPreviewRuntime()) return { ok: false, reason: "not-preview" };
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, reason: "unavailable" };
  try {
    return { ok: true, report: await buildSterlingReadinessReport(client) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
