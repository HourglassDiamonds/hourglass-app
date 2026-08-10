/**
 * Project current recommendations onto prior persisted records for
 * founder-recurrence eligibility BEFORE brief surfacing.
 */

import type { Recommendation } from "../types";
import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  type PersistedRecommendationRecord,
  type RecurrenceDecision,
} from "./types";
import {
  fingerprintForRecommendation,
  inferRootProblemId,
  recommendationIsFounderRankable,
} from "./extract";
import {
  MAX_FOUNDER_BRIEF_PRIORITIES,
  selectFounderPrioritiesForBrief,
} from "./recurrence";
import { logRecommendationLifecycleEvent } from "./lifecycle-log";
import { isPersistedRecommendationTerminal } from "../operating-backlog/hydrate";

function severityRank(u: string): number {
  if (u === "critical") return 4;
  if (u === "high") return 3;
  if (u === "medium") return 2;
  if (u === "low") return 1;
  return 0;
}

/**
 * Resolve prior record by exact ID, else by shared rootProblemId / canonical.
 */
function resolvePriorRecord(
  rec: Recommendation,
  prior: Record<string, PersistedRecommendationRecord>,
): PersistedRecommendationRecord | undefined {
  const exact = prior[rec.recommendationId];
  if (exact) return exact;
  const root = inferRootProblemId(rec.recommendationId);
  if (!root) return undefined;
  for (const candidate of Object.values(prior)) {
    if (candidate.rootProblemId === root) return candidate;
  }
  return undefined;
}

/**
 * Build provisional persisted-shaped records for recurrence evaluation.
 * Preserves prior first/last surfaced and occurrence metadata.
 * Terminal prior state (including canonical matches) stays terminal unless
 * explicitly reopened via applyRecommendationReopen.
 */
export function projectRecurrenceRecords(
  recommendations: Recommendation[],
  prior: Record<string, PersistedRecommendationRecord>,
): PersistedRecommendationRecord[] {
  const out: PersistedRecommendationRecord[] = [];
  for (const rec of recommendations) {
    if (!recommendationIsFounderRankable(rec)) continue;
    const fp = fingerprintForRecommendation(rec);
    const root = inferRootProblemId(rec.recommendationId);
    const existing = resolvePriorRecord(rec, prior);
    if (!existing) {
      out.push({
        schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
        recommendationId: rec.recommendationId,
        owningExecutive: rec.originatingExecutive,
        handoffTarget: null,
        firstSeenAt: "1970-01-01T00:00:00.000Z",
        lastSeenAt: "1970-01-01T00:00:00.000Z",
        occurrenceCount: 0,
        lifecycleState: "new",
        previousLifecycle: null,
        changeClassification: "first-seen",
        priorityScore: rec.priorityScore,
        confidence: rec.confidence,
        founderRankable: true,
        currentAction: rec.proposedAction.slice(0, 240),
        rootProblemId: root,
        dependencies: rec.dependencies.slice(0, 12),
        blockers: (rec.blockedReasons ?? []).slice(0, 8),
        evidenceFingerprint: fp,
        firstSurfacedAt: null,
        lastSurfacedAt: null,
        timesSurfaced: 0,
        completedAt: null,
        deferredUntil: null,
        supersededBy: null,
        urgency: rec.urgency,
        modeOrigin: "fixture",
      });
      continue;
    }

    if (
      existing.recommendationId !== rec.recommendationId ||
      isPersistedRecommendationTerminal(existing)
    ) {
      logRecommendationLifecycleEvent("recommendation_matched_existing", {
        recommendationId: rec.recommendationId,
        canonicalId: root ?? existing.rootProblemId,
        lifecycleState: existing.lifecycleState,
        matchedTerminalId:
          existing.recommendationId !== rec.recommendationId
            ? existing.recommendationId
            : undefined,
      });
    }

    const fingerprintChanged = existing.evidenceFingerprint !== fp;
    let changeClassification = existing.changeClassification;
    let lifecycleState = existing.lifecycleState;

    if (existing.lifecycleState === "deferred" && existing.deferredUntil) {
      changeClassification = "deferred";
      lifecycleState = "deferred";
    } else if (
      existing.changeClassification === "reopened" &&
      !isPersistedRecommendationTerminal(existing)
    ) {
      changeClassification = "reopened";
      lifecycleState = "active";
    } else if (isPersistedRecommendationTerminal(existing)) {
      // Suppress regeneration of terminal work — do not reopen from detector reruns.
      changeClassification =
        existing.lifecycleState === "superseded" ? "superseded" : "completed";
      lifecycleState =
        existing.lifecycleState === "superseded" ? "superseded" : "completed";
      logRecommendationLifecycleEvent("recommendation_suppressed_terminal", {
        recommendationId: rec.recommendationId,
        canonicalId: root ?? existing.rootProblemId,
        lifecycleState,
        matchedTerminalId: existing.recommendationId,
        reason: fingerprintChanged
          ? "terminal-match-ignore-non-material-drift"
          : "terminal-match-no-material-evidence",
      });
    } else if (!fingerprintChanged) {
      changeClassification = "unchanged";
      lifecycleState = "unchanged";
    } else {
      const sp = severityRank(existing.urgency);
      const sn = severityRank(rec.urgency);
      if (sn > sp) {
        changeClassification = "worsened";
        lifecycleState = "worsened";
      } else if (sn < sp) {
        changeClassification = "improved";
        lifecycleState = "improved";
      } else {
        changeClassification = "unknown";
        lifecycleState = "active";
      }
    }

    out.push({
      ...existing,
      recommendationId: rec.recommendationId,
      priorityScore: rec.priorityScore,
      confidence: rec.confidence,
      founderRankable: true,
      currentAction: rec.proposedAction.slice(0, 240),
      rootProblemId: root ?? existing.rootProblemId,
      dependencies: rec.dependencies.slice(0, 12),
      blockers: (rec.blockedReasons ?? []).slice(0, 8),
      evidenceFingerprint: fp,
      urgency: rec.urgency,
      changeClassification,
      lifecycleState,
      completedAt:
        lifecycleState === "completed"
          ? (existing.completedAt ?? existing.firstSeenAt)
          : existing.completedAt,
    });
  }

  return out;
}

export type FounderSurfaceEligibility = {
  eligibleIds: string[];
  decisions: RecurrenceDecision[];
  /** True when persistence prior was available and gate applied. */
  gateApplied: boolean;
};

/**
 * Recurrence eligibility BEFORE founder brief ranking/surfacing.
 * Returns ordered eligible recommendation IDs (priority desc, root-deduped).
 * Terminal matches never consume founder priority slots.
 */
export function resolveFounderSurfaceEligibility(input: {
  recommendations: Recommendation[];
  priorRecommendations: Record<string, PersistedRecommendationRecord>;
  nowIso: string;
  onDemand?: boolean;
  max?: number;
}): FounderSurfaceEligibility {
  const projected = projectRecurrenceRecords(
    input.recommendations,
    input.priorRecommendations,
  );
  const { selected, decisions } = selectFounderPrioritiesForBrief(
    projected,
    input.nowIso,
    {
      max: input.max ?? MAX_FOUNDER_BRIEF_PRIORITIES,
      onDemand: input.onDemand,
    },
  );
  return {
    eligibleIds: selected.map((s) => s.recommendationId),
    decisions,
    gateApplied: true,
  };
}
