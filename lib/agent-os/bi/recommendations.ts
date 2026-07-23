/**
 * Convert measurement findings into BI recommendations.
 * Healthy / monitor / suppressed findings stay structured but do not flood the brief.
 * Concierge conversion-measurement findings consolidate into one founder-facing root.
 */

import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import type { Recommendation } from "../types";
import { buildMeasurementRecommendationId } from "./ids";
import {
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  type MeasurementDecisionEffect,
  type MeasurementFinding,
  type MeasurementVolumeFunnel,
} from "./types";

const DECISION_EFFECT_RANK: Record<MeasurementDecisionEffect, number> = {
  "decision-blocking": 3,
  "decision-degrading": 2,
  monitor: 1,
};

/** Findings that are one Concierge conversion-measurement root problem. */
export function isConciergeConversionClusterFinding(
  f: MeasurementFinding,
): boolean {
  const conciergeScoped =
    f.affectedFunnel === "general-consultation" ||
    f.affectedRoute === "/concierge" ||
    f.affectedEvent === "generate_lead" ||
    f.affectedEvent === "concierge_form_submitted" ||
    f.affectedEvent === "concierge_form_started";

  if (!conciergeScoped) return false;

  if (f.type === "conversion-definition-gap") return true;
  if (f.type === "concierge-start-submit-gap") return true;
  if (
    f.type === "expected-event-not-observed" &&
    (f.affectedEvent === "generate_lead" ||
      f.affectedEvent === "concierge_form_submitted")
  ) {
    return true;
  }
  if (
    f.type === "verification-required" &&
    (f.affectedEvent === "generate_lead" ||
      f.affectedEvent === "concierge_form_submitted" ||
      /concierge|conversion|generate_lead/i.test(f.title))
  ) {
    return true;
  }
  return false;
}

/**
 * Build founder-facing recommendations from findings.
 * Supporting Concierge cluster findings stay in audit JSON; only one root rec is emitted.
 */
export function measurementFindingsToRecommendations(
  findings: MeasurementFinding[],
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation[] {
  const actionable = findings
    .filter((f) => !f.suppressRecommendation)
    .filter((f) => f.type !== "measurement-healthy");

  const cluster = actionable.filter(isConciergeConversionClusterFinding);
  const others = actionable.filter((f) => !isConciergeConversionClusterFinding(f));

  const recommendations: Recommendation[] = [];

  if (cluster.length > 0) {
    recommendations.push(
      buildConciergeConversionRootRecommendation(
        cluster,
        reportingPeriod,
        collectedAt,
      ),
    );
  }

  for (const f of others) {
    recommendations.push(findingToRecommendation(f, reportingPeriod, collectedAt));
  }

  return recommendations;
}

export function buildConciergeConversionRootRecommendation(
  cluster: MeasurementFinding[],
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const strongest = cluster.reduce((best, f) =>
    DECISION_EFFECT_RANK[f.decisionEffect] > DECISION_EFFECT_RANK[best.decisionEffect]
      ? f
      : best,
  );
  const decisionEffect = strongest.decisionEffect;
  const confidence = Math.max(...cluster.map((f) => f.confidence));
  const sampleSize = cluster.reduce(
    (max, f) => Math.max(max, f.sampleSize ?? 0),
    0,
  );

  const supportNotes = cluster.map((f) => `${f.type}: ${f.observedEvidence}`);
  const supportingIds = cluster.map((f) => f.id);

  const hasStartObserved = cluster.some(
    (f) =>
      f.type === "concierge-start-submit-gap" ||
      /start.*observed|Started=/i.test(f.observedEvidence),
  );
  const hasSubmitGap = cluster.some(
    (f) =>
      f.type === "concierge-start-submit-gap" ||
      f.type === "expected-event-not-observed" ||
      /submit.*absent|not observed|unverified|unknown/i.test(f.observedEvidence),
  );
  const hasDefinitionGap = cluster.some(
    (f) => f.type === "conversion-definition-gap",
  );
  const unverifiedOnly = cluster.every(
    (f) => f.type === "verification-required" || /unknown|unverified/i.test(f.observedEvidence),
  );

  const observedSummary = [
    hasStartObserved ? "Concierge start event observed or expected" : null,
    hasSubmitGap
      ? unverifiedOnly
        ? "submit / conversion event unverifiable in Agent OS reads"
        : "submit / generate_lead absent or unverifiable in the observation set"
      : null,
    hasDefinitionGap || cluster.length > 1
      ? "multiple candidate conversion events exist in repository instrumentation"
      : "repository instruments Concierge conversion candidates",
    "downstream paid/remarketing decisions stay blocked until one reporting conversion is verified",
  ]
    .filter(Boolean)
    .join("; ");

  return buildRecommendation({
    recommendationId: CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
    originatingExecutive: "business-intelligence",
    title: "Establish one verified Concierge conversion signal",
    plainLanguageExplanation: `Root Concierge conversion-measurement issue (Decision effect: ${decisionEffect}). Supporting observations: ${observedSummary}. Supporting finding IDs: ${supportingIds.join(", ")}.`,
    whyItMattersNow:
      "Without one verified Concierge conversion signal, Agent OS cannot separate engagement from consultation requests, and Opportunity paid/remarketing readiness stays gated.",
    proposedAction:
      "Define one authoritative reporting conversion for successful Concierge submission; verify which repository candidate (for example generate_lead or concierge_form_submitted) reliably represents acceptance; retain earlier-stage events such as concierge_form_started and consultation_cta_clicked for funnel diagnosis. Do not delete or replace events in this pass.",
    expectedUpside:
      strongest.likelyDecisionImpact ||
      "Restores trustworthy conversion evidence for channel and Opportunity decisions",
    effortEstimate: "medium",
    urgency: decisionEffect === "decision-blocking" ? "critical" : "high",
    reversibility: "easily-reversed",
    baseConfidence: confidence,
    evidence: [
      createEvidence({
        source: "ga4",
        sourceType: "analytics",
        collectedAt,
        reportingPeriod,
        metricOrObservation: observedSummary.slice(0, 240),
        priorComparison: supportNotes[0]?.slice(0, 160) ?? null,
        reliability: cluster.some((f) => f.isInference) ? "unverified" : "reliable",
        supportingReference: CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
      }),
      ...cluster.slice(0, 3).map((f) =>
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
      "Repository instrumentation lists candidate conversion events — not automatic proof of the sole correct production key event",
      "Earlier-stage Concierge events should remain for funnel diagnosis",
      ...(cluster.some((f) => f.isInference)
        ? ["Includes cautious inference — verify before irreversible changes"]
        : []),
    ],
    risks: [
      "Do not infer revenue, lead value, or ROI from engagement proxies",
      "Unknown or unread metrics are not proof of broken tracking or user abandonment",
      ...(sampleSize > 0 && sampleSize < 40
        ? ["Sample size may amplify percentage swings"]
        : []),
    ],
    dependencies: [
      "Designate and verify one authoritative Concierge reporting conversion",
    ],
    missingDependencies: [
      "Blocks opportunity until measurement prerequisite closes",
    ],
    approvalRequired: false,
    suggestedOwner: "Founder / analytics",
    rankingFactors: {
      expectedBusinessImpact: decisionEffect === "decision-blocking" ? 9 : 7,
      strategicAlignment: decisionEffect === "decision-blocking" ? 10 : 8,
      dataQuality: confidence >= 0.75 ? 8 : 5,
      dependencyReadiness: 3,
    },
  });
}

function findingToRecommendation(
  f: MeasurementFinding,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const impact =
    f.decisionEffect === "decision-blocking"
      ? 9
      : f.decisionEffect === "decision-degrading"
        ? 7
        : 3;

  const urgency =
    f.decisionEffect === "decision-blocking"
      ? ("critical" as const)
      : f.severity === "high"
        ? ("high" as const)
        : f.severity === "medium"
          ? ("medium" as const)
          : ("low" as const);

  return buildRecommendation({
    recommendationId: buildMeasurementRecommendationId(f.id),
    originatingExecutive: "business-intelligence",
    title: f.title,
    plainLanguageExplanation: `${f.expectedEvidence}. Observed: ${f.observedEvidence}. Decision effect: ${f.decisionEffect}.`,
    whyItMattersNow: f.whyItMatters,
    proposedAction: f.recommendedNextAction,
    expectedUpside: f.likelyDecisionImpact,
    effortEstimate:
      f.codeOrConfigChangeEventuallyRequired &&
      f.decisionEffect === "decision-blocking"
        ? "medium"
        : "low",
    urgency,
    reversibility: "easily-reversed",
    baseConfidence: f.confidence,
    evidence: [
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
    ],
    assumptions: [
      "Expected instrumentation is repository evidence, not proof of production firing",
      ...(f.isInference
        ? ["Finding includes cautious inference — verify before irreversible changes"]
        : []),
    ],
    risks: [
      "Do not infer revenue, lead value, or ROI from engagement proxies",
      "Missing observed activity is not automatic proof of user abandonment",
      ...(f.sampleSize !== null && f.sampleSize < 40
        ? ["Sample size may amplify percentage swings"]
        : []),
    ],
    dependencies: f.dependency ? [f.dependency] : [],
    missingDependencies: f.blocksOtherExecutive
      ? [
          `Blocks ${f.blockedExecutive ?? "downstream"} until measurement prerequisite closes`,
        ]
      : [],
    approvalRequired: f.founderApprovalRequired,
    suggestedOwner: f.owner,
    rankingFactors: {
      expectedBusinessImpact: impact,
      strategicAlignment: f.decisionEffect === "decision-blocking" ? 10 : 8,
      dataQuality: f.confidence >= 0.75 ? 8 : 5,
      dependencyReadiness: f.blocksOtherExecutive ? 3 : 7,
    },
    agendaBucket:
      f.decisionEffect === "monitor" ? ("ignore" as const) : undefined,
  });
}

/**
 * Soft-dedupe measurement recs against legacy BI heuristic IDs that cover the same ground.
 * Do not swallow decision-blocking conversion integrity findings.
 */
export function dedupeMeasurementAgainstLegacyBi(
  measurementRecs: Recommendation[],
  legacyRecs: Recommendation[],
): Recommendation[] {
  const hasTrackingHeuristic = legacyRecs.some(
    (l) => l.recommendationId === "bi-verify-tracking-before-decline",
  );
  const hasStudioCtaHeuristic = legacyRecs.some(
    (l) => l.recommendationId === "bi-studio-cta-divergence",
  );

  return measurementRecs.map((rec) => {
    if (rec.recommendationId === CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID) {
      return rec;
    }

    const isDecisionBlocking = /Decision effect: decision-blocking/i.test(
      rec.plainLanguageExplanation,
    );
    if (isDecisionBlocking) return rec;

    const overlapsTracking =
      hasTrackingHeuristic &&
      /possible.*regression|verify measurement before/i.test(rec.title);

    const overlapsStudioCta =
      hasStudioCtaHeuristic &&
      /studio engagement vs consultation|tool-to-concierge/i.test(rec.title);

    if (overlapsTracking || overlapsStudioCta) {
      return {
        ...rec,
        status: "consolidated" as const,
        agendaBucket: "ignore" as const,
        priorityScore: 0,
        blockedReasons: [
          ...(rec.blockedReasons ?? []),
          "Deduped against existing BI recommendation covering the same measurement ground",
        ],
      };
    }
    return rec;
  });
}

export function buildMeasurementVolumeFunnel(input: {
  inventoryLength: number;
  observed: number;
  notObserved: number;
  unknown: number;
  findings: MeasurementFinding[];
  recommendations: Recommendation[];
}): MeasurementVolumeFunnel {
  const monitorDeferred = input.findings.filter(
    (f) =>
      f.suppressRecommendation ||
      f.decisionEffect === "monitor" ||
      f.type === "measurement-healthy",
  ).length;
  const qualified = input.findings.filter(
    (f) =>
      !f.suppressRecommendation &&
      f.type !== "measurement-healthy" &&
      f.decisionEffect !== "monitor",
  ).length;
  const ranked = input.recommendations.filter(
    (r) => r.status !== "consolidated" && r.status !== "ignore",
  );
  const surfacedEligible = ranked.filter(
    (r) =>
      r.agendaBucket !== "ignore" &&
      r.rankingFactors.expectedBusinessImpact >= 4,
  );

  return {
    expectedEventsInventoried: input.inventoryLength,
    observedEvents: input.observed,
    notObservedEvents: input.notObserved,
    unknownEvents: input.unknown,
    rawFindings: input.findings.length,
    qualifiedFindings: qualified,
    monitorDeferredFindings: monitorDeferred,
    rankedBiRecommendations: ranked.length,
    surfacedEligibleBiRecommendations: surfacedEligible.length,
  };
}
