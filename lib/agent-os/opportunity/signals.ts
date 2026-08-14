/**
 * Internal opportunity-signal adapter.
 * Gathers eligible BI / Search / Content / repository signals.
 * Static + deterministic runtime inputs only — no web browsing, no writes,
 * no filesystem crawling, capped output, Vercel-Node safe.
 */

import type { BusinessIntelligenceOutput } from "../executives/business-intelligence";
import type { ContentExecutiveOutput } from "../executives/content";
import type { SearchStrategyOutput } from "../executives/search-strategy";
import type { ContentOpportunity } from "../content/types";
import type { SearchOpportunity } from "../search/types";
import type { Recommendation } from "../types";
import {
  inspectRepositoryStrategy,
  type RepositoryStrategySnapshot,
} from "./strategy";

export type OpportunitySignalKind =
  | "search-demand"
  | "search-local"
  | "search-technical"
  | "content-theme"
  | "content-production"
  | "bi-conversion"
  | "bi-measurement"
  | "repository-strategy";

export type NormalizedOpportunitySignal = {
  id: string;
  kind: OpportunitySignalKind;
  sourceExecutive: "business-intelligence" | "search-strategy" | "content" | "repository";
  sourceEvidenceId: string;
  title: string;
  summary: string;
  relatedQuery?: string | null;
  relatedPage?: string | null;
  relatedContent?: string | null;
  relatedTool?: string | null;
  geographyHint?: string | null;
  funnelHint?: string | null;
  confidence: number;
  likelyImpact: number;
  isTechnicalSeo: boolean;
  isContentProduction: boolean;
  isInference: boolean;
  supportingReference: string;
  evidenceNotes: string[];
};

export type OpportunitySignalBundle = {
  signals: NormalizedOpportunitySignal[];
  strategy: RepositoryStrategySnapshot;
  searchOpportunityIds: string[];
  contentOpportunityIds: string[];
  biRecommendationIds: string[];
  capped: boolean;
};

const MAX_SIGNALS = 40;

export type CollectOpportunitySignalsInput = {
  search?: SearchStrategyOutput;
  content?: ContentExecutiveOutput;
  bi?: BusinessIntelligenceOutput;
  gbpAvailable?: boolean;
  bufferAvailable?: boolean;
  hubspotAggregatesAvailable?: boolean;
};

/**
 * Deployment-safe internal adapter — never invokes external services.
 */
export function collectOpportunitySignals(
  input: CollectOpportunitySignalsInput,
): OpportunitySignalBundle {
  const strategy = inspectRepositoryStrategy({
    gbpAvailable: input.gbpAvailable,
    bufferAvailable: input.bufferAvailable,
    hubspotAggregatesAvailable: input.hubspotAggregatesAvailable,
  });

  const raw: NormalizedOpportunitySignal[] = [];

  for (const opp of input.search?.opportunities ?? []) {
    raw.push(normalizeSearchOpportunity(opp));
  }
  for (const opp of input.content?.opportunities ?? []) {
    raw.push(normalizeContentOpportunity(opp));
  }
  for (const rec of input.bi?.recommendations ?? []) {
    raw.push(normalizeBiRecommendation(rec));
  }

  // BI Opportunity handoff — measurement prerequisites without duplicating repair work
  const handoff = input.bi?.opportunityHandoff;
  if (handoff?.paidSearchMeasurementPrerequisiteMissing) {
    raw.push({
      id: "bi:handoff:paid-search-measurement-prerequisite",
      kind: "bi-measurement",
      sourceExecutive: "business-intelligence",
      sourceEvidenceId:
        handoff.measurementPrerequisites[0] ??
        "bi-paid-search-measurement-prerequisite",
      title: "Paid-search measurement prerequisite missing",
      summary:
        "BI reports authoritative conversion measurement is not verified — paid search stays gated",
      confidence: 0.85,
      likelyImpact: 8,
      isTechnicalSeo: false,
      isContentProduction: false,
      isInference: false,
      supportingReference: "bi.opportunityHandoff",
      evidenceNotes: handoff.notes.slice(0, 3),
    });
  }
  if (!handoff?.remarketingAudienceEvidenceAvailable) {
    raw.push({
      id: "bi:handoff:remarketing-audience-missing",
      kind: "bi-measurement",
      sourceExecutive: "business-intelligence",
      sourceEvidenceId: "bi-remarketing-audience-consent",
      title: "Remarketing audience/consent evidence unavailable",
      summary:
        "BI handoff: no verified audience or consent evidence for remarketing readiness",
      confidence: 0.9,
      likelyImpact: 3,
      isTechnicalSeo: false,
      isContentProduction: false,
      isInference: false,
      supportingReference: "bi.opportunityHandoff",
      evidenceNotes: [
        "remarketingAudienceEvidenceAvailable=false",
        "remarketingConsentEvidenceAvailable=false",
      ],
    });
  }

  // Repository strategy always contributes a bounded set of category signals
  for (const cat of strategy.partnerCategories) {
    raw.push({
      id: `repository:partner-category:${cat.id}`,
      kind: "repository-strategy",
      sourceExecutive: "repository",
      sourceEvidenceId: cat.id,
      title: `Partner category: ${cat.label}`,
      summary: cat.trustTransfer,
      confidence: 0.55,
      likelyImpact: 6,
      isTechnicalSeo: false,
      isContentProduction: false,
      isInference: true,
      supportingReference: "lib/agent-os/opportunity/strategy.ts",
      evidenceNotes: [
        "Category-level repository strategy only — no verified external target",
        cat.audienceMoment,
      ],
    });
  }

  for (const angle of strategy.mediaAngles.slice(0, 4)) {
    raw.push({
      id: `repository:media-angle:${angle.id}`,
      kind: "repository-strategy",
      sourceExecutive: "repository",
      sourceEvidenceId: angle.id,
      title: `Media research angle: ${angle.angle}`,
      summary: angle.credibility,
      relatedContent: angle.supportingThemeId,
      confidence: 0.5,
      likelyImpact: 5,
      isTechnicalSeo: false,
      isContentProduction: false,
      isInference: true,
      supportingReference: "lib/agent-os/content/themes.ts",
      evidenceNotes: [
        "Founder message territory — outlet acceptance not verified",
        angle.audience,
      ],
    });
  }

  if (input.content?.authority) {
    raw.unshift({
      id: "content:authority:current-outreach-wave",
      kind: "content-theme",
      sourceExecutive: "content",
      sourceEvidenceId: "authority:current-outreach-wave",
      title: "Current authority outreach wave owned by Content",
      summary:
        "Content Authority owns the current editorial outreach-wave lifecycle — Opportunity must not duplicate it",
      relatedContent: "authority:current-outreach-wave",
      confidence: 0.95,
      likelyImpact: 4,
      isTechnicalSeo: false,
      isContentProduction: false,
      isInference: false,
      supportingReference: "lib/agent-os/content/authority/ledger.ts",
      evidenceNotes: [
        `followUpEligibility=${input.content.authority.outreach.followUpEligibility}`,
        "No new outreach wave; no contacts",
      ],
    });
  }

  const capped = raw.length > MAX_SIGNALS;
  const signals = raw.slice(0, MAX_SIGNALS);

  return {
    signals,
    strategy,
    searchOpportunityIds: (input.search?.opportunities ?? []).map((o) => o.id),
    contentOpportunityIds: (input.content?.opportunities ?? []).map((o) => o.id),
    biRecommendationIds: (input.bi?.recommendations ?? []).map(
      (r) => r.recommendationId,
    ),
    capped,
  };
}

function normalizeSearchOpportunity(
  opp: SearchOpportunity,
): NormalizedOpportunitySignal {
  const isTechnical =
    opp.type === "schema-gap" ||
    opp.type === "metadata-gap" ||
    opp.type === "internal-link-gap" ||
    opp.type === "geo-readiness-gap" ||
    opp.type === "possible-cannibalization" ||
    opp.type === "query-page-mismatch";

  const isLocal =
    opp.type === "local-intent-gap" ||
    opp.classifications.includes("local");

  const isDemand =
    opp.type === "near-page-one" ||
    opp.type === "rising-query" ||
    opp.type === "high-impression-low-ctr" ||
    opp.type === "content-gap";

  return {
    id: `search:${opp.id}`,
    kind: isTechnical
      ? "search-technical"
      : isLocal
        ? "search-local"
        : isDemand
          ? "search-demand"
          : "search-demand",
    sourceExecutive: "search-strategy",
    sourceEvidenceId: opp.id,
    title: opp.title,
    summary: opp.whyItMatters,
    relatedQuery: opp.queryOrPage,
    relatedPage: opp.queryOrPage.startsWith("/") ? opp.queryOrPage : null,
    geographyHint: isLocal ? "charlotte-metro" : null,
    confidence: opp.confidence,
    likelyImpact: opp.likelyImpact,
    isTechnicalSeo: isTechnical,
    isContentProduction: false,
    isInference: opp.isInference,
    supportingReference: opp.supportingReference,
    evidenceNotes: [
      `Search type=${opp.type}`,
      `metric=${opp.metric}: ${opp.currentValue}`,
      ...opp.evidenceNotes.slice(0, 2),
    ],
  };
}

function normalizeContentOpportunity(
  opp: ContentOpportunity,
): NormalizedOpportunitySignal {
  const isProduction =
    opp.type === "founder-conversation-topic" ||
    opp.type === "follow-up-conversation" ||
    opp.type === "short-form-clip" ||
    opp.type === "carousel-opportunity" ||
    opp.type === "caption-opportunity" ||
    opp.type === "repurposing-gap" ||
    opp.type === "sequence-gap" ||
    opp.type === "case-study-production" ||
    opp.type === "case-study-founder-input";

  return {
    id: `content:${opp.id}`,
    kind: isProduction ? "content-production" : "content-theme",
    sourceExecutive: "content",
    sourceEvidenceId: opp.id,
    title: opp.title,
    summary: opp.whyItMatters,
    relatedContent: opp.topicOrItem,
    relatedPage: opp.relatedGuide ?? null,
    relatedTool: opp.relatedTool ?? null,
    funnelHint: opp.funnelStage,
    confidence: opp.confidence,
    likelyImpact: opp.likelyImpact,
    isTechnicalSeo: false,
    isContentProduction: isProduction,
    isInference: opp.isInference,
    supportingReference: opp.supportingReference,
    evidenceNotes: opp.evidenceNotes.slice(0, 3),
  };
}

function normalizeBiRecommendation(
  rec: Recommendation,
): NormalizedOpportunitySignal {
  const id = rec.recommendationId;
  const isMeasurement =
    id.includes("tracking") ||
    id.includes(":measurement:") ||
    /tracking|measurement|attribution|conversion|generate_lead|concierge-submit/i.test(
      rec.title + rec.plainLanguageExplanation,
    );

  return {
    id: `bi:${id}`,
    kind: isMeasurement ? "bi-measurement" : "bi-conversion",
    sourceExecutive: "business-intelligence",
    sourceEvidenceId: id,
    title: rec.title,
    summary: rec.whyItMattersNow,
    relatedTool: /studio/i.test(rec.title) ? "/diamond-studio" : null,
    confidence: rec.confidence,
    likelyImpact: rec.rankingFactors.expectedBusinessImpact,
    isTechnicalSeo: false,
    isContentProduction: false,
    isInference: rec.assumptions.some((a) => /infer/i.test(a)),
    supportingReference: id,
    evidenceNotes: [
      rec.plainLanguageExplanation.slice(0, 160),
      ...rec.evidence.slice(0, 1).map((e) => e.metricOrObservation),
    ],
  };
}
