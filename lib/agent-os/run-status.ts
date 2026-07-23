/**
 * Agent OS run status contract for automation (email schedulers, etc.).
 *
 * Distinguishes healthy quiet runs from degraded zero-recommendation runs:
 * - completed + none-material → healthy; nothing worth escalating
 * - blocked + none-blocked-by-sources → do not treat as “all clear”
 */

import type { AgentOsDataBundle } from "./adapters/types";
import type {
  AgentRunStatus,
  Recommendation,
  RecommendationAvailability,
} from "./types";

export const AGENT_RUN_STATUSES = [
  "completed",
  "completed-with-warnings",
  "failed",
  "blocked",
] as const satisfies readonly AgentRunStatus[];

export function criticalSourcesUnavailable(bundle: AgentOsDataBundle): boolean {
  const critical = [bundle.ga4, bundle.gsc, bundle.weeklyIntelligence];
  const usable = critical.some(
    (s) =>
      s.ok &&
      (s.health.retrievalState === "ok" ||
        s.health.retrievalState === "fixture" ||
        s.health.retrievalState === "empty"),
  );
  return !usable;
}

export function countMaterialRecommendations(
  recommendations: Recommendation[],
): number {
  return recommendations.filter(
    (r) =>
      r.status === "proposed" ||
      r.status === "downgraded" ||
      r.status === "monitor" ||
      r.agendaBucket === "do-now" ||
      r.agendaBucket === "schedule-next",
  ).length;
}

export function resolveRecommendationAvailability(input: {
  materialCount: number;
  criticalSourcesDown: boolean;
}): RecommendationAvailability {
  if (input.materialCount > 0) return "has-material-recommendations";
  if (input.criticalSourcesDown) return "none-blocked-by-sources";
  return "none-material";
}

export function resolveRunStatus(input: {
  criticalSourcesDown: boolean;
  fatalError?: string | null;
  warningCount: number;
  dataGapCount: number;
  recommendationAvailability: RecommendationAvailability;
}): AgentRunStatus {
  if (input.fatalError) return "failed";
  if (
    input.criticalSourcesDown ||
    input.recommendationAvailability === "none-blocked-by-sources"
  ) {
    return "blocked";
  }
  if (input.warningCount > 0 || input.dataGapCount > 0) {
    return "completed-with-warnings";
  }
  return "completed";
}
