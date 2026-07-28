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
import {
  emptyLocalAuthorityAudit,
  runLocalAuthorityIntelligence,
  GBP_ROOT_SOURCE_GAP_ID,
  type LocalAuthorityAudit,
} from "./local";
import {
  applyLocalAuthorityFounderRankingGate,
  consolidateLegacyWithLocalAuthority,
} from "./local/ranking-policy";
import type { SearchOpportunity } from "./types";
import {
  emptyFanOutCoverageSnapshot,
  fanOutCoverageDataGap,
  runFanOutCoverageAnalyzer,
  runFanOutCoverageGuarded,
  type FanOutCoverageSnapshot,
  type FanOutOpportunity,
  type RunFanOutCoverageOptions,
} from "./fan-out";

export type SearchStrategyOutput = {
  recommendations: Recommendation[];
  opportunities: SearchOpportunity[];
  dataGaps: DataGap[];
  facts: string[];
  inferences: string[];
  guideAuthority: ReturnType<typeof inspectGuideAuthority>;
  /** Local Authority / GBP Intelligence audit (V1 expansion). */
  localAuthority: LocalAuthorityAudit;
  /** AI Fan-Out Coverage Analyzer snapshot (question universe × content inventory). */
  fanOutCoverage: FanOutCoverageSnapshot;
};

export type RunSearchStrategyOptions = {
  mode?: "fixture" | "live";
  /**
   * Injectable fan-out runner (tests). Default runs the production analyzer.
   * Always executed inside a non-throwing guard so fan-out cannot abort Search Strategy.
   */
  runFanOutCoverage?: (
    options?: RunFanOutCoverageOptions,
  ) => FanOutCoverageSnapshot;
  /** Options forwarded to the fan-out runner (includes test forceFailureAt). */
  fanOutOptions?: RunFanOutCoverageOptions;
};

export function runSearchStrategy(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
  options: RunSearchStrategyOptions = {},
): SearchStrategyOutput {
  assertOperationalForRecommendations("search-strategy");

  const mode = options.mode ?? inferSearchMode(bundle);
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
      description:
        bundle.gsc.health.founderLabel ??
        "Search Console unavailable or empty for Search Strategy",
      impactOnRecommendations:
        "No GSC-derived query/CTR/position findings will be fabricated",
      suggestedRemedy:
        bundle.gsc.health.errors[0] ??
        "Configure GSC_SITE_URL and webmasters.readonly OAuth",
    });
  } else {
    const freshness = bundle.gsc.data?.freshness;
    facts.push(
      `GSC clicks ${bundle.gsc.data!.current!.totals.clicks}; impressions ${bundle.gsc.data!.current!.totals.impressions}`,
    );
    if (freshness?.newestFinalizedDate || freshness?.newestAvailableDate) {
      const finalized =
        freshness.newestFinalizedDate ?? freshness.newestAvailableDate;
      facts.push(
        `GSC newest finalized date ${finalized} (Pacific; age ${freshness.ageDays ?? "?"}d; ${freshness.lagClassification})`,
      );
    }
    if (
      bundle.gsc.health.healthCode === "stale-within-normal-delay" ||
      bundle.gsc.health.healthCode === "stale-unusual"
    ) {
      dataGaps.push({
        id: "gap-search-gsc-freshness",
        sourceId: "gsc",
        description:
          bundle.gsc.health.founderLabel ??
          "Search Console reporting delay within expected range",
        impactOnRecommendations:
          "Treat time-sensitive SEO claims with lag-adjusted confidence — not as an outage",
        suggestedRemedy: "Normal Search Console delay; no credential action required",
      });
    }
  }

  // Single GBP root source gap — not per-dimension flood
  dataGaps.push({
    id: GBP_ROOT_SOURCE_GAP_ID,
    sourceId: "gbp",
    description:
      "Google Business Profile metrics unavailable — root local-authority source gap",
    impactOnRecommendations:
      "Local findings use GSC + repository only — no GBP pack/review/call/direction claims; unknown dimensions stay in JSON",
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

  // Fan-out is an enhancement — guarded so unexpected throws cannot abort Search Strategy.
  const fanOutRunner =
    options.runFanOutCoverage ?? runFanOutCoverageAnalyzer;
  const fanOutCoverage = runFanOutCoverageGuarded(() =>
    fanOutRunner(options.fanOutOptions),
  );

  if (fanOutCoverage.status === "ok") {
    facts.push(...fanOutCoverage.facts);
    inferences.push(...fanOutCoverage.inferences);
  } else if (fanOutCoverage.status === "failed") {
    facts.push(...fanOutCoverage.facts);
    inferences.push(...fanOutCoverage.inferences);
    const gap = fanOutCoverageDataGap(fanOutCoverage);
    if (gap) dataGaps.push(gap);
  }
  // status === "unavailable": leave silent beyond snapshot metadata

  const fanOutSearchOpps =
    fanOutCoverage.status === "ok"
      ? fanOutOpportunitiesAsSearchOpportunities(
          fanOutCoverage.founderFacingOpportunities,
        )
      : [];

  const opportunities = [
    ...gscOpps,
    ...guideAuthority.opportunities,
    ...fanOutSearchOpps,
  ];

  const collectedAt =
    bundle.gsc.data?.fetchedAt ?? new Date().toISOString();

  const baseRecommendations = opportunities
    .map((opp) => opportunityToRecommendation(opp, reportingPeriod, collectedAt))
    .filter((r) => !proposedActionImpliesWrite(r.proposedAction));

  const localRun = runLocalAuthorityIntelligence({
    mode,
    bundle,
    reportingPeriod,
    guideAuthority,
    gscAvailable: Boolean(gscAvailable),
    existingSearchRecommendations: baseRecommendations,
  });

  facts.push(...localRun.audit.facts);
  inferences.push(...localRun.audit.inferences);

  // Emit local-intent SearchOpportunity mirrors so Content/Opportunity handoffs keep working
  const localHandoffOpps = localFindingsAsSearchOpportunities(
    localRun.audit.findings,
  );
  opportunities.push(...localHandoffOpps);

  const hasObservedLocalDemand = localRun.audit.findings.some(
    (f) =>
      f.evidenceClass === "observed" &&
      !f.suppressRecommendation &&
      (f.type === "local-near-page-one" ||
        f.type === "local-high-impression-low-ctr" ||
        f.type === "local-query-page-mismatch"),
  );

  const merged = [
    ...baseRecommendations,
    ...localRun.recommendations.filter(
      (r) => !proposedActionImpliesWrite(r.proposedAction),
    ),
  ];

  const recommendations = applyLocalAuthorityFounderRankingGate(
    consolidateLegacyWithLocalAuthority(merged),
    {
      gscAvailable: Boolean(gscAvailable),
      hasObservedLocalDemand,
    },
  );

  return {
    recommendations,
    opportunities,
    dataGaps,
    facts,
    inferences,
    guideAuthority,
    localAuthority: localRun.audit,
    fanOutCoverage,
  };
}

function fanOutOpportunitiesAsSearchOpportunities(
  fanOutOpps: FanOutOpportunity[],
): SearchOpportunity[] {
  return fanOutOpps.map((opp) => ({
    id: opp.id,
    type: "fan-out-coverage-gap" as const,
    title: `Fan-out coverage gap: ${opp.question}`,
    whyItMatters: `${opp.whyCoverageWeak[0] ?? "Authority density gap"} Commercial ${opp.commercialValue}/10 · Authority ${opp.authorityValue}/10.`,
    recommendedAction: formatFanOutAction(opp),
    queryOrPage: opp.suggestedExistingPage ?? opp.question,
    metric: "fan-out-coverage-score",
    currentValue: `${opp.coverageScore} (${opp.coverageBand})`,
    comparisonValue: `priority ${opp.priorityScore}`,
    sampleSize: 1,
    classifications: (
      opp.geography === "charlotte" ||
      opp.geography === "waxhaw" ||
      opp.geography === "charlotte-metro"
        ? ["local", "informational"]
        : ["informational", "non-branded"]
    ) as SearchOpportunity["classifications"],
    isInference: true,
    confidence: 0.62,
    likelyImpact: Math.min(10, Math.round(opp.priorityScore / 10)),
    effort: opp.recommendedAction === "expand-existing-page" ? "low" : "medium",
    urgency: opp.audienceStage === "ready-to-contact" ? "medium" : "low",
    approvalRequired: false,
    supportingReference: `fan-out:${opp.questionId}`,
    evidenceNotes: [
      `Family ${opp.queryFamily}; stage ${opp.audienceStage}`,
      ...opp.priorityReasons.slice(0, 2),
      "Repository fan-out signal — not confirmed AI citation share",
    ],
  }));
}

function formatFanOutAction(opp: FanOutOpportunity): string {
  const cluster =
    opp.clusterRole === "flagship" && opp.flagshipTitle
      ? ` Flagship: “${opp.flagshipTitle}” covering ${opp.supportingQuestionIds.length} related gaps.`
      : opp.clusterRole === "supporting-faq" && opp.flagshipTitle
        ? ` Supporting FAQ under “${opp.flagshipTitle}” — avoid a competing thin page.`
        : "";
  const page = opp.suggestedExistingPage
    ? ` Prefer strengthening ${opp.suggestedExistingPage}.`
    : "";
  return `Fan-out recommendation: ${opp.recommendedAction.replace(/-/g, " ")} (${opp.recommendedFormat.replace(/-/g, " ")}).${cluster}${page} ${opp.whyCoverageWeak[0] ?? ""}`.trim();
}

function localFindingsAsSearchOpportunities(
  findings: LocalAuthorityAudit["findings"],
): SearchOpportunity[] {
  const out: SearchOpportunity[] = [];
  for (const f of findings) {
    // Handoff findings stay internal; Content keys off observed demand / hub diagnosis
    if (
      f.type === "local-authority-opportunity" ||
      f.type === "local-measurement-gap"
    ) {
      continue;
    }
    if (
      f.type !== "local-near-page-one" &&
      f.type !== "local-high-impression-low-ctr" &&
      f.type !== "local-hub-gap"
    ) {
      continue;
    }
    // Still emit opportunity mirrors for Content even when recommendation is suppressed
    // for repository-backed hub (Content may produce founder-facing production priority).
    if (
      f.type === "local-near-page-one" ||
      f.type === "local-high-impression-low-ctr" ||
      f.type === "local-hub-gap"
    ) {
      out.push({
        id: f.id,
        type: "local-intent-gap",
        title: f.title,
        whyItMatters: f.whyItMatters,
        recommendedAction: f.recommendedAction,
        queryOrPage: f.queryOrPage ?? f.route ?? f.geography,
        metric: f.type,
        currentValue: f.evidenceNotes[0] ?? f.evidenceClass,
        comparisonValue: null,
        sampleSize: f.sampleSize ?? 0,
        classifications: ["local", "non-branded"],
        isInference: f.isInference,
        confidence: f.confidence,
        likelyImpact: f.likelyImpact,
        effort: f.effort,
        urgency: f.urgency,
        dependency: f.dependency ?? undefined,
        approvalRequired: f.founderApprovalRequired,
        supportingReference: f.supportingReference,
        evidenceNotes: f.evidenceNotes,
      });
    }
  }
  return out;
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

function inferSearchMode(bundle: AgentOsDataBundle): "fixture" | "live" {
  if (
    bundle.gsc.health.retrievalState === "fixture" ||
    bundle.ga4.health.retrievalState === "fixture"
  ) {
    return "fixture";
  }
  return "live";
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
    localAuthority: emptyLocalAuthorityAudit(),
    fanOutCoverage: emptyFanOutCoverageSnapshot(),
  };
}
