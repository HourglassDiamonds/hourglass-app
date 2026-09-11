/**
 * Near-real-time Gmail → Candidate freshness cycle.
 * Reuses incremental History API sync + intake scan. Does not mint People,
 * Projects, or Open Jobs. Does not enable Gmail push delivery or change OAuth.
 */

import type { CandidateStore } from "@/lib/continuum/candidates/types";
import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type { GmailCandidateWorld } from "./candidates/types";
import type { GmailApi } from "./adapter";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import { readGmailCurrentState } from "./current-state";
import {
  GMAIL_OPERATING_FRESHNESS_AFTER_MS,
  isGmailIndexStale,
} from "./index-freshness";
import {
  runGmailIncrementalChunk,
  type GmailIncrementalChunkResult,
} from "./incremental";
import { runGmailNewProjectIntakeScan } from "./intake-scan";
import type { GmailAccessTokenRefresh } from "./oauth";
import type { SyncClock } from "./sync";
import { GMAIL_INCREMENTAL_JOB_KEY, type GmailTokenCiphertext } from "./types";

export const CONTINUUM_GMAIL_FRESHNESS_CRON_PATH =
  "/api/cron/continuum-gmail-freshness" as const;

export const GMAIL_FRESHNESS_MAX_CHUNKS = 3 as const;
export const GMAIL_INTAKE_RETRY_WINDOW_MS = 5 * 60 * 1000;

export const GMAIL_FRESHNESS_CYCLE_RESULT_KEYS = [
  "chunksRun",
  "completed",
  "docketMayHaveChanged",
  "duplicateCount",
  "indexedThisCycle",
  "insertedCount",
  "intakeRan",
  "morePagesRemain",
  "ranIncremental",
  "safeErrorCode",
  "skippedAsFresh",
] as const;

export type GmailFreshnessCycleResult = {
  ranIncremental: boolean;
  skippedAsFresh: boolean;
  chunksRun: number;
  indexedThisCycle: number;
  morePagesRemain: boolean;
  intakeRan: boolean;
  insertedCount: number;
  duplicateCount: number;
  docketMayHaveChanged: boolean;
  completed: boolean;
  safeErrorCode: string | null;
};

export type GmailFreshnessCycleInput = {
  founderSessionOk: boolean;
  secretProtectedOk?: boolean;
  enabled: boolean;
  connections: GmailConnectionStore;
  index: GmailIndexStore;
  attachments: GmailAttachmentStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  world: GmailCandidateWorld;
  store: CandidateStore;
  nowIso: string;
  clock?: SyncClock;
  force?: boolean;
};

const FRESHNESS_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "invalid_grant",
  "gmail-sync-already-running",
  "gmail-sync-failed",
  "connection-inactive",
  "sync-disabled",
  "historical-incomplete",
  "history-too-old",
  "gmail-history-id-missing",
  "candidate-store-unavailable",
] as const;

function isFreshnessErrorCode(value: string | null): boolean {
  return (
    typeof value === "string" &&
    (FRESHNESS_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function sanitizeGmailFreshnessCycleResult(
  raw: GmailFreshnessCycleResult,
): GmailFreshnessCycleResult {
  const nonNeg = (value: number) =>
    Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  const safeErrorCode =
    typeof raw.safeErrorCode === "string" && isFreshnessErrorCode(raw.safeErrorCode)
      ? raw.safeErrorCode
      : raw.safeErrorCode
        ? "gmail-sync-failed"
        : null;
  return {
    ranIncremental: Boolean(raw.ranIncremental),
    skippedAsFresh: Boolean(raw.skippedAsFresh),
    chunksRun: nonNeg(raw.chunksRun),
    indexedThisCycle: nonNeg(raw.indexedThisCycle),
    morePagesRemain: Boolean(raw.morePagesRemain),
    intakeRan: Boolean(raw.intakeRan),
    insertedCount: nonNeg(raw.insertedCount),
    duplicateCount: nonNeg(raw.duplicateCount),
    docketMayHaveChanged: Boolean(raw.docketMayHaveChanged),
    completed: Boolean(raw.completed),
    safeErrorCode,
  };
}

export function failedGmailFreshnessCycle(
  code: string,
  extras: Partial<GmailFreshnessCycleResult> = {},
): GmailFreshnessCycleResult {
  return sanitizeGmailFreshnessCycleResult({
    ranIncremental: extras.ranIncremental ?? false,
    skippedAsFresh: extras.skippedAsFresh ?? false,
    chunksRun: extras.chunksRun ?? 0,
    indexedThisCycle: extras.indexedThisCycle ?? 0,
    morePagesRemain: extras.morePagesRemain ?? false,
    intakeRan: extras.intakeRan ?? false,
    insertedCount: extras.insertedCount ?? 0,
    duplicateCount: extras.duplicateCount ?? 0,
    docketMayHaveChanged: extras.docketMayHaveChanged ?? false,
    completed: false,
    safeErrorCode: code,
  });
}

export function shouldRunGmailOperatingFreshness(input: {
  lastSuccessfulSyncAt: string | null;
  nowIso: string;
  morePagesRemain: boolean;
  force?: boolean;
}): boolean {
  if (input.force) return true;
  if (input.morePagesRemain) return true;
  return isGmailIndexStale(
    input.lastSuccessfulSyncAt,
    input.nowIso,
    GMAIL_OPERATING_FRESHNESS_AFTER_MS,
  );
}

export function shouldRetryGmailIntake(input: {
  indexedThisCycle: number;
  newestIndexedAt: string | null;
  nowIso: string;
}): boolean {
  if (input.indexedThisCycle > 0) return true;
  if (!input.newestIndexedAt) return false;
  const age = Date.parse(input.nowIso) - Date.parse(input.newestIndexedAt);
  return Number.isFinite(age) && age >= 0 && age < GMAIL_INTAKE_RETRY_WINDOW_MS;
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function snapshotMorePages(result: GmailIncrementalChunkResult): boolean {
  return Boolean(result.morePagesRemain);
}

export async function runGmailFreshnessCycle(
  input: GmailFreshnessCycleInput,
): Promise<GmailFreshnessCycleResult> {
  if (!input.founderSessionOk && !input.secretProtectedOk) {
    return failedGmailFreshnessCycle("unauthorized");
  }
  if (!input.enabled) {
    return failedGmailFreshnessCycle("sync-disabled");
  }

  const state = await readGmailCurrentState(input.index);
  const newestIndexedAt = laterIso(
    state.latestInbound?.indexedAt ?? null,
    state.latestOutbound?.indexedAt ?? null,
  );
  const checkpoint = await input.index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY);
  const morePagesRemain = Boolean(
    checkpoint?.status === "running" && checkpoint.pageToken,
  );
  const due = shouldRunGmailOperatingFreshness({
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    nowIso: input.nowIso,
    morePagesRemain,
    force: input.force,
  });

  let chunksRun = 0;
  let indexedThisCycle = 0;
  let lastChunk: GmailIncrementalChunkResult | null = null;
  let ranIncremental = false;

  if (due) {
    ranIncremental = true;
    for (let i = 0; i < GMAIL_FRESHNESS_MAX_CHUNKS; i += 1) {
      const chunk = await runGmailIncrementalChunk({
        founderSessionOk: input.founderSessionOk,
        secretProtectedOk: input.secretProtectedOk,
        enabled: true,
        connections: input.connections,
        index: input.index,
        attachments: input.attachments,
        decryptRefreshToken: input.decryptRefreshToken,
        refreshAccessToken: input.refreshAccessToken,
        createApi: input.createApi,
        clock: input.clock,
      });
      lastChunk = chunk;
      chunksRun += 1;
      indexedThisCycle += chunk.indexedThisChunk;
      if (chunk.safeErrorCode === "gmail-sync-already-running") {
        return sanitizeGmailFreshnessCycleResult({
          ranIncremental: true,
          skippedAsFresh: false,
          chunksRun,
          indexedThisCycle,
          morePagesRemain: true,
          intakeRan: false,
          insertedCount: 0,
          duplicateCount: 0,
          docketMayHaveChanged: false,
          completed: false,
          safeErrorCode: "gmail-sync-already-running",
        });
      }
      if (!chunk.chunkSucceeded || chunk.safeErrorCode) {
        return failedGmailFreshnessCycle(chunk.safeErrorCode ?? "gmail-sync-failed", {
          ranIncremental: true,
          chunksRun,
          indexedThisCycle,
          morePagesRemain: snapshotMorePages(chunk),
        });
      }
      if (chunk.morePagesRemain) continue;
      if (chunk.initialized) continue;
      if (chunk.completed) break;
    }
  }

  const afterState = await readGmailCurrentState(input.index);
  const afterNewest = laterIso(
    afterState.latestInbound?.indexedAt ?? null,
    afterState.latestOutbound?.indexedAt ?? null,
  );
  const remaining = lastChunk
    ? snapshotMorePages(lastChunk)
    : morePagesRemain;
  const intakeDue = shouldRetryGmailIntake({
    indexedThisCycle,
    newestIndexedAt: laterIso(newestIndexedAt, afterNewest),
    nowIso: input.nowIso,
  });

  if (!intakeDue) {
    return sanitizeGmailFreshnessCycleResult({
      ranIncremental,
      skippedAsFresh: !due,
      chunksRun,
      indexedThisCycle,
      morePagesRemain: remaining,
      intakeRan: false,
      insertedCount: 0,
      duplicateCount: 0,
      docketMayHaveChanged: false,
      completed: Boolean(!remaining && (lastChunk?.completed ?? !due)),
      safeErrorCode: null,
    });
  }

  const intake = await runGmailNewProjectIntakeScan({
    founderSessionOk: input.founderSessionOk,
    secretProtectedOk: input.secretProtectedOk,
    index: input.index,
    connections: input.connections,
    decryptRefreshToken: input.decryptRefreshToken,
    refreshAccessToken: input.refreshAccessToken,
    createApi: input.createApi,
    world: input.world,
    store: input.store,
    nowIso: input.nowIso,
  });
  if (!intake.ok) {
    return failedGmailFreshnessCycle(intake.safeErrorCode, {
      ranIncremental,
      skippedAsFresh: !due,
      chunksRun,
      indexedThisCycle,
      morePagesRemain: remaining,
      intakeRan: true,
    });
  }

  return sanitizeGmailFreshnessCycleResult({
    ranIncremental,
    skippedAsFresh: !due,
    chunksRun,
    indexedThisCycle,
    morePagesRemain: remaining,
    intakeRan: true,
    insertedCount: intake.insertedIds.length,
    duplicateCount: intake.duplicateIds.length,
    docketMayHaveChanged: intake.insertedIds.length > 0,
    completed: Boolean(!remaining && (lastChunk?.completed ?? true)),
    safeErrorCode: null,
  });
}
