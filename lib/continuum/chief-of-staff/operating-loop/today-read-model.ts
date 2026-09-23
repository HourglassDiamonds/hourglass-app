/**
 * In-process Today read model.
 * An unchanged watermark reuses the composed loop.
 * A changed watermark still returns that last composed loop for display and
 * recomposes in the background. This does not write, and it does not call
 * Gmail or a model.
 */

import type { CosOperatingLoopView } from "./types";

export const TODAY_READ_MODEL_TTL_MS = 60_000;

type TodayReadModelSlot = {
  watermark: string;
  cachedAtMs: number;
  loop: CosOperatingLoopView;
};

let slot: TodayReadModelSlot | null = null;
let recomputeInFlight: Promise<void> | null = null;
let suppressedWatermark: string | null = null;
let suppressedUntilMs = 0;

export const TODAY_RECOMPUTE_SUPPRESS_MS = 30_000;

export type TodayNavigationChoice = "current" | "refreshing" | "cold";

/**
 * Warm exact hit stays on the fast path.
 * Any older composed loop is shown immediately while a rebuild runs.
 * Cold means this process has never composed Today.
 */
export function chooseTodayNavigation(input: {
  exactHit: boolean;
  hasLastKnown: boolean;
}): TodayNavigationChoice {
  if (input.exactHit) return "current";
  if (input.hasLastKnown) return "refreshing";
  return "cold";
}

export function readLastKnownTodayLoop(): TodayReadModelSlot | null {
  return slot;
}

export function todayRecomputeInFlight(): boolean {
  return recomputeInFlight !== null;
}

export function waitForTodayRecompute(): Promise<void> {
  return recomputeInFlight ?? Promise.resolve();
}

export function shouldScheduleTodayRecompute(watermark: string, nowMs: number): boolean {
  if (recomputeInFlight) return false;
  if (suppressedWatermark === watermark && nowMs < suppressedUntilMs) return false;
  return true;
}

export function beginTodayRecompute(watermark: string, run: () => Promise<void>): boolean {
  if (recomputeInFlight) return false;
  const flight = run()
    .then(() => {
      suppressedWatermark = null;
      suppressedUntilMs = 0;
    })
    .catch(() => {
      suppressedWatermark = watermark;
      suppressedUntilMs = Date.now() + TODAY_RECOMPUTE_SUPPRESS_MS;
    })
    .finally(() => {
      if (recomputeInFlight === flight) recomputeInFlight = null;
    });
  recomputeInFlight = flight;
  return true;
}

export function readCachedTodayLoop(
  watermark: string,
  nowMs: number,
): CosOperatingLoopView | null {
  if (!slot) return null;
  if (slot.watermark !== watermark) return null;
  if (nowMs - slot.cachedAtMs > TODAY_READ_MODEL_TTL_MS) return null;
  return slot.loop;
}

export function storeCachedTodayLoop(
  watermark: string,
  nowMs: number,
  loop: CosOperatingLoopView,
): void {
  slot = { watermark, cachedAtMs: nowMs, loop };
}

export function resetTodayReadModelCache(): void {
  slot = null;
  recomputeInFlight = null;
  suppressedWatermark = null;
  suppressedUntilMs = 0;
}
