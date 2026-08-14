/**
 * Founder-attention bands for the operating backlog.
 * Management state — not inferred from title keywords or due dates.
 */

import type { OperatingBacklogItem, SurfacePolicy } from "./types";

export const SURFACE_POLICIES = [
  "founder-now",
  "watch",
  "background",
] as const satisfies readonly SurfacePolicy[];

/** Daily email Watch / No Action cap (excludes background). */
export const MAX_WATCH_EMAIL_ITEMS = 5;

/**
 * Resolve founder-attention band.
 * Explicit surfacePolicy always wins. Defaults keep historical fixtures working
 * without silently promoting deferred-work into founder-now.
 */
export function resolveSurfacePolicy(
  item: OperatingBacklogItem,
): SurfacePolicy {
  if (item.surfacePolicy) return item.surfacePolicy;
  if (item.kind === "deferred-work") return "watch";
  if (item.kind === "recurring-obligation") return "background";
  return "founder-now";
}

export function isFounderNowItem(item: OperatingBacklogItem): boolean {
  return resolveSurfacePolicy(item) === "founder-now";
}

export function isWatchItem(item: OperatingBacklogItem): boolean {
  return resolveSurfacePolicy(item) === "watch";
}

export function isBackgroundItem(item: OperatingBacklogItem): boolean {
  return resolveSurfacePolicy(item) === "background";
}

export function isNonTerminalBacklogStatus(
  status: OperatingBacklogItem["status"],
): boolean {
  return (
    status !== "completed" &&
    status !== "cancelled" &&
    status !== "replaced"
  );
}

/** Compact founder-facing Watch line. */
export function watchLineForItem(item: OperatingBacklogItem): string {
  const custom = item.watchLine?.trim();
  if (custom) return custom;
  return `${item.title} — watching`;
}
