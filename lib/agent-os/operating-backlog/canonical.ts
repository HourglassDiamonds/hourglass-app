/**
 * Stable canonical identities for operating-backlog recommendations.
 * Identity is the underlying problem, not transient title/action wording.
 */

/** Canonical problem keys used as rootProblemId across runs. */
export const OPERATING_BACKLOG_CANONICAL_IDS = {
  "sprint-concierge-cta-path": "conversion:concierge-attribution",
  "sprint-studio-consultation-clarity": "studio:concierge-handoff-clarity",
  "sprint-charlotte-guide-authority": "search:charlotte-guide-hub-alignment",
  "deferred-paid-search-readiness": "growth:paid-search-readiness",
  "decision-new-growth-experiments": "growth:new-experiments-gate",
  "recurring-morning-operating-review": "ops:morning-operating-review",
} as const;

export type OperatingBacklogItemId =
  keyof typeof OPERATING_BACKLOG_CANONICAL_IDS;

export function operatingBacklogRecommendationId(itemId: string): string {
  return `operating-backlog:${itemId}`;
}

export function operatingBacklogItemIdFromRecommendationId(
  recommendationId: string,
): string | null {
  const prefix = "operating-backlog:";
  if (!recommendationId.startsWith(prefix)) return null;
  return recommendationId.slice(prefix.length) || null;
}

export function canonicalIdForBacklogItem(itemId: string): string {
  const known =
    OPERATING_BACKLOG_CANONICAL_IDS[
      itemId as OperatingBacklogItemId
    ];
  if (known) return known;
  // Stable fallback for future backlog items — not freeform title hashing.
  return `backlog:${itemId}`;
}

export function canonicalIdForRecommendationId(
  recommendationId: string,
): string | null {
  const itemId = operatingBacklogItemIdFromRecommendationId(recommendationId);
  if (!itemId) return null;
  return canonicalIdForBacklogItem(itemId);
}

/**
 * Problem-stable evidence dimensions for backlog items.
 * Excludes transient wording so copy edits do not reopen completed work.
 */
export function backlogProblemEvidenceDimensions(input: {
  itemId: string;
  kind: string;
  urgency: string;
}): string[] {
  const canonical = canonicalIdForBacklogItem(input.itemId);
  return [
    `canonical:${canonical}`,
    `backlog-item:${input.itemId}`,
    `kind:${input.kind}`,
    `urgency:${input.urgency}`,
  ];
}
