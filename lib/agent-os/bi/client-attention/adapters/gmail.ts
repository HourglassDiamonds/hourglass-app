/**
 * Read-only Gmail adapter boundary for Client Attention.
 *
 * Existing Google OAuth (GA4/GSC) scopes are analytics.readonly + webmasters.readonly.
 * Live Client Attention Gmail requires gmail.readonly + AGENT_OS_GMAIL_USER.
 *
 * This sprint: fixture or not-configured. Never send, draft, mark-read, archive, or mutate labels.
 */

import type { ClientAttentionThresholds } from "../thresholds";
import { DEFAULT_CLIENT_ATTENTION_THRESHOLDS } from "../thresholds";
import type { GmailAdapterResult, NormalizedGmailThread } from "./types";

export const GMAIL_READ_REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "AGENT_OS_GMAIL_USER",
] as const;

export const GMAIL_READ_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

/** Scopes granted by the existing GA4/GSC OAuth helper — not sufficient for Gmail. */
export const GMAIL_EXISTING_GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
] as const;

export const GMAIL_AUTOMATION_MARKERS = [
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
  "notifications@",
  "newsletter@",
  "mailer-daemon@",
  "receipt@",
  "invoice@",
  "calendar-notification@",
  "noreply.github.com",
] as const;

export function isAutomatedGmailParticipant(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return GMAIL_AUTOMATION_MARKERS.some((marker) => lower.includes(marker));
}

export function filterBusinessRelevantThreads(
  threads: NormalizedGmailThread[],
): NormalizedGmailThread[] {
  return threads.filter(
    (t) => t.businessRelevant && !t.automated && Boolean(t.normalizedPrimaryEmail),
  );
}

export function gmailLiveReadiness(env: NodeJS.ProcessEnv = process.env): {
  ready: boolean;
  missingConfiguration: string[];
  note: string;
} {
  const missing: string[] = [];
  for (const key of GMAIL_READ_REQUIRED_ENV) {
    if (!env[key]?.trim()) missing.push(key);
  }
  missing.push(`scope:${GMAIL_READ_REQUIRED_SCOPES[0]}`);
  missing.push(
    "Existing Google OAuth does not include gmail.readonly (GA4/GSC only)",
  );

  return {
    ready: false,
    missingConfiguration: missing,
    note:
      "Gmail live metadata reads stop at the adapter boundary until gmail.readonly is granted and AGENT_OS_GMAIL_USER is set. Existing GOOGLE_* credentials (if present) are for Analytics/Search Console only.",
  };
}

export type LoadGmailOptions = {
  mode: "fixture" | "live";
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  fixtureThreads?: NormalizedGmailThread[];
  /** Force failure for resilience fixtures. */
  forceStatus?: "failed" | "not-configured" | "empty";
  /** Prefetched live snapshot — reserved for a future Gmail live fetch. */
  liveResult?: GmailAdapterResult;
};

export function loadGmailClientAttention(
  options: LoadGmailOptions,
): GmailAdapterResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const thresholds = {
    ...DEFAULT_CLIENT_ATTENTION_THRESHOLDS,
    ...options.thresholds,
  };

  if (options.forceStatus === "failed") {
    return {
      sourceType: "gmail",
      status: "failed",
      collectedAt: nowIso,
      recordCount: 0,
      threads: [],
      errorCode: "gmail_adapter_failed",
      configurationNote: "Gmail read failed; other sources may continue.",
    };
  }

  if (options.forceStatus === "not-configured") {
    const readiness = gmailLiveReadiness();
    return {
      sourceType: "gmail",
      status: "not-configured",
      collectedAt: nowIso,
      recordCount: 0,
      threads: [],
      missingConfiguration: readiness.missingConfiguration,
      configurationNote: "Forced not-configured fixture.",
    };
  }

  if (options.mode === "live") {
    if (options.liveResult) return options.liveResult;
    const readiness = gmailLiveReadiness();
    return {
      sourceType: "gmail",
      status: "not-configured",
      collectedAt: nowIso,
      recordCount: 0,
      threads: [],
      missingConfiguration: readiness.missingConfiguration,
      configurationNote: readiness.note,
    };
  }

  if (options.forceStatus === "empty") {
    return {
      sourceType: "gmail",
      status: "empty",
      collectedAt: nowIso,
      recordCount: 0,
      threads: [],
      configurationNote: "Gmail fixture returned no business-relevant threads.",
    };
  }

  const capped = (options.fixtureThreads ?? [])
    .filter((t) => !t.automated)
    .slice(0, thresholds.maxGmailThreads);

  return {
    sourceType: "gmail",
    status: capped.length ? "fixture" : "empty",
    collectedAt: nowIso,
    recordCount: capped.length,
    threads: capped,
    configurationNote: "Deterministic Gmail fixture snapshot.",
  };
}
