/**
 * Convert persistent operating backlog into Agent OS recommendations
 * so Chief of Staff can rank them as authoritative priorities.
 */

import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import type { Recommendation } from "../types";
import {
  backlogProblemEvidenceDimensions,
  canonicalIdForBacklogItem,
  operatingBacklogRecommendationId,
} from "./canonical";
import { deriveDayOrientationFromBacklog } from "./hydrate";
import {
  isFounderNowItem,
  isNonTerminalBacklogStatus,
  isWatchItem,
  MAX_WATCH_EMAIL_ITEMS,
  watchLineForItem,
} from "./surface-policy";
import type { OperatingBacklog, OperatingBacklogItem } from "./types";

const BACKLOG_EVIDENCE_PERIOD = { start: "2026-07-20", end: "2026-07-26" };

function allBacklogItems(backlog: OperatingBacklog): OperatingBacklogItem[] {
  return [
    ...backlog.masterSprint.items,
    ...backlog.deferred,
    ...backlog.recurring,
  ];
}

function itemToRecommendation(
  item: OperatingBacklogItem,
  sprintName: string,
  collectedAt: string,
): Recommendation {
  void sprintName;
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
    // Persistent founder-now commitments outrank thin overnight analytics noise.
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

function isFounderNowRankable(item: OperatingBacklogItem): boolean {
  if (!isNonTerminalBacklogStatus(item.status)) return false;
  if (item.kind === "open-decision" || item.kind === "recurring-obligation") {
    return false;
  }
  return isFounderNowItem(item);
}

/**
 * Build founder-rankable recommendations from the operating backlog.
 * Founder-now sprint priorities + founder actions only (for ROI / Top Priorities).
 * Watch / background items are never emitted here — even if deferredUntil has passed.
 * Open decisions are emitted separately via `decisionRecommendationsFromBacklog`.
 * Terminal backlog statuses are never emitted.
 */
export function recommendationsFromOperatingBacklog(
  backlog: OperatingBacklog,
  options?: { nowIso?: string; collectedAt?: string },
): Recommendation[] {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const collectedAt = options?.collectedAt ?? nowIso;
  void nowIso;
  const items = allBacklogItems(backlog).filter(isFounderNowRankable);

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

/** Non-terminal watch items for Watch / No Action (never founder-now slots). */
export function watchItemsFromOperatingBacklog(
  backlog: OperatingBacklog,
): OperatingBacklogItem[] {
  return allBacklogItems(backlog)
    .filter(
      (i) =>
        isNonTerminalBacklogStatus(i.status) &&
        isWatchItem(i) &&
        i.kind !== "recurring-obligation" &&
        i.kind !== "open-decision",
    )
    .sort((a, b) => a.rank - b.rank);
}

/** Compact Watch / No Action lines for the daily founder email. */
export function watchLinesFromOperatingBacklog(
  backlog: OperatingBacklog,
  max = MAX_WATCH_EMAIL_ITEMS,
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const item of watchItemsFromOperatingBacklog(backlog)) {
    const line = watchLineForItem(item);
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
    if (lines.length >= max) break;
  }
  return lines;
}

/** Open decisions from the backlog (approvalRequired). Founder-now only. */
export function decisionRecommendationsFromBacklog(
  backlog: OperatingBacklog,
  options?: { nowIso?: string; collectedAt?: string },
): Recommendation[] {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const collectedAt = options?.collectedAt ?? nowIso;
  void nowIso;
  return backlog.masterSprint.items
    .filter(
      (i) =>
        i.kind === "open-decision" &&
        i.status === "active" &&
        isFounderNowItem(i),
    )
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
  watchTitles: string[];
} {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const founderNow = allBacklogItems(backlog).filter(
    (i) =>
      isNonTerminalBacklogStatus(i.status) &&
      isFounderNowItem(i) &&
      (i.kind === "sprint-priority" || i.kind === "founder-action"),
  );
  return {
    sprintName: backlog.masterSprint.name,
    objective: backlog.masterSprint.objective,
    // Always derive from reconciled founder-now set — never echo a stale static sentence.
    dayOrientation: deriveDayOrientationFromBacklog(backlog, nowIso),
    activePriorityTitles: [...founderNow]
      .sort((a, b) => a.rank - b.rank)
      .map((i) => i.title),
    openDecisionTitles: backlog.masterSprint.items
      .filter(
        (i) =>
          i.kind === "open-decision" &&
          i.status === "active" &&
          isFounderNowItem(i),
      )
      .map((i) => i.title),
    deferredTitles: backlog.deferred
      .filter((i) => i.status === "deferred" || i.status === "active")
      .filter((i) => isWatchItem(i) || isFounderNowItem(i))
      .map((i) => i.title),
    watchTitles: watchItemsFromOperatingBacklog(backlog).map((i) => i.title),
  };
}
