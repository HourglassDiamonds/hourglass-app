/**
 * Read-only Gmail adapter boundary for Client Attention.
 * Live OAuth is not wired in this sprint — fixture or not-configured only.
 *
 * Required for a future live connection (document only — do not configure here):
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REFRESH_TOKEN (or a dedicated Gmail refresh token)
 * - Scope: https://www.googleapis.com/auth/gmail.readonly
 * - AGENT_OS_GMAIL_USER (mailbox address to inspect)
 *
 * Never: send, draft, mark-read, archive, or mutate labels.
 */

import type { ClientAttentionThresholds } from "../thresholds";
import { DEFAULT_CLIENT_ATTENTION_THRESHOLDS } from "../thresholds";
import type { GmailAdapterResult, NormalizedGmailThread } from "./types";

export const GMAIL_READ_REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
] as const;

export const GMAIL_READ_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
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

export type LoadGmailOptions = {
  mode: "fixture" | "live";
  nowIso?: string;
  thresholds?: Partial<ClientAttentionThresholds>;
  fixtureThreads?: NormalizedGmailThread[];
  /** Force failure for resilience fixtures. */
  forceStatus?: "failed" | "not-configured" | "empty";
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

  if (options.forceStatus === "not-configured" || options.mode === "live") {
    // Live Gmail is intentionally unavailable this sprint.
    return {
      sourceType: "gmail",
      status: "not-configured",
      collectedAt: nowIso,
      recordCount: 0,
      threads: [],
      missingConfiguration: [
        ...GMAIL_READ_REQUIRED_ENV,
        `scope:${GMAIL_READ_REQUIRED_SCOPES[0]}`,
        "AGENT_OS_GMAIL_USER",
      ],
      configurationNote:
        "Gmail read-only adapter is not live-connected. Fixture mode is available for validation.",
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
