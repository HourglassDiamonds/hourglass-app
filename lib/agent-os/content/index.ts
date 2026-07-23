/**
 * Content Executive — operational in Agent OS V1.
 *
 * SERVER ONLY for runs that also load BI/Search adapters.
 * Repository inventory inspection is read-only and deployment-safe.
 */

import type { AgentOsDataBundle } from "../adapters/types";
import type { BusinessIntelligenceOutput } from "../executives/business-intelligence";
import type { SearchStrategyOutput } from "../executives/search-strategy";
import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import { assertOperationalForRecommendations } from "../registry";
import { proposedActionImpliesWrite } from "../permissions";
import type { DataGap, Recommendation } from "../types";
import { inspectContentInventory } from "./inventory";
import { detectContentOpportunities } from "./opportunities";
import { buildContentRecommendationId } from "./ids";
import type { ContentOpportunity } from "./types";

export type ContentExecutiveOutput = {
  recommendations: Recommendation[];
  opportunities: ContentOpportunity[];
  dataGaps: DataGap[];
  facts: string[];
  inferences: string[];
  inventory: ReturnType<typeof inspectContentInventory>;
};

export type RunContentOptions = {
  search?: SearchStrategyOutput;
  bi?: BusinessIntelligenceOutput;
};

export function runContentExecutive(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
  options: RunContentOptions = {},
): ContentExecutiveOutput {
  assertOperationalForRecommendations("content");

  const dataGaps: DataGap[] = [];
  const facts: string[] = [];
  const inferences: string[] = [];

  const bufferAvailable =
    bundle.buffer.ok && bundle.buffer.health.retrievalState === "ok";
  const socialPerformanceAvailable = bufferAvailable;

  const inventory = inspectContentInventory(undefined, {
    socialAdapterAvailable: socialPerformanceAvailable,
    // No verified publication ledger connected in Agent OS V1
    publicationLedgerAvailable: false,
  });

  dataGaps.push({
    id: "gap-content-publication-inventory",
    sourceId: "buffer",
    description:
      "No verified social/publication inventory is connected for Content",
    impactOnRecommendations:
      "Publication and scheduling state cannot be reconciled; timing/sequence confidence is lowered; channel performance cannot be measured",
    suggestedRemedy:
      "Add a verified read-only publication ledger and/or Buffer adapter before treating publish order as operational fact",
  });

  facts.push(
    `Conversation episodes in registry: ${inventory.episodeCount} (registry material labels: ${inventory.registryLabeledDraftCount} draft, ${inventory.registryLabeledPublishedCount} published — not verified live publish counts)`,
  );
  facts.push(
    `Content inventory completeness: ${inventory.inventoryCompleteness}; publication coverage: unknown without verified ledger`,
  );
  facts.push(
    `Planned conversation topics: ${inventory.plannedTopicCount}; uncovered message territories: ${inventory.uncoveredTerritoryCount}`,
  );

  if (inventory.inventoryCompleteness === "partial") {
    inferences.push(
      "Publication/scheduling state is unknown — repository draft labels are material metadata only, not operational unpublished proof",
    );
  }

  const searchOpps = options.search?.opportunities ?? [];
  const biRecs = options.bi?.recommendations ?? [];

  const opportunities = detectContentOpportunities({
    inventory,
    searchOpportunities: searchOpps,
    biRecommendations: biRecs,
    bufferAvailable,
    socialPerformanceAvailable,
  });

  const collectedAt = new Date().toISOString();
  const recommendations = opportunities
    .map((opp) =>
      opportunityToRecommendation(opp, reportingPeriod, collectedAt),
    )
    .filter((r) => !proposedActionImpliesWrite(r.proposedAction));

  return {
    recommendations,
    opportunities,
    dataGaps,
    facts,
    inferences,
    inventory,
  };
}

function opportunityToRecommendation(
  opp: ContentOpportunity,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const sourceType =
    opp.supportingReference.includes("gsc") ||
    opp.evidenceNotes.some((n) => /search opportunity/i.test(n))
      ? ("search" as const)
      : opp.supportingReference.startsWith("bi-") ||
          opp.evidenceNotes.some((n) => /BI signal/i.test(n))
        ? ("analytics" as const)
        : ("internal-report" as const);

  const source =
    sourceType === "search"
      ? "gsc"
      : sourceType === "analytics"
        ? "ga4"
        : "repository-content-inventory";

  const expectedUpside = opp.performanceInferred
    ? `Clarify buyer decisions for ${opp.topicOrItem} (communication impact — not a traffic forecast)`
    : `Strengthen content system structure for ${opp.topicOrItem} (repository-backed; no traffic impact claimed)`;

  const plainExtras = [
    opp.audienceQuestion ? `Q: ${opp.audienceQuestion}` : null,
    `Audience=${opp.targetAudience}; funnel=${opp.funnelStage}; format=${opp.recommendedFormat}`,
    opp.formatRationale,
  ]
    .filter(Boolean)
    .join(". ");

  return buildRecommendation({
    recommendationId: buildContentRecommendationId(opp.id),
    originatingExecutive: "content",
    title: `[Content] ${opp.title}`,
    plainLanguageExplanation: plainExtras,
    whyItMattersNow: opp.whyItMatters,
    proposedAction: opp.recommendedAction,
    expectedUpside,
    effortEstimate: opp.effort,
    urgency: opp.urgency,
    reversibility: "easily-reversed",
    baseConfidence: opp.confidence,
    evidence: [
      createEvidence({
        source,
        sourceType,
        collectedAt,
        reportingPeriod,
        metricOrObservation: `${opp.type}: ${opp.topicOrItem}`,
        priorComparison: null,
        reliability: opp.isInference ? "unverified" : "reliable",
        supportingReference: opp.supportingReference,
      }),
    ],
    assumptions: [
      ...(opp.isInference ? ["Includes inference — not a direct measured claim"] : []),
      ...(opp.performanceInferred
        ? ["Performance impact is inferred — social metrics unavailable or unused"]
        : []),
      "Read-only recommendation; founder implements any filming/publishing",
      ...opp.brandFitNotes.slice(0, 1),
    ],
    risks: [
      "Do not publish or schedule from Agent OS",
      "Do not fabricate Buffer/social metrics",
      ...(opp.supportingIdeaAreas?.length
        ? ["Conversation map is strategic — not a finished script"]
        : []),
    ],
    dependencies: opp.dependency ? [opp.dependency] : [],
    approvalRequired: opp.approvalRequired,
    suggestedOwner: "Founder / Content",
    rankingFactors: {
      expectedBusinessImpact: opp.likelyImpact,
      strategicAlignment: 9,
    },
  });
}

export function emptyContentExecutiveOutput(): ContentExecutiveOutput {
  return {
    recommendations: [],
    opportunities: [],
    dataGaps: [],
    facts: [],
    inferences: [],
    inventory: inspectContentInventory([]),
  };
}
