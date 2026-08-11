/**
 * Narrow Chief of Staff live operational input for overdue Concierge SLA.
 * Must outrank ordinary sprint work and bypass terminal recommendation suppression.
 */

import type { Recommendation } from "@/lib/agent-os/types";
import { CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID } from "./types";

export function isConciergeSlaOverdueRecommendationId(id: string): boolean {
  return id === CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID;
}

export function buildConciergeSlaOverdueRecommendation(
  overdueCount: number,
): Recommendation | null {
  if (!Number.isFinite(overdueCount) || overdueCount <= 0) return null;

  const countLabel =
    overdueCount === 1
      ? "1 Concierge inquiry is"
      : `${overdueCount} Concierge inquiries are`;

  return {
    recommendationId: CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
    originatingExecutive: "chief-of-staff",
    title: "Overdue Concierge first-contact SLA",
    plainLanguageExplanation: `Immediate attention: ${countLabel} beyond the 24-hour response window.`,
    whyItMattersNow:
      "The website promises a response within 24 hours. An unresolved Concierge lead is live revenue risk.",
    proposedAction:
      "Open the overdue Concierge HubSpot deal, make confirmed first contact, and mark the Concierge SLA task COMPLETED.",
    expectedUpside: "Protect inbound revenue and the Concierge response promise.",
    effortEstimate: "low",
    urgency: "critical",
    reversibility: "easily-reversed",
    confidence: 1,
    evidence: [
      {
        source: "hubspot-aggregates",
        sourceType: "crm",
        collectedAt: new Date().toISOString(),
        reportingPeriod: { start: "live", end: "live" },
        metricOrObservation: `${overdueCount} open Concierge SLA obligation(s) past due`,
        freshness: "fresh",
        reliability: "reliable",
        supportingReference: "concierge_sla_obligations",
        redactionStatus: "clean",
      },
    ],
    assumptions: [
      "Canonical first contact is HubSpot Concierge SLA task COMPLETED.",
    ],
    risks: [
      "Delaying contact after the promised window damages trust and conversion.",
    ],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    status: "proposed",
    agendaBucket: "do-now",
    rankingFactors: {
      expectedBusinessImpact: 10,
      confidence: 1,
      urgency: 10,
      effort: 2,
      reversibility: 9,
      strategicAlignment: 10,
      dependencyReadiness: 1,
      dataQuality: 1,
    },
    // Extremely high so it outranks SEO/content/marketing/polish/research.
    priorityScore: 1_000_000,
  };
}

/**
 * Force-include live overdue Concierge SLA into the founder surface pool
 * before recurrence / Client Attention caps can hide it.
 */
export function injectConciergeSlaOverdueIntoSurfacePool(input: {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
  overdueCount: number;
}): {
  recommendations: Recommendation[];
  surfacePool: Recommendation[];
  overdueRecommendation: Recommendation | null;
} {
  const overdue = buildConciergeSlaOverdueRecommendation(input.overdueCount);
  if (!overdue) {
    return {
      recommendations: input.recommendations,
      surfacePool: input.surfacePool,
      overdueRecommendation: null,
    };
  }

  const without = input.recommendations.filter(
    (r) => !isConciergeSlaOverdueRecommendationId(r.recommendationId),
  );
  const recommendations = [overdue, ...without];

  const poolWithout = input.surfacePool.filter(
    (r) => !isConciergeSlaOverdueRecommendationId(r.recommendationId),
  );
  const surfacePool = [overdue, ...poolWithout];

  return { recommendations, surfacePool, overdueRecommendation: overdue };
}
