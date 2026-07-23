/**
 * Future delivery semantics for Agent OS briefs (email/cron consumers).
 * No scheduling or email is implemented here — contract only.
 */

import type {
  AgentRunStatus,
  BriefEvidenceQuality,
  DeliveryGuidance,
  ExecutiveId,
  ExecutiveRunStatus,
  ExecutiveRunSummary,
  Recommendation,
  RecommendationAvailability,
} from "./types";
import { countMaterialRecommendations } from "./run-status";

export function resolveBriefEvidenceQuality(input: {
  runStatus: AgentRunStatus;
  fatalError?: string | null;
  criticalSourcesDown: boolean;
  materialCount: number;
}): BriefEvidenceQuality {
  if (input.fatalError || input.runStatus === "failed") return "failed";
  if (input.materialCount > 0 && input.criticalSourcesDown) {
    return "partial-degraded";
  }
  if (input.materialCount > 0) return "full";
  if (input.criticalSourcesDown) return "none-blocked";
  return "full";
}

/**
 * Guidance for a future automated sender — not wired to any transport.
 *
 * - send-normal-brief: healthy usable brief
 * - send-degraded-partial-brief: usable partial evidence (e.g. Search repo findings while GA4/GSC down)
 * - send-failure-alert: fatal or blocked with nothing usable — not “all clear”
 * - send-nothing: healthy quiet week with no material recommendations
 */
export function resolveDeliveryGuidance(input: {
  runStatus: AgentRunStatus;
  recommendationAvailability: RecommendationAvailability;
  briefEvidenceQuality: BriefEvidenceQuality;
}): DeliveryGuidance {
  if (
    input.runStatus === "failed" ||
    input.briefEvidenceQuality === "failed"
  ) {
    return "send-failure-alert";
  }
  if (input.recommendationAvailability === "has-material-recommendations") {
    if (
      input.briefEvidenceQuality === "partial-degraded" ||
      input.runStatus === "blocked"
    ) {
      return "send-degraded-partial-brief";
    }
    return "send-normal-brief";
  }
  if (input.recommendationAvailability === "none-blocked-by-sources") {
    return "send-failure-alert";
  }
  // none-material on a completed / completed-with-warnings run
  return "send-nothing";
}

export function summarizeExecutiveRun(input: {
  executiveId: ExecutiveId;
  status: ExecutiveRunStatus;
  recommendations: Recommendation[];
  note?: string;
}): ExecutiveRunSummary {
  return {
    executiveId: input.executiveId,
    status: input.status,
    materialRecommendationCount: countMaterialRecommendations(
      input.recommendations,
    ),
    note: input.note,
  };
}

export function resolveBiExecutiveStatus(input: {
  skipped: boolean;
  criticalAnalyticsDown: boolean;
  dataGapCount: number;
  recommendations: Recommendation[];
}): ExecutiveRunSummary {
  if (input.skipped) {
    return summarizeExecutiveRun({
      executiveId: "business-intelligence",
      status: "blocked",
      recommendations: [],
      note: "BI synthesis skipped due to fatal/live-load abort",
    });
  }
  if (input.criticalAnalyticsDown) {
    return summarizeExecutiveRun({
      executiveId: "business-intelligence",
      status: "blocked",
      recommendations: input.recommendations,
      note: "Critical analytics sources unavailable for BI",
    });
  }
  if (input.dataGapCount > 0) {
    return summarizeExecutiveRun({
      executiveId: "business-intelligence",
      status: "completed-with-warnings",
      recommendations: input.recommendations,
      note: "BI completed with measurement gaps",
    });
  }
  return summarizeExecutiveRun({
    executiveId: "business-intelligence",
    status: "completed",
    recommendations: input.recommendations,
  });
}

export function resolveSearchExecutiveStatus(input: {
  skipped: boolean;
  gscAvailable: boolean;
  recommendations: Recommendation[];
  opportunityCount: number;
}): ExecutiveRunSummary {
  if (input.skipped) {
    return summarizeExecutiveRun({
      executiveId: "search-strategy",
      status: "blocked",
      recommendations: [],
      note: "Search Strategy skipped due to fatal/live-load abort",
    });
  }
  if (!input.gscAvailable) {
    return summarizeExecutiveRun({
      executiveId: "search-strategy",
      status: "completed-with-warnings",
      recommendations: input.recommendations,
      note:
        input.opportunityCount > 0
          ? "Search completed with repository findings; GSC unavailable (no fabricated GSC rows)"
          : "Search completed without GSC; repository analysis produced no material opportunities",
    });
  }
  return summarizeExecutiveRun({
    executiveId: "search-strategy",
    status: "completed",
    recommendations: input.recommendations,
  });
}
