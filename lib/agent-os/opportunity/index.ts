/**
 * Opportunity Executive — operational in Agent OS V1.
 *
 * Recommendation-only. Separates evidenceConfidence, strategicAttractiveness,
 * actionability, and recommendation priority.
 */

import type { AgentOsDataBundle } from "../adapters/types";
import type { BusinessIntelligenceOutput } from "../executives/business-intelligence";
import type { ContentExecutiveOutput } from "../executives/content";
import type { SearchStrategyOutput } from "../executives/search-strategy";
import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import { assertOperationalForRecommendations } from "../registry";
import { proposedActionImpliesWrite } from "../permissions";
import type { DataGap, Recommendation } from "../types";
import { buildOpportunityRecommendationId } from "./ids";
import {
  detectGrowthOpportunities,
  materialGrowthOpportunities,
} from "./opportunities";
import { collectOpportunitySignals } from "./signals";
import {
  opportunityIsSurfaceEligible,
  opportunityRankingAdjustments,
} from "./qualify";
import { inspectRepositoryStrategy } from "./strategy";
import type {
  GrowthOpportunity,
  OpportunityVolumeFunnel,
} from "./types";

export type OpportunityExecutiveOutput = {
  recommendations: Recommendation[];
  opportunities: GrowthOpportunity[];
  dataGaps: DataGap[];
  facts: string[];
  inferences: string[];
  strategy: ReturnType<typeof inspectRepositoryStrategy>;
  volumeFunnel: OpportunityVolumeFunnel;
};

export type RunOpportunityOptions = {
  search?: SearchStrategyOutput;
  content?: ContentExecutiveOutput;
  bi?: BusinessIntelligenceOutput;
  includeRejectedExamples?: boolean;
};

export function runOpportunityExecutive(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
  options: RunOpportunityOptions = {},
): OpportunityExecutiveOutput {
  assertOperationalForRecommendations("opportunity");

  const dataGaps: DataGap[] = [];
  const facts: string[] = [];
  const inferences: string[] = [];

  const gbpAvailable =
    bundle.gbp.ok && bundle.gbp.health.retrievalState === "ok";
  const bufferAvailable =
    bundle.buffer.ok && bundle.buffer.health.retrievalState === "ok";
  const hubspotAggregatesAvailable =
    bundle.hubspotAggregates.ok &&
    bundle.hubspotAggregates.health.retrievalState === "ok";

  const signalBundle = collectOpportunitySignals({
    search: options.search,
    content: options.content,
    bi: options.bi,
    gbpAvailable,
    bufferAvailable,
    hubspotAggregatesAvailable,
  });

  const strategy = signalBundle.strategy;

  dataGaps.push({
    id: "gap-opportunity-external-targets",
    sourceId: "weekly-intelligence",
    description:
      "No verified external opportunity adapter (partners, podcasts, publications, CPC, remarketing audiences)",
    impactOnRecommendations:
      "External targets/CPC/audiences unverified — research-required or measurement-blocked only",
    suggestedRemedy:
      "Keep internal synthesis + research labels until a verified read-only source exists",
  });

  if (!gbpAvailable) {
    dataGaps.push({
      id: "gap-opportunity-gbp",
      sourceId: "gbp",
      description: "GBP metrics unavailable for local visibility opportunities",
      impactOnRecommendations:
        "Local findings use GSC/repository only — no pack/review claims",
      suggestedRemedy: "Do not fabricate GBP metrics",
    });
  }

  if (!strategy.cpcEvidenceAvailable) {
    dataGaps.push({
      id: "gap-opportunity-cpc",
      sourceId: "ga4",
      description: "Paid-search cost (CPC) evidence unavailable",
      impactOnRecommendations:
        "Paid-search is readiness-only — missing CPC lowers actionability, not priority",
      suggestedRemedy: "Do not estimate CPC or cheap-traffic claims",
    });
  }

  if (!strategy.remarketingAudienceEvidenceAvailable) {
    dataGaps.push({
      id: "gap-opportunity-remarketing",
      sourceId: "ga4",
      description:
        "Remarketing audience size, consent, and config evidence unavailable",
      impactOnRecommendations:
        "Remarketing stays measurement-blocked (diagnostic confidence ≠ opportunity strength)",
      suggestedRemedy:
        "Verify audience/consent/config before any remarketing evaluation",
    });
  }

  const includeRejected = options.includeRejectedExamples === true;

  const opportunities = detectGrowthOpportunities({
    signals: signalBundle,
    includeRejectedExamples: includeRejected,
  });

  const material = materialGrowthOpportunities(opportunities);

  const collectedAt = new Date().toISOString();
  const recommendations = material
    .map((opp) =>
      opportunityToRecommendation(opp, reportingPeriod, collectedAt),
    )
    .filter((r) => !proposedActionImpliesWrite(r.proposedAction));

  const volumeFunnel: OpportunityVolumeFunnel = {
    rawSignals: signalBundle.signals.length,
    qualifiedFindings: opportunities.filter(
      (o) => !o.rejected && o.readiness !== "rejected",
    ).length,
    rejected: opportunities.filter(
      (o) => o.rejected || o.readiness === "rejected",
    ).length,
    alreadyCoveredOrDeferred: opportunities.filter(
      (o) =>
        o.readiness === "already-covered" ||
        o.readiness === "defer" ||
        o.readiness === "measurement-blocked" ||
        o.readiness === "research-required" ||
        o.readiness === "not-ready",
    ).length,
    rankedRecommendations: recommendations.length,
    surfaceEligible: opportunities.filter((o) =>
      opportunityIsSurfaceEligible(o),
    ).length,
  };

  facts.push(
    `Opportunity funnel: ${volumeFunnel.rawSignals} signals → ${volumeFunnel.qualifiedFindings} qualified → ${volumeFunnel.rankedRecommendations} ranked (${volumeFunnel.surfaceEligible} surface-eligible)`,
  );
  facts.push(
    `External targets verified: ${strategy.verifiedExternalTargetsAvailable}; CPC: ${strategy.cpcEvidenceAvailable}`,
  );

  inferences.push(
    "evidenceConfidence ≠ strategicAttractiveness ≠ actionability — diagnostic certainty does not raise blocked-item priority",
  );

  return {
    recommendations,
    opportunities,
    dataGaps,
    facts,
    inferences,
    strategy,
    volumeFunnel,
  };
}

function opportunityToRecommendation(
  opp: GrowthOpportunity,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const adj = opportunityRankingAdjustments(opp);

  const sourceType =
    opp.sourceExecutive === "search-strategy"
      ? ("search" as const)
      : opp.sourceExecutive === "business-intelligence"
        ? ("analytics" as const)
        : ("internal-report" as const);

  const source =
    sourceType === "search"
      ? "gsc"
      : sourceType === "analytics"
        ? "ga4"
        : "repository-opportunity-strategy";

  const reliability =
    opp.readiness === "measurement-blocked" ||
    opp.externalVerification === "source-gap"
      ? ("unverified" as const)
      : opp.isInference
        ? ("unverified" as const)
        : ("reliable" as const);

  const expectedUpside =
    opp.costClass === "unknown"
      ? `Readiness assessment for ${opp.type} (cost/ROI unknown — not estimated)`
      : `Compound qualified discovery or trust via ${opp.type} (not a revenue forecast)`;

  const impact = Math.round(adj.effectiveImpact);
  const alignment = Math.max(
    0,
    Math.min(10, Math.round(opp.strategicAttractiveness + adj.alignmentBoost)),
  );

  const effortEstimate =
    opp.readiness === "research-required"
      ? opp.effort === "low"
        ? "medium"
        : opp.effort
      : opp.effort;

  return buildRecommendation({
    recommendationId: buildOpportunityRecommendationId(opp.id),
    originatingExecutive: "opportunity",
    title: `[Opportunity] ${opp.title}`,
    plainLanguageExplanation: [
      `Readiness=${opp.readiness}`,
      `evidenceConfidence=${opp.evidenceConfidence.toFixed(2)}`,
      `strategicAttractiveness=${opp.strategicAttractiveness.toFixed(1)}`,
      `actionability=${opp.actionability.toFixed(2)}`,
      `verification=${opp.externalVerification}`,
      opp.additionalLeverage,
    ].join("; "),
    whyItMattersNow: opp.whyItMatters,
    proposedAction: opp.recommendedAction,
    expectedUpside,
    effortEstimate,
    urgency: opp.urgency,
    reversibility: opp.reversibility,
    // Ranking confidence is actionability-weighted — not raw diagnostic certainty
    baseConfidence: adj.rankingConfidence,
    evidence: [
      createEvidence({
        source,
        sourceType,
        collectedAt,
        reportingPeriod,
        metricOrObservation:
          opp.verifiedMetric ??
          `${opp.type}: ${opp.relatedQuery ?? opp.relatedPage ?? opp.type}`,
        priorComparison: opp.comparisonValue ?? null,
        reliability,
        supportingReference: opp.supportingReference,
      }),
    ],
    assumptions: [
      `evidenceConfidence=${opp.evidenceConfidence} (diagnostic; not opportunity strength)`,
      `strategicAttractiveness=${opp.strategicAttractiveness}; actionability=${opp.actionability}`,
      ...(opp.costClass === "unknown"
        ? ["Cost data unavailable — no CPC or ROI fabrication"]
        : []),
      ...(opp.externalVerification === "source-gap"
        ? ["External verification required"]
        : []),
      "Read-only recommendation",
    ],
    risks: [
      ...opp.disqualifyingRisks.slice(0, 3),
      "Do not fabricate external targets, audience size, or competitor weakness",
    ],
    dependencies: opp.dependency ? [opp.dependency] : [],
    approvalRequired: opp.approvalRequired,
    suggestedOwner: opp.owner,
    rankingFactors: {
      expectedBusinessImpact: impact,
      strategicAlignment: alignment,
    },
  });
}

export function emptyOpportunityExecutiveOutput(): OpportunityExecutiveOutput {
  return {
    recommendations: [],
    opportunities: [],
    dataGaps: [],
    facts: [],
    inferences: [],
    strategy: inspectRepositoryStrategy(),
    volumeFunnel: {
      rawSignals: 0,
      qualifiedFindings: 0,
      rejected: 0,
      alreadyCoveredOrDeferred: 0,
      rankedRecommendations: 0,
      surfaceEligible: 0,
    },
  };
}
