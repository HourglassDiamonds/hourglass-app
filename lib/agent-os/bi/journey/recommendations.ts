/**
 * Convert journey findings into BI recommendations with root-gap consolidation.
 */

import { createEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import type { Recommendation } from "../../types";
import { CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID } from "../types";
import { buildJourneyRecommendationId } from "./ids";
import type {
  JourneyFinding,
  JourneyHandoffs,
  JourneyRootSourceGapId,
  JourneySourceGap,
  JourneyVolumeFunnel,
} from "./types";
import {
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
} from "./types";

const ROOT_GAP_TITLES: Record<JourneyRootSourceGapId, string> = {
  [JOURNEY_PATH_MEASUREMENT_GAP_ID]:
    "Establish verified journey path measurement",
  [CONVERSION_EVENT_MEASUREMENT_GAP_ID]:
    "Verify Concierge conversion measurement before diagnosing conversion performance",
  [TOOL_COMPLETION_MEASUREMENT_GAP_ID]:
    "Establish tool-completion measurement for Studio suite journeys",
  [SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID]:
    "Source-to-lead attribution remains unavailable",
};

/**
 * Findings that share a root source gap consolidate into one founder-facing rec.
 */
export function journeyFindingsToRecommendations(
  findings: JourneyFinding[],
  sourceGaps: JourneySourceGap[],
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
  opts?: {
    /** When Concierge conversion root already exists from measurement audit. */
    hasConciergeConversionRoot?: boolean;
  },
): Recommendation[] {
  const actionable = findings.filter((f) => !f.suppressRecommendation);
  const recommendations: Recommendation[] = [];
  const emittedRoots = new Set<string>();

  // Emit one recommendation per founder-relevant root gap that has supporting findings
  for (const gap of sourceGaps) {
    if (gap.id === JOURNEY_PATH_MEASUREMENT_GAP_ID) continue;
    if (gap.suppressFromFounderRanking) continue;
    if (gap.founderRelevance === "diagnostic") continue;

    const support = findings.filter((f) => f.rootSourceGapId === gap.id);
    if (support.length === 0 && gap.founderRelevance !== "prerequisite") continue;

    if (
      gap.id === CONVERSION_EVENT_MEASUREMENT_GAP_ID &&
      opts?.hasConciergeConversionRoot
    ) {
      // Soft-dedupe: Concierge measurement root already covers conversion unknown-state
      continue;
    }

    recommendations.push(
      buildRootGapRecommendation(gap, support, reportingPeriod, collectedAt),
    );
    emittedRoots.add(gap.id);
  }

  // Non-root actionable findings
  for (const f of actionable) {
    if (f.rootSourceGapId && emittedRoots.has(f.rootSourceGapId)) continue;
    if (
      f.rootSourceGapId === CONVERSION_EVENT_MEASUREMENT_GAP_ID &&
      opts?.hasConciergeConversionRoot
    ) {
      continue;
    }
    if (!f.founderRankable && f.handoffTarget) continue;
    recommendations.push(findingToRecommendation(f, reportingPeriod, collectedAt));
  }

  return recommendations;
}

export function buildJourneyHandoffs(findings: JourneyFinding[]): JourneyHandoffs {
  const uniqueByDedupe = (ids: JourneyFinding[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of ids) {
      const key = f.deduplicationKey || f.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f.id);
    }
    return out;
  };

  return {
    searchHandoffIds: uniqueByDedupe(
      findings.filter((f) => f.handoffTarget === "search-strategy"),
    ),
    contentHandoffIds: uniqueByDedupe(
      findings.filter((f) => f.handoffTarget === "content"),
    ),
    opportunityHandoffIds: uniqueByDedupe(
      findings.filter((f) => f.handoffTarget === "opportunity"),
    ),
    biDiagnosisIds: uniqueByDedupe(
      findings.filter(
        (f) =>
          f.owner === "business-intelligence" &&
          (f.handoffTarget === null || f.handoffTarget === "business-intelligence"),
      ),
    ),
  };
}

export function buildJourneyVolumeFunnel(input: {
  surfacesInventoried: number;
  observedEntries: number;
  observedTransitions: number;
  repositoryTransitions: number;
  conversionSignalsUnknown: number;
  findings: JourneyFinding[];
  recommendations: Recommendation[];
}): JourneyVolumeFunnel {
  const rawFindings = input.findings.length;
  const qualified = input.findings.filter(
    (f) =>
      !f.suppressRecommendation &&
      f.type !== "healthy-journey-coverage" &&
      f.type !== "insufficient-sample",
  ).length;
  const monitorDeferred = rawFindings - qualified;
  const ranked = input.recommendations.filter(
    (r) =>
      r.status !== "consolidated" &&
      r.status !== "ignore" &&
      r.status !== "blocked",
  ).length;
  const surfacedEligible = input.recommendations.filter(
    (r) =>
      r.status !== "consolidated" &&
      r.status !== "ignore" &&
      r.status !== "blocked" &&
      r.agendaBucket !== "ignore" &&
      r.rankingFactors.expectedBusinessImpact >= 4,
  ).length;

  return {
    surfacesInventoried: input.surfacesInventoried,
    observedEntries: input.observedEntries,
    observedTransitions: input.observedTransitions,
    repositoryTransitions: input.repositoryTransitions,
    conversionSignalsUnknown: input.conversionSignalsUnknown,
    rawFindings,
    qualifiedFindings: qualified,
    monitorDeferredFindings: monitorDeferred,
    rankedRecommendations: ranked,
    surfacedEligible,
  };
}

/**
 * Soft-dedupe journey conversion gap against Concierge measurement root.
 */
export function dedupeJourneyAgainstMeasurement(
  journeyRecs: Recommendation[],
  measurementRecs: Recommendation[],
): Recommendation[] {
  const hasConciergeRoot = measurementRecs.some(
    (r) => r.recommendationId === CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  );
  if (!hasConciergeRoot) return journeyRecs;

  return journeyRecs.map((r) => {
    if (r.recommendationId !== CONVERSION_EVENT_MEASUREMENT_GAP_ID) return r;
    return {
      ...r,
      status: "consolidated" as const,
      agendaBucket: "ignore" as const,
      priorityScore: 0,
      blockedReasons: [
        ...(r.blockedReasons ?? []),
        `Consolidated into Concierge conversion root ${CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID}`,
      ],
      dependencies: [
        ...new Set([
          ...(r.dependencies ?? []),
          CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
        ]),
      ],
    };
  });
}

function buildRootGapRecommendation(
  gap: JourneySourceGap,
  support: JourneyFinding[],
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const strongest = support.sort((a, b) => b.confidence - a.confidence)[0];
  const confidence = strongest?.confidence ?? 0.75;
  const severity =
    gap.id === CONVERSION_EVENT_MEASUREMENT_GAP_ID ||
    gap.id === JOURNEY_PATH_MEASUREMENT_GAP_ID
      ? "critical"
      : "medium";

  return buildRecommendation({
    recommendationId: gap.id,
    originatingExecutive: "business-intelligence",
    title: ROOT_GAP_TITLES[gap.id],
    plainLanguageExplanation: `Root journey source gap (${gap.scope}). ${gap.resolutionPrerequisite}. Supporting findings: ${support.map((f) => f.id).join(", ") || "structural gap"}.`,
    whyItMattersNow: gap.affectedAnalyses.join("; "),
    proposedAction: gap.resolutionPrerequisite,
    expectedUpside:
      "Restores trustworthy journey/conversion evidence before growth optimization",
    effortEstimate: "medium",
    urgency: severity === "critical" ? "critical" : "high",
    reversibility: "easily-reversed",
    baseConfidence: confidence,
    evidence: [
      createEvidence({
        source: "ga4",
        sourceType: "analytics",
        collectedAt,
        reportingPeriod,
        metricOrObservation: gap.scope.slice(0, 240),
        priorComparison: support[0]?.observedEvidence.slice(0, 160) ?? null,
        reliability: "unverified",
        supportingReference: gap.id,
      }),
      ...support.slice(0, 2).map((f) =>
        createEvidence({
          source: "ga4",
          sourceType: "analytics",
          collectedAt,
          reportingPeriod,
          metricOrObservation: f.observedEvidence.slice(0, 240),
          priorComparison: f.expectedEvidence.slice(0, 160),
          reliability: f.isInference ? "unverified" : "reliable",
          supportingReference: f.id,
        }),
      ),
    ],
    assumptions: [
      "Missing measurement is not proof of zero conversions or abandoned journeys",
      "Repository links are not observed user transitions",
    ],
    risks: [
      "Do not invent funnel or conversion rates while this gap is open",
      "Do not treat zero observed events as zero real conversions without healthy verified measurement",
    ],
    dependencies: [
      "Measurement prerequisite before dependent journey optimization",
    ],
    approvalRequired: false,
    suggestedOwner: "Founder + analytics",
    rankingFactors: {
      expectedBusinessImpact:
        gap.id === CONVERSION_EVENT_MEASUREMENT_GAP_ID ||
        gap.id === JOURNEY_PATH_MEASUREMENT_GAP_ID
          ? 9
          : 6,
      strategicAlignment: 9,
      dependencyReadiness: 0.85,
      dataQuality: 0.7,
    },
  });
}

function findingToRecommendation(
  f: JourneyFinding,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const impact =
    f.severity === "critical" ? 9 : f.severity === "high" ? 7 : f.severity === "medium" ? 5 : 3;

  return buildRecommendation({
    recommendationId: buildJourneyRecommendationId(f.id),
    originatingExecutive: "business-intelligence",
    title: f.title,
    plainLanguageExplanation: `${f.observedEvidence} Evidence class: ${f.evidenceClass}. Transition state: ${f.transitionState ?? "n/a"}.`,
    whyItMattersNow: f.whyItMatters,
    proposedAction: f.recommendedNextAction,
    expectedUpside: "Improves qualified-prospect progression clarity",
    effortEstimate: f.evidenceClass === "repository-backed" ? "low" : "medium",
    urgency:
      f.severity === "critical"
        ? "critical"
        : f.severity === "high"
          ? "high"
          : "medium",
    reversibility: "easily-reversed",
    baseConfidence: f.confidence,
    evidence: [
      createEvidence({
        source:
          f.evidenceClass === "repository-backed" ? "repository" : "ga4",
        sourceType:
          f.evidenceClass === "repository-backed" ? "derived" : "analytics",
        collectedAt,
        reportingPeriod,
        metricOrObservation: f.observedEvidence.slice(0, 240),
        priorComparison: f.expectedEvidence.slice(0, 160),
        reliability: f.isInference ? "unverified" : "reliable",
        supportingReference: f.id,
      }),
    ],
    assumptions: [
      ...(f.isInference
        ? ["Includes inference — not labeled as observed user behavior"]
        : []),
      ...(f.evidenceClass === "repository-backed"
        ? ["Repository structure describes readiness, not proven user flow"]
        : []),
    ],
    risks: [
      "Do not fabricate conversion rates or funnel percentages",
      ...(f.sampleSize !== null && f.sampleSize < 40
        ? ["Sample size may amplify percentage swings"]
        : []),
    ],
    dependencies: f.rootSourceGapId ? [f.rootSourceGapId] : [],
    approvalRequired: false,
    suggestedOwner:
      f.owner === "content"
        ? "Content"
        : f.owner === "search-strategy"
          ? "Search Strategy"
          : "Founder + BI",
    rankingFactors: {
      expectedBusinessImpact: impact,
      dataQuality: f.evidenceClass === "observed-analytics" ? 0.85 : 0.55,
      dependencyReadiness: f.rootSourceGapId ? 0.35 : 0.9,
      strategicAlignment: 8,
    },
  });
}
