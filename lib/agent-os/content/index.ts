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
import { buildContentOpportunityId, buildContentRecommendationId } from "./ids";
import type { ContentFormat, ContentOpportunity } from "./types";
import {
  contentRoiDataGap,
  emptyContentRoiSnapshot,
  MAX_FOUNDER_FACING_CONTENT_ROI,
  runContentRoiGuarded,
  runContentRoiPrioritizer,
  type ContentRoiSnapshot,
  type RunContentRoiOptions,
} from "./roi";
import { assessBrandFit } from "./brand-fit";
import {
  authoritySnapshotToOpportunities,
  emptyAuthoritySnapshot,
  isOrdinaryEditorialOpportunityType,
  runAuthoritySpecialist,
  type AuthoritySnapshot,
  type RunAuthorityOptions,
} from "./authority";

export type ContentExecutiveOutput = {
  recommendations: Recommendation[];
  opportunities: ContentOpportunity[];
  dataGaps: DataGap[];
  facts: string[];
  inferences: string[];
  inventory: ReturnType<typeof inspectContentInventory>;
  /** Editorial ROI snapshot — inspectable; founder brief stays capped */
  contentRoi: ContentRoiSnapshot;
  /** Authority specialist — Case Study pipeline + current outreach wave */
  authority: AuthoritySnapshot;
};

export type RunContentOptions = {
  search?: SearchStrategyOutput;
  bi?: BusinessIntelligenceOutput;
  contentRoiOptions?: Pick<
    RunContentRoiOptions,
    "weights" | "founderFacingLimit" | "forceFailureAt" | "fanOutRunOptions"
  >;
  /** Test/ops override for Authority specialist. Production omits this. */
  authorityOptions?: RunAuthorityOptions;
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

  const authority = runAuthoritySpecialist(options.authorityOptions);
  facts.unshift(...authority.facts);
  inferences.push(...authority.inferences);

  if (authority.caseStudies.inventoryState === "empty") {
    dataGaps.push({
      id: "gap-content-authority-case-study-inventory",
      sourceId: "weekly-intelligence",
      description:
        "No founder-affirmed Case Study inventory is connected for Content Authority",
      impactOnRecommendations:
        "Next Case Study cannot be selected; founder input is required. Conversations are not substituted.",
      suggestedRemedy:
        "Affirm at least one Case Study on the Authority ledger before treating production as operational",
    });
  }

  const contentRoi = runContentRoiGuarded(() =>
    runContentRoiPrioritizer({
      fanOutCoverage: options.search?.fanOutCoverage,
      ...options.contentRoiOptions,
    }),
  );

  if (contentRoi.status === "ok") {
    facts.push(...contentRoi.facts);
    inferences.push(...contentRoi.inferences);
  } else if (contentRoi.status === "failed") {
    facts.push(...contentRoi.facts);
    inferences.push(...contentRoi.inferences);
    dataGaps.push(contentRoiDataGap(contentRoi));
  }

  const detected = detectContentOpportunities({
    inventory,
    searchOpportunities: searchOpps,
    biRecommendations: biRecs,
    bufferAvailable,
    socialPerformanceAvailable,
  });

  const roiOpps =
    contentRoi.status === "ok"
      ? contentRoi.founderFacingPackages
          .map((pkg) => editorialPackageToOpportunity(pkg))
          .filter((o) => o.brandFitOk)
      : [];

  const authorityOpps = authoritySnapshotToOpportunities(authority);

  const opportunities = applyCaseStudyFounderNowPrecedence(
    dedupeOpportunities([...authorityOpps, ...roiOpps, ...detected]),
    authority.caseStudyFounderNow,
  ).slice(0, 14 + MAX_FOUNDER_FACING_CONTENT_ROI + authorityOpps.length);

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
    contentRoi,
    authority,
  };
}

function mapRoiFormatToContentFormat(
  format: string,
): ContentFormat {
  switch (format) {
    case "conversation":
      return "founder-conversation";
    case "short-form-series":
      return "short-form-clip";
    case "carousel":
      return "carousel";
    case "newsletter":
      return "newsletter-section";
    case "faq-cluster":
      return "faq-extraction";
    case "diamond-guide-flagship":
    case "post-purchase-guide":
    case "local-landing-enhancement":
      return "guide-enhancement";
    default:
      return "caption";
  }
}

function editorialPackageToOpportunity(
  pkg: ContentRoiSnapshot["founderFacingPackages"][number],
): ContentOpportunity {
  const recommendedFormat = mapRoiFormatToContentFormat(pkg.primaryFormat);
  const base = {
    id: buildContentOpportunityId({
      source: "roi",
      type: "editorial-roi-package",
      subject: pkg.id.replace(/^content-roi:/, "").slice(0, 80),
      format: recommendedFormat,
    }),
    type: "editorial-roi-package" as const,
    title: `Editorial ROI: ${pkg.workingTitle}`,
    whyItMatters: pkg.whyItMattersToHourglass,
    recommendedAction: `Plan ${pkg.primaryFormat} package after reserved Conversation cycles — outline only (ROI ${pkg.overallRoi}). Do not publish from Agent OS.`,
    recommendedFormat,
    formatRationale: pkg.reasoningSummary,
    topicOrItem: pkg.id,
    targetAudience: "engagement-buyers" as const,
    funnelStage:
      pkg.primaryFormat === "post-purchase-guide"
        ? ("post-purchase" as const)
        : pkg.primaryFormat === "local-landing-enhancement"
          ? ("decision" as const)
          : ("consideration" as const),
    sourceMaterial: "Content ROI prioritizer + Fan-Out coverage",
    supportingIdeaAreas: pkg.supportingQuestionAngles.slice(0, 5),
    hookDirection: pkg.shortFormHooks[0] ?? undefined,
    audienceQuestion: pkg.coreBuyerQuestion,
    clipTerritories: pkg.shortFormHooks.slice(0, 3),
    confidence: 0.8,
    likelyImpact: Math.min(10, Math.max(1, Math.round(pkg.overallRoi / 10))),
    effort: pkg.productionEffort,
    urgency: "medium" as const,
    dependency: "Complete reserved three Conversation cycles first",
    approvalRequired: true,
    supportingReference: `content/roi#${pkg.id}`,
    evidenceNotes: [
      ...pkg.scoreBreakdown.evidence.slice(0, 4),
      `overallRoi=${pkg.overallRoi}`,
      `primaryFormat=${pkg.primaryFormat}`,
      `Founder-facing Content ROI cap=${MAX_FOUNDER_FACING_CONTENT_ROI}`,
    ],
    performanceInferred: true,
    isInference: true,
  };
  const fit = assessBrandFit(
    `${base.title} ${base.recommendedAction} ${base.hookDirection ?? ""}`,
  );
  return {
    ...base,
    brandFitOk: fit.ok,
    brandFitNotes: fit.notes,
  };
}

/**
 * While Case Study production is founder-now, ordinary Conversation / ROI
 * opportunities remain inspectable but must not compete as the daily agenda.
 */
function applyCaseStudyFounderNowPrecedence(
  opps: ContentOpportunity[],
  caseStudyFounderNow: boolean,
): ContentOpportunity[] {
  if (!caseStudyFounderNow) return opps;
  return opps.map((o) => {
    if (!isOrdinaryEditorialOpportunityType(o.type)) return o;
    return {
      ...o,
      urgency: "low" as const,
      likelyImpact: Math.min(o.likelyImpact, 4),
      evidenceNotes: [
        ...o.evidenceNotes,
        "Demoted while Case Study production is founder-now — watch/background evidence only",
      ],
    };
  });
}

function dedupeOpportunities(
  opps: ContentOpportunity[],
): ContentOpportunity[] {
  const seen = new Set<string>();
  const out: ContentOpportunity[] = [];
  for (const o of opps) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
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
    contentRoi: emptyContentRoiSnapshot("unavailable"),
    authority: emptyAuthoritySnapshot(false),
  };
}
