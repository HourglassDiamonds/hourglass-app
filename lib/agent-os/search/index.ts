/**
 * Search Strategy executive — operational in Agent OS V1.
 *
 * SERVER ONLY for live GSC paths; repository authority inspection is read-only.
 */

import type { AgentOsDataBundle } from "../adapters/types";
import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import { assertOperationalForRecommendations } from "../registry";
import { proposedActionImpliesWrite } from "../permissions";
import type { DataGap, Recommendation } from "../types";
import { detectGscOpportunities } from "./opportunities";
import { inspectGuideAuthority } from "./guide-authority";
import { buildSearchRecommendationId } from "./ids";
import type { SearchOpportunity } from "./types";

export type SearchStrategyOutput = {
  recommendations: Recommendation[];
  opportunities: SearchOpportunity[];
  dataGaps: DataGap[];
  facts: string[];
  inferences: string[];
  guideAuthority: ReturnType<typeof inspectGuideAuthority>;
};

export function runSearchStrategy(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
): SearchStrategyOutput {
  assertOperationalForRecommendations("search-strategy");

  const dataGaps: DataGap[] = [];
  const facts: string[] = [];
  const inferences: string[] = [];

  const gscAvailable =
    bundle.gsc.ok &&
    bundle.gsc.data?.current != null &&
    bundle.gsc.health.retrievalState !== "failed" &&
    bundle.gsc.health.retrievalState !== "not-configured";

  if (!gscAvailable) {
    dataGaps.push({
      id: "gap-search-gsc",
      sourceId: "gsc",
      description: "Google Search Console unavailable or empty for Search Strategy",
      impactOnRecommendations:
        "No GSC-derived query/CTR/position findings will be fabricated",
      suggestedRemedy:
        bundle.gsc.health.errors[0] ??
        "Configure GSC_SITE_URL and webmasters.readonly OAuth",
    });
  } else {
    facts.push(
      `GSC clicks ${bundle.gsc.data!.current!.totals.clicks}; impressions ${bundle.gsc.data!.current!.totals.impressions}`,
    );
  }

  // GBP always explicit
  dataGaps.push({
    id: "gap-search-gbp",
    sourceId: "gbp",
    description: "Google Business Profile metrics unavailable",
    impactOnRecommendations:
      "Local findings use GSC + repository only — no GBP pack/review claims",
    suggestedRemedy: bundle.gbp.health.errors[0] ?? "No verified GBP adapter",
  });

  const gscOpps = detectGscOpportunities(bundle.gsc.data, {
    available: Boolean(gscAvailable),
  });

  const guideAuthority = inspectGuideAuthority();
  facts.push(
    `Diamond Guide registry: ${guideAuthority.articleCount} articles across ${guideAuthority.hubSegments.length} hubs`,
  );
  facts.push(
    `Charlotte Guides articles: ${guideAuthority.charlotteGuideCount}; hub mapped: ${guideAuthority.charlotteHubMapped}`,
  );
  facts.push(
    `FAQ-schema articles: ${guideAuthority.articlesWithFaqSchema}; tool-handoff articles: ${guideAuthority.articlesWithToolHandoff}`,
  );

  if (guideAuthority.opportunities.some((o) => o.type === "geo-readiness-gap")) {
    inferences.push(
      "GEO readiness scores are editorial readiness signals, not confirmed AI citations or rankings",
    );
  }

  const opportunities = [...gscOpps, ...guideAuthority.opportunities];

  const collectedAt =
    bundle.gsc.data?.fetchedAt ?? new Date().toISOString();

  const recommendations = opportunities
    .map((opp) => opportunityToRecommendation(opp, reportingPeriod, collectedAt))
    .filter((r) => !proposedActionImpliesWrite(r.proposedAction));

  return {
    recommendations,
    opportunities,
    dataGaps,
    facts,
    inferences,
    guideAuthority,
  };
}

function opportunityToRecommendation(
  opp: SearchOpportunity,
  reportingPeriod: { start: string; end: string },
  collectedAt: string,
): Recommendation {
  const sourceType =
    opp.supportingReference.startsWith("gsc") ||
    opp.supportingReference.includes("gsc.")
      ? ("search" as const)
      : ("internal-report" as const);

  const source =
    sourceType === "search" ? "gsc" : "repository-guide-authority";

  const expectedUpside =
    sourceType === "search"
      ? `Improve CTR/position clarity for ${opp.queryOrPage} where Search Console already shows demand`
      : `Strengthen repository authority structure for ${opp.queryOrPage} (no traffic impact claimed without GSC)`;

  return buildRecommendation({
    recommendationId: buildSearchRecommendationId(opp.id),
    originatingExecutive: "search-strategy",
    title: `[Search Strategy] ${opp.title}`,
    plainLanguageExplanation: `${opp.metric}: ${opp.currentValue}. ${opp.evidenceNotes[0] ?? ""}`.trim(),
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
        metricOrObservation: `${opp.type}: ${opp.metric}=${opp.currentValue}`,
        priorComparison: opp.comparisonValue ?? null,
        reliability: opp.isInference ? "unverified" : "reliable",
        supportingReference: opp.supportingReference,
      }),
    ],
    assumptions: [
      ...(opp.isInference
        ? ["Includes inference — not a direct measured claim"]
        : []),
      "Read-only recommendation; founder/editorial implements any site change",
    ],
    risks: [
      ...(opp.sampleSize < 200 ? ["Small sample size — confidence reduced"] : []),
      "Do not forecast revenue from impressions",
    ],
    dependencies: opp.dependency ? [opp.dependency] : [],
    approvalRequired: opp.approvalRequired,
    suggestedOwner: "Founder / Search Strategy",
    rankingFactors: {
      expectedBusinessImpact: opp.likelyImpact,
      strategicAlignment: 8,
    },
  });
}

/** Test helper: empty healthy Search Strategy output */
export function emptySearchStrategyOutput(): SearchStrategyOutput {
  return {
    recommendations: [],
    opportunities: [],
    dataGaps: [],
    facts: [],
    inferences: [],
    guideAuthority: inspectGuideAuthority([]),
  };
}
