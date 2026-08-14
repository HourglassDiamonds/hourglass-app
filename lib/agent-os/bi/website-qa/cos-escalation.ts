/**
 * CoS surface-pool inject for a critical Website QA exception.
 * Mirrors Concierge SLA: operational exception, not a checklist.
 * Concierge overdue still wins if both exist.
 */

import type { Recommendation } from "../../types";
import { WEBSITE_QA_ROOT_EXCEPTION_ID } from "./types";

export function isWebsiteQaExceptionRecommendationId(id: string): boolean {
  return id === WEBSITE_QA_ROOT_EXCEPTION_ID;
}

export function injectWebsiteQaCriticalIntoSurfacePool(input: {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
}): {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
} {
  const rec = input.recommendations.find(
    (r) =>
      r.recommendationId === WEBSITE_QA_ROOT_EXCEPTION_ID &&
      r.urgency === "critical",
  );
  if (!rec) {
    return {
      recommendations: input.recommendations,
      surfacePool: input.surfacePool,
    };
  }

  const poolWithout = input.surfacePool.filter(
    (r) => r.recommendationId !== WEBSITE_QA_ROOT_EXCEPTION_ID,
  );
  return {
    recommendations: input.recommendations,
    surfacePool: [rec, ...poolWithout],
  };
}
