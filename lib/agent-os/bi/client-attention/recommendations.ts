/**
 * Convert ranked Client Attention signals into BI recommendations.
 */

import { createEvidence } from "../../evidence";
import { buildRecommendation } from "../../recommendation";
import type { Recommendation } from "../../types";
import type {
  ClientAttentionSignal,
  RankedClientAttentionSignal,
} from "./types";
import { CLIENT_ATTENTION_RECOMMENDATION_PREFIX } from "./types";

export function clientAttentionToRecommendations(
  ranked: RankedClientAttentionSignal[],
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation[] {
  return ranked
    .filter((r) => r.signal.founderRankable !== false)
    .filter((r) => r.signal.signalType !== "buyer-concern-pattern" || r.signal.urgency !== "low" || r.totalScore >= 40)
    .map((r) => signalToRecommendation(r, reportingPeriod, collectedAt));
}

function signalToRecommendation(
  ranked: RankedClientAttentionSignal,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const signal = ranked.signal;
  const name = signal.displayName || "A client";
  const title = `${name} — ${titleForType(signal)}`;

  const urgencyScore =
    signal.urgency === "critical"
      ? 10
      : signal.urgency === "high"
        ? 8
        : signal.urgency === "medium"
          ? 5
          : 2;
  const confidence =
    signal.confidence === "high" ? 0.85 : signal.confidence === "medium" ? 0.65 : 0.4;

  return buildRecommendation({
    recommendationId: signal.id.startsWith(CLIENT_ATTENTION_RECOMMENDATION_PREFIX)
      ? signal.id
      : `${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:${signal.signalType}:${signal.subjectKey}`,
    originatingExecutive: "business-intelligence",
    title,
    plainLanguageExplanation: signal.summary,
    whyItMattersNow: signal.whyItMatters,
    proposedAction: signal.recommendedAction,
    expectedUpside: "Protect a live client conversation and keep Concierge response trust.",
    effortEstimate: "low",
    urgency: signal.urgency,
    reversibility: "easily-reversed",
    baseConfidence: confidence,
    evidence: signal.evidence.slice(0, 3).map((ev) =>
      createEvidence({
        source: "hubspot-aggregates",
        sourceType: "crm",
        collectedAt,
        reportingPeriod,
        metricOrObservation: ev.observation,
        reliability: ev.reliability === "reliable" ? "reliable" : "degraded",
        supportingReference: `${ev.kind}`,
        redactionStatus: "redacted",
      }),
    ),
    assumptions: [
      "Source adapters may be fixture or partial; corroboration raises confidence.",
      ranked.outranksReason || "Ranked by Client Attention founder-value model.",
    ],
    risks: [
      "Do not paste private email bodies or CRM identifiers into founder copy.",
    ],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Justin",
    status: "proposed",
    agendaBucket: signal.urgency === "critical" || signal.urgency === "high" ? "do-now" : "schedule-next",
    rankingFactors: {
      expectedBusinessImpact: Math.min(10, Math.round(ranked.totalScore / 8)),
      confidence,
      urgency: urgencyScore,
      effort: 3,
      reversibility: 8,
      strategicAlignment: 8,
      dependencyReadiness: 1,
      dataQuality: confidence,
    },
  });
}

function titleForType(signal: ClientAttentionSignal): string {
  switch (signal.signalType) {
    case "new-inquiry":
      return "new Concierge inquiry awaiting reply";
    case "reply-overdue":
      return "reply overdue";
    case "unanswered-inbound":
      return "unanswered inbound email";
    case "stalled-conversation":
      return "stalled conversation";
    case "follow-up-due":
      return "follow-up due";
    case "proposal-date-approaching":
      return "proposal date approaching";
    case "appointment-approaching":
      return "appointment approaching";
    case "deal-stage-risk":
      return "deal-stage risk";
    case "missing-next-step":
      return "missing next step";
    case "client-milestone":
      return "client milestone";
    case "data-discrepancy":
      return "data discrepancy needs a decision";
    case "buyer-concern-pattern":
      return "recurring buyer concern";
    default:
      return "needs attention";
  }
}

export function isClientAttentionRecommendationId(id: string): boolean {
  return id.startsWith(`${CLIENT_ATTENTION_RECOMMENDATION_PREFIX}:`);
}
