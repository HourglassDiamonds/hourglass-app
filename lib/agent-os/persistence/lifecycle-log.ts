/**
 * Structured, secret-free lifecycle reconciliation logs.
 */

export type RecommendationLifecycleEvent =
  | "recommendation_generated"
  | "recommendation_matched_existing"
  | "recommendation_suppressed_terminal"
  | "recommendation_reopened"
  | "recommendation_marked_completed"
  | "recommendation_marked_dismissed"
  | "recommendation_marked_superseded"
  | "recommendation_ranked";

export function logRecommendationLifecycleEvent(
  event: RecommendationLifecycleEvent,
  fields: {
    recommendationId?: string;
    canonicalId?: string | null;
    lifecycleState?: string;
    priorLifecycle?: string | null;
    evidenceClass?: string | null;
    reason?: string;
    matchedTerminalId?: string;
    source?: string;
  },
): void {
  console.info(
    JSON.stringify({
      channel: "agent-os-recommendation-lifecycle",
      event,
      recommendationId: fields.recommendationId ?? null,
      canonicalId: fields.canonicalId ?? null,
      lifecycleState: fields.lifecycleState ?? null,
      priorLifecycle: fields.priorLifecycle ?? null,
      evidenceClass: fields.evidenceClass ?? null,
      reason: fields.reason ?? null,
      matchedTerminalId: fields.matchedTerminalId ?? null,
      source: fields.source ?? null,
    }),
  );
}
