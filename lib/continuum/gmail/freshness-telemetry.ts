/**
 * One privacy-safe Gmail freshness cron event.
 * Allowlisted fields only. No mailbox content, tokens, or provider bodies.
 */

export const GMAIL_FRESHNESS_RUN_EVENT = "continuum.gmail_freshness.run" as const;

export const GMAIL_FRESHNESS_RUN_FIELDS = [
  "event",
  "outcome",
  "stage",
  "errorCategory",
  "durationMs",
  "messagesObservedCount",
  "messagesIndexedCount",
  "watermarkChanged",
  "catchupNeeded",
  "catchupSucceeded",
] as const;

export type GmailFreshnessRunOutcome = "success" | "failed" | "skipped";

export type GmailFreshnessRunStage =
  | "auth"
  | "connection"
  | "token_refresh"
  | "gmail_fetch"
  | "index_write"
  | "watermark"
  | "complete";

export type GmailFreshnessRunErrorCategory =
  | "unauthorized"
  | "token_refresh_failed"
  | "provider_4xx"
  | "provider_5xx"
  | "timeout"
  | "supabase_read"
  | "supabase_write"
  | "malformed_response"
  | "concurrency"
  | "unknown";

export type GmailFreshnessRunEvent = {
  event: typeof GMAIL_FRESHNESS_RUN_EVENT;
  outcome: GmailFreshnessRunOutcome;
  stage: GmailFreshnessRunStage;
  errorCategory: GmailFreshnessRunErrorCategory | null;
  durationMs: number;
  messagesObservedCount: number | null;
  messagesIndexedCount: number | null;
  watermarkChanged: boolean;
  catchupNeeded: boolean;
  catchupSucceeded: boolean;
};

const OUTCOMES = new Set<GmailFreshnessRunOutcome>(["success", "failed", "skipped"]);
const STAGES = new Set<GmailFreshnessRunStage>([
  "auth",
  "connection",
  "token_refresh",
  "gmail_fetch",
  "index_write",
  "watermark",
  "complete",
]);
const CATEGORIES = new Set<GmailFreshnessRunErrorCategory>([
  "unauthorized",
  "token_refresh_failed",
  "provider_4xx",
  "provider_5xx",
  "timeout",
  "supabase_read",
  "supabase_write",
  "malformed_response",
  "concurrency",
  "unknown",
]);

function count(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}

export function classifyGmailFreshnessRun(input: {
  safeErrorCode: string | null;
  durationMs: number;
  indexedThisCycle?: number | null;
  sourceEventsChanged?: boolean;
  morePagesRemain?: boolean;
  completed?: boolean;
  skippedAsFresh?: boolean;
}): GmailFreshnessRunEvent {
  const code = input.safeErrorCode;
  const indexed = count(input.indexedThisCycle);
  const morePages = input.morePagesRemain === true;
  const completed = input.completed === true;
  const changed = input.sourceEventsChanged === true;
  let outcome: GmailFreshnessRunOutcome = "failed";
  let stage: GmailFreshnessRunStage = "gmail_fetch";
  let errorCategory: GmailFreshnessRunErrorCategory | null = "unknown";

  if (code == null) {
    outcome = "success";
    stage = input.skippedAsFresh ? "watermark" : "complete";
    errorCategory = null;
  } else if (code === "unauthorized") {
    stage = "auth";
    errorCategory = "unauthorized";
  } else if (code === "sync-disabled") {
    outcome = "skipped";
    stage = "auth";
    errorCategory = null;
  } else if (code === "gmail-not-connected" || code === "connection-inactive" || code === "decrypt-failed") {
    stage = "connection";
  } else if (
    code === "token-refresh-failed" ||
    code === "refresh-token-rotated" ||
    code === "invalid_grant"
  ) {
    stage = "token_refresh";
    errorCategory = "token_refresh_failed";
  } else if (code === "gmail-sync-already-running") {
    outcome = "skipped";
    stage = "gmail_fetch";
    errorCategory = "concurrency";
  } else if (code === "candidate-store-unavailable") {
    stage = "index_write";
    errorCategory = "supabase_read";
  } else if (
    code === "gmail-sync-failed" ||
    code === "history-too-old" ||
    code === "gmail-history-id-missing" ||
    code === "historical-incomplete" ||
    code === "unavailable" ||
    code === "freshness_failed"
  ) {
    stage = "gmail_fetch";
  }

  const catchupNeeded = morePages || (outcome === "failed" && !completed);
  const catchupSucceeded = outcome === "success" && completed && !morePages;
  return {
    event: GMAIL_FRESHNESS_RUN_EVENT,
    outcome: OUTCOMES.has(outcome) ? outcome : "failed",
    stage: STAGES.has(stage) ? stage : "gmail_fetch",
    errorCategory: errorCategory && CATEGORIES.has(errorCategory) ? errorCategory : null,
    durationMs: count(input.durationMs) ?? 0,
    messagesObservedCount: null,
    messagesIndexedCount: indexed,
    watermarkChanged: changed,
    catchupNeeded,
    catchupSucceeded,
  };
}

export function emitGmailFreshnessRun(event: GmailFreshnessRunEvent): void {
  const line: Record<string, string | number | boolean | null> = {
    event: GMAIL_FRESHNESS_RUN_EVENT,
    outcome: OUTCOMES.has(event.outcome) ? event.outcome : "failed",
    stage: STAGES.has(event.stage) ? event.stage : "gmail_fetch",
    errorCategory:
      event.errorCategory && CATEGORIES.has(event.errorCategory) ? event.errorCategory : null,
    durationMs: count(event.durationMs) ?? 0,
    messagesObservedCount: null,
    messagesIndexedCount: count(event.messagesIndexedCount),
    watermarkChanged: event.watermarkChanged === true,
    catchupNeeded: event.catchupNeeded === true,
    catchupSucceeded: event.catchupSucceeded === true,
  };
  console.info(JSON.stringify(line));
}
