/**
 * CoS surface-pool inject for urgent Client Ops exceptions.
 * Does not invent a founder-now backlog item.
 * Concierge SLA / critical QA still win if both exist.
 */

import type { Recommendation } from "../../types";
import { isClientAttentionRecommendationId } from "./recommendations";
import { MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES } from "./types";

export function isUrgentClientOpsRecommendation(rec: Recommendation): boolean {
  return (
    isClientAttentionRecommendationId(rec.recommendationId) &&
    (rec.urgency === "critical" || rec.urgency === "high")
  );
}

export function injectUrgentClientOpsIntoSurfacePool(input: {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
}): {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
} {
  const urgent = input.recommendations
    .filter(
      (r) =>
        isUrgentClientOpsRecommendation(r) &&
        r.status !== "downgraded" &&
        r.status !== "ignore" &&
        r.status !== "blocked" &&
        r.status !== "consolidated",
    )
    .slice(0, MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES);

  if (!urgent.length) {
    return {
      recommendations: input.recommendations,
      surfacePool: input.surfacePool,
    };
  }

  const urgentIds = new Set(urgent.map((r) => r.recommendationId));
  const poolWithout = input.surfacePool.filter(
    (r) => !urgentIds.has(r.recommendationId),
  );
  return {
    recommendations: input.recommendations,
    surfacePool: [...urgent, ...poolWithout],
  };
}
