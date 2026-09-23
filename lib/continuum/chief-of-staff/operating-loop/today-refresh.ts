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
