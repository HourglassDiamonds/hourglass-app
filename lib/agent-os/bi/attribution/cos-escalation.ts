/**
 * CoS surface-pool inject for attribution capture-integrity only.
 * Ordinary tiny-sample evidence stays machine-readable and silent.
 */

import type { Recommendation } from "../../types";
import { ATTRIBUTION_COVERAGE_INTEGRITY_ID } from "./types";

export function isAttributionIntegrityRecommendationId(id: string): boolean {
  return id === ATTRIBUTION_COVERAGE_INTEGRITY_ID;
}

export function injectAttributionIntegrityIntoSurfacePool(input: {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
}): {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
} {
  const rec = input.recommendations.find(
    (r) =>
      r.recommendationId === ATTRIBUTION_COVERAGE_INTEGRITY_ID &&
      r.urgency === "critical",
  );
  if (!rec) {
    return {
      recommendations: input.recommendations,
      surfacePool: input.surfacePool,
    };
  }

  const poolWithout = input.surfacePool.filter(
    (r) => r.recommendationId !== ATTRIBUTION_COVERAGE_INTEGRITY_ID,
  );
  return {
    recommendations: input.recommendations,
    surfacePool: [rec, ...poolWithout],
  };
}
