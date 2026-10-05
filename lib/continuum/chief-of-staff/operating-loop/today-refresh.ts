/**
 * Today foreground freshness decisions.
 * The Gmail cycle skips incremental sync inside the watermark window.
 * docketMayHaveChanged is true when a new Gmail index row landed or intake
 * inserted a candidate. A quiet tick does not refresh the server render.
 */

export function shouldPollTodayFreshness(input: {
  documentHidden: boolean;
  inFlight: boolean;
}): boolean {
  if (input.documentHidden) return false;
  if (input.inFlight) return false;
  return true;
}

/** Soft-refresh the Today server render only after a meaningful source change. */
export function shouldRefreshTodaySurface(docketMayHaveChanged: boolean): boolean {
  return docketMayHaveChanged === true;
}

export type TodaySourceHealth = "checking" | "current" | "delayed";

export const TODAY_GMAIL_SOURCE_DELAY_AFTER_MS = 3 * 60 * 1000;

export function durableTodayGmailSourceHealth(input: {
  lastSuccessfulSyncAt: string | null;
  nowIso: string;
}): TodaySourceHealth {
  if (!input.lastSuccessfulSyncAt) return "delayed";
  const last = Date.parse(input.lastSuccessfulSyncAt);
  const now = Date.parse(input.nowIso);
  if (!Number.isFinite(last) || !Number.isFinite(now)) return "delayed";
  return now - last < TODAY_GMAIL_SOURCE_DELAY_AFTER_MS ? "current" : "delayed";
}

export function todaySourceFreshnessLabel(input: {
  health: TodaySourceHealth;
  lastCheckedAt: number | null;
  nowMs: number;
}): string {
  if (input.health === "checking") return "Checking for updates…";
  if (input.health === "delayed") return "Email source delayed";
  if (input.lastCheckedAt == null) return "Updated recently";
  const seconds = Math.max(0, Math.floor((input.nowMs - input.lastCheckedAt) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)}m ago`;
}

export type TodayRecomputePollDecision = "wait" | "swap" | "keep";

/**
 * Swap the visible docket when the background composition stored a newer
 * watermark. Keep the last-known docket when the rebuild did not.
 */
export function shouldSwapTodayAfterRecompute(input: {
  baselineWatermark: string | null;
  cacheWatermark: string | null;
  pending: boolean;
  elapsedMs: number;
  observedPending: boolean;
  graceMs?: number;
}): TodayRecomputePollDecision {
  if (input.pending) return "wait";
  if (
    input.cacheWatermark &&
    input.baselineWatermark &&
    input.cacheWatermark !== input.baselineWatermark
  ) {
    return "swap";
  }
  if (input.observedPending) return "keep";
  const grace = input.graceMs ?? 20_000;
  if (input.elapsedMs >= grace) return "keep";
  return "wait";
}
