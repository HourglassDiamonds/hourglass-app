/**
 * Convert persistent operating backlog into Agent OS recommendations
 * so Chief of Staff can rank them as authoritative priorities.
 */

import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import type { Recommendation } from "../types";
import { activeBacklogItems } from "./current-sprint";
import {
  backlogProblemEvidenceDimensions,
  canonicalIdForBacklogItem,
  operatingBacklogRecommendationId,
} from "./canonical";
import { deriveDayOrientationFromBacklog } from "./hydrate";
import type { OperatingBacklog, OperatingBacklogItem } from "./types";

const BACKLOG_EVIDENCE_PERIOD = { start: "2026-07-20", end: "2026-07-26" };

function itemToRecommendation(
  item: OperatingBacklogItem,
  sprintName: string,
  collectedAt: string,
): Recommendation {
  const approvalRequired = item.kind === "open-decision";
  const proposedAction =
    item.kind === "open-decision" && item.recommendedChoice
      ? item.recommendedChoice
      : item.action;
  const recommendationId = operatingBacklogRecommendationId(item.id);
  const canonicalId = canonicalIdForBacklogItem(item.id);
  const problemDims = backlogProblemEvidenceDimensions({
    itemId: item.id,
    kind: item.kind,
    urgency: item.urgency,
  });

  const rec = buildRecommendation({
    recommendationId,
    originatingExecutive: "chief-of-staff",
    title: item.title,
    plainLanguageExplanation: item.why,
    whyItMattersNow: item.why,
    proposedAction,
    expectedUpside: item.expectedOutcome,
    effortEstimate: "low",
    urgency: item.urgency,
    reversibility: "easily-reversed",
    // Persistent commitments outrank thin overnight analytics noise.
    baseConfidence: 0.86,
    evidence: [
      createEvidence({
        source: "repository-content-inventory",
        sourceType: "internal-report",
        collectedAt,
        reportingPeriod: BACKLOG_EVIDENCE_PERIOD,
        // Problem-stable observation — wording changes must not reopen lifecycle.
        metricOrObservation: problemDims.join("|"),
        reliability: "reliable",
        supportingReference: `operating-backlog://${item.id}`,
      }),
    ],
    assumptions: [
      "Item remains active until explicitly completed, cancelled, replaced, or deferred",
      `Canonical problem identity: ${canonicalId}`,
    ],
    risks: ["Ignoring persistent sprint work recreates empty Morning Briefs"],
    dependencies: [],
    approvalRequired,
    suggestedOwner: "Founder",
    rankingFactors: {
      expectedBusinessImpact: item.kind === "open-decision" ? 7 : 9,
      strategicAlignment: 10,
      dependencyReadiness: 1,
      dataQuality: 0.9,
    },
  });

  return rec;
}

/**
 * Build founder-rankable recommendations from the operating backlog.
 * Sprint priorities + founder actions only (for ROI / Top Priorities).
 * Open decisions are emitted separately via `decisionRecommendationsFromBacklog`.
 * Terminal backlog statuses are never emitted.
 */
export function recommendationsFromOperatingBacklog(
  backlog: OperatingBacklog,
  options?: { nowIso?: string; collectedAt?: string },
): Recommendation[] {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const collectedAt = options?.collectedAt ?? nowIso;
  const items = activeBacklogItems(backlog, nowIso).filter((i) => {
    if (
      i.status === "completed" ||
      i.status === "cancelled" ||
      i.status === "replaced"
    ) {
      return false;
    }
    if (i.kind === "open-decision" || i.kind === "recurring-obligation") {
      return false;
    }
    if (i.status === "deferred" && i.deferredUntil) {
      return Date.parse(i.deferredUntil) <= Date.parse(nowIso);
    }
    if (i.kind === "deferred-work" && i.deferredUntil) {
      return Date.parse(i.deferredUntil) <= Date.parse(nowIso);
    }
    return i.status === "active";
  });

  const ranked = [...items].sort((a, b) => {
    const kindWeight = (k: OperatingBacklogItem["kind"]) => {
      if (k === "sprint-priority") return 0;
      if (k === "founder-action") return 1;
      if (k === "deferred-work") return 2;
      return 3;
    };
    const kw = kindWeight(a.kind) - kindWeight(b.kind);
    if (kw !== 0) return kw;
    return a.rank - b.rank;
  });

  return ranked.map((item) =>
    itemToRecommendation(item, backlog.masterSprint.name, collectedAt),
  );
}

/** Open decisions from the backlog (approvalRequired). */
export function decisionRecommendationsFromBacklog(
  backlog: OperatingBacklog,
  options?: { nowIso?: string; collectedAt?: string },
): Recommendation[] {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const collectedAt = options?.collectedAt ?? nowIso;
  return backlog.masterSprint.items
    .filter((i) => i.kind === "open-decision" && i.status === "active")
    .sort((a, b) => a.rank - b.rank)
    .map((item) =>
      itemToRecommendation(item, backlog.masterSprint.name, collectedAt),
    );
}

/** Human labels for email / Today’s call framing. */
export function backlogOrientationSummary(
  backlog: OperatingBacklog,
  options?: { nowIso?: string },
): {
  sprintName: string;
  objective: string;
  dayOrientation: string | null;
  activePriorityTitles: string[];
  openDecisionTitles: string[];
  deferredTitles: string[];
} {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const active = backlog.masterSprint.items.filter((i) => i.status === "active");
  return {
    sprintName: backlog.masterSprint.name,
    objective: backlog.masterSprint.objective,
    // Always derive from reconciled active set — never echo a stale static sentence.
    dayOrientation: deriveDayOrientationFromBacklog(backlog, nowIso),
    activePriorityTitles: active
      .filter((i) => i.kind === "sprint-priority" || i.kind === "founder-action")
      .sort((a, b) => a.rank - b.rank)
      .map((i) => i.title),
    openDecisionTitles: active
      .filter((i) => i.kind === "open-decision")
      .map((i) => i.title),
    deferredTitles: backlog.deferred
      .filter((i) => i.status === "deferred" || i.status === "active")
      .map((i) => i.title),
  };
}
