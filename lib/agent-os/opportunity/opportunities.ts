/**
 * Opportunity detectors — synthesize BI / Search / Content / repository signals
 * into growth opportunities with distinct leverage (not source duplicates).
 *
 * Hardening: confidence ≠ attractiveness ≠ actionability; volume caps;
 * paid-search destination/conversion gates; one partnership + one media research
 * candidate max; already-covered same-objective suppression.
 */

import { isLocalIntent } from "../search/classify";
import { buildOpportunityId } from "./ids";
import {
  opportunityRankingAdjustments,
  qualifyOpportunity,
  withConfidenceContract,
} from "./qualify";
import type {
  NormalizedOpportunitySignal,
  OpportunitySignalBundle,
} from "./signals";
import { LOCAL_GEOGRAPHY_TOKENS } from "./strategy";
import type { GrowthOpportunity, OpportunityGeography } from "./types";

export type DetectOpportunityContext = {
  signals: OpportunitySignalBundle;
  includeRejectedExamples?: boolean;
};

const MAX_QUALIFIED = 10;
const MAX_UNDERUSED_DEMAND = 2;

export function detectGrowthOpportunities(
  ctx: DetectOpportunityContext,
): GrowthOpportunity[] {
  const out: GrowthOpportunity[] = [];

  out.push(...detectUnderusedDemand(ctx.signals));
  out.push(...detectPaidSearchReadiness(ctx.signals));
  out.push(...detectRemarketingReadiness(ctx.signals));
  out.push(...detectConversionLeverage(ctx.signals));
  // Single partnership category — do not fan out photographers/venues/etc.
  out.push(...detectLocalPartnershipCategories(ctx.signals));
  // Bridal folded into partnership ecosystem note when partnership exists;
  // emit bridal only when no partnership category (still research-required).
  if (
    !out.some((o) => o.type === "local-partnership-opportunity")
  ) {
    out.push(...detectBridalEcosystem(ctx.signals));
  }
  // Single media research candidate (podcast OR newsletter angle — not both)
  out.push(...detectMediaCommunityResearch(ctx.signals));
  out.push(...detectPositioningLeverage(ctx.signals));
  out.push(...detectAlreadyCovered(ctx.signals));

  if (ctx.includeRejectedExamples) {
    out.push(buildRejectedGenericSpeculation());
  }

  const finalized: GrowthOpportunity[] = [];
  for (const raw of out) {
    const opp = ensureConfidenceFields(raw);
    const q = qualifyOpportunity(opp);
    if (
      !q.ok &&
      opp.readiness !== "already-covered" &&
      opp.readiness !== "measurement-blocked" &&
      opp.readiness !== "research-required" &&
      opp.readiness !== "rejected"
    ) {
      finalized.push(
        ensureConfidenceFields({
          ...opp,
          readiness: "rejected",
          rejected: true,
          rejectionReason: q.penalties.join("; ") || "failed-qualification",
          evidenceNotes: [
            ...opp.evidenceNotes,
            `Qualification score=${q.score}`,
            ...q.penalties.slice(0, 2),
          ],
        }),
      );
      continue;
    }
    if (opp.rejected || opp.readiness === "rejected") {
      if (ctx.includeRejectedExamples) finalized.push(opp);
      continue;
    }
    finalized.push(annotateWithRankingHints(opp));
  }

  const deduped = dedupeById(finalized);
  // Prefer actionable + transparency states when capping volume
  const ready = deduped.filter(
    (o) =>
      o.readiness === "ready-to-evaluate" ||
      o.readiness === "ready-for-founder-decision",
  );
  const mustKeep = deduped.filter(
    (o) =>
      o.readiness === "measurement-blocked" ||
      o.readiness === "rejected" ||
      o.rejected ||
      o.readiness === "already-covered",
  );
  const research = deduped.filter((o) => o.readiness === "research-required");
  const other = deduped.filter(
    (o) =>
      !ready.includes(o) &&
      !mustKeep.includes(o) &&
      !research.includes(o),
  );
  // Always retain measurement-blocked / already-covered / rejected for fixture transparency
  const capped = [...ready, ...mustKeep, ...research, ...other].slice(
    0,
    MAX_QUALIFIED,
  );
  for (const keep of mustKeep) {
    if (!capped.some((o) => o.id === keep.id)) {
      capped.push(keep);
    }
  }
  return capped;
}

function detectUnderusedDemand(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const out: GrowthOpportunity[] = [];
  const demandSignals = bundle.signals.filter(
    (s) =>
      s.sourceExecutive === "search-strategy" &&
      (s.kind === "search-demand" || s.kind === "search-local") &&
      !s.isTechnicalSeo,
  );

  // Prefer local + near-page-one style signals; cap volume
  const ranked = [...demandSignals].sort(
    (a, b) => b.likelyImpact - a.likelyImpact || b.confidence - a.confidence,
  );

  for (const s of ranked.slice(0, MAX_UNDERUSED_DEMAND)) {
    const query = s.relatedQuery ?? s.title;
    const local = isLocalIntent(query) || s.kind === "search-local";

    // Same-objective suppression: Content already owns production for this topic
    if (sameObjectiveCoveredByContent(bundle, query)) {
      out.push(
        ensureConfidenceFields({
          id: buildOpportunityId({
            source: "search",
            type: "opportunity-already-covered",
            subject: `demand-${slug(query)}`,
            readiness: "already-covered",
          }),
          type: "opportunity-already-covered",
          readiness: "already-covered",
          title: `Already covered (same objective as Content): ${truncate(query, 40)}`,
          whyItMatters:
            "Content already owns communication/production for this demand territory — Opportunity must not restate it as new work.",
          recommendedAction:
            "Defer. Content retains production; Opportunity revisits only for distinct distribution/partner leverage.",
          targetAudience: "founders-peers",
          geography: resolveGeography(query, s),
          funnelStage: "awareness",
          relatedQuery: query,
          sourceExecutive: "content",
          sourceEvidenceId: s.sourceEvidenceId,
          costClass: "none",
          effort: "low",
          reversibility: "easily-reversed",
          timeToSignal: "unknown",
          strategicFit: 2,
          founderDependence: "none",
          externalVerification: "not-applicable",
          isInference: false,
          evidenceConfidence: 0.88,
          strategicAttractiveness: 2,
          urgency: "low",
          approvalRequired: false,
          owner: "Content",
          supportingReference: s.supportingReference,
          evidenceNotes: [
            "Same-objective suppression vs Content production",
            `Query/topic: ${query}`,
          ],
          disqualifyingRisks: ["Duplicate of Content ownership"],
          alreadyCoveredBy: "content",
          additionalLeverage: "None — same objective as Content",
        }),
      );
      continue;
    }

    const matchedRoute = matchKnownRoute(query, bundle);
    const route =
      (s.relatedPage && s.relatedPage.startsWith("/")
        ? s.relatedPage
        : null) ??
      matchedRoute ??
      (local ? "/diamond-guide/charlotte-diamond-advisor-guide" : null);

    if (!route) {
      // Demand without destination → research, not ready
      out.push(
        ensureConfidenceFields({
          id: buildOpportunityId({
            source: "search",
            type: local
              ? "local-authority-opportunity"
              : "underpriced-organic-demand",
            subject: query,
            readiness: "research-required",
          }),
          type: local
            ? "local-authority-opportunity"
            : "underpriced-organic-demand",
          readiness: "research-required",
          title: `Demand without clear destination: ${truncate(query, 40)}`,
          whyItMatters:
            "Search demand exists but no suitable existing landing path is confirmed — packaging leverage is not ready.",
          recommendedAction:
            "Verify which existing guide/tool/Concierge path fits before evaluating distribution. Search retains technical SEO.",
          targetAudience: local ? "local-charlotte" : "engagement-buyers",
          geography: resolveGeography(query, s),
          funnelStage: "consideration",
          relatedQuery: query,
          sourceExecutive: "search-strategy",
          sourceEvidenceId: s.sourceEvidenceId,
          costClass: "low",
          effort: "medium",
          reversibility: "easily-reversed",
          timeToSignal: "weeks",
          strategicFit: 6,
          founderDependence: "light",
          externalVerification: "not-applicable",
          isInference: true,
          evidenceConfidence: Math.min(0.7, s.confidence),
          strategicAttractiveness: 6,
          urgency: "low",
          dependency: `Search Strategy evidence ${s.sourceEvidenceId}`,
          approvalRequired: true,
          owner: "Founder / Opportunity",
          supportingReference: s.supportingReference,
          evidenceNotes: [
            ...s.evidenceNotes.slice(0, 2),
            "No matched destination route — not ready-to-evaluate",
          ],
          disqualifyingRisks: ["Weak conversion path without destination"],
          additionalLeverage:
            "Flags missing destination before packaging/distribution work",
        }),
      );
      continue;
    }

    const geography = resolveGeography(query, s);

    out.push(
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "search",
          type: local
            ? "local-authority-opportunity"
            : "underpriced-organic-demand",
          subject: query,
          readiness: "ready-to-evaluate",
        }),
        type: local
          ? "local-authority-opportunity"
          : "underpriced-organic-demand",
        readiness: "ready-to-evaluate",
        title: local
          ? `Underused local demand leverage: ${truncate(query, 48)}`
          : `Underused high-intent demand: ${truncate(query, 48)}`,
        whyItMatters:
          "Search evidence shows buyer interest Hourglass may already partially serve — evaluate low-cost packaging or distribution leverage (not technical SEO).",
        recommendedAction: local
          ? `Evaluate packaging the existing local guide/tool/Concierge path around “${truncate(query, 40)}” for partner education or contained distribution — do not edit pages from Agent OS.`
          : `Evaluate connecting “${truncate(query, 40)}” demand to an existing guide/tool/Concierge package — Search retains technical SEO ownership.`,
        targetAudience: local ? "local-charlotte" : "engagement-buyers",
        geography,
        funnelStage: "consideration",
        relatedQuery: query,
        relatedPage: route,
        relatedTool: routeIncludesTool(route) ? route : "/diamond-shape-studio",
        sourceExecutive: "search-strategy",
        sourceEvidenceId: s.sourceEvidenceId,
        verifiedMetric:
          s.evidenceNotes.find((n) => n.startsWith("metric=")) ?? null,
        costClass: "low",
        effort: "medium",
        reversibility: "easily-reversed",
        timeToSignal: "weeks",
        strategicFit: local ? 9 : 8,
        founderDependence: "light",
        externalVerification: "not-applicable",
        isInference: true,
        evidenceConfidence: Math.min(0.78, s.confidence),
        strategicAttractiveness: local ? 9 : 8,
        urgency: local ? "high" : "medium",
        dependency: `Search Strategy evidence ${s.sourceEvidenceId}`,
        approvalRequired: true,
        owner: "Founder / Opportunity",
        supportingReference: s.supportingReference,
        evidenceNotes: [
          ...s.evidenceNotes.slice(0, 3),
          "Language: underused demand / existing leverage — CPC not claimed",
          `Destination route: ${route}`,
        ],
        disqualifyingRisks: [
          "Do not treat as technical SEO (Search Strategy owns that)",
          "Do not claim inexpensive CPCs without verified cost data",
        ],
        alreadyCoveredBy: null,
        additionalLeverage:
          "Adds packaging/distribution leverage beyond Search’s technical recommendation",
      }),
    );
  }

  return out;
}

function detectPaidSearchReadiness(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const demand = bundle.signals.find(
    (s) =>
      s.sourceExecutive === "search-strategy" &&
      s.kind === "search-demand" &&
      !s.isTechnicalSeo &&
      s.confidence >= 0.5,
  );
  if (!demand) {
    // Keep as opportunity list item only via not-ready — material filter excludes
    return [
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "derived",
          type: "paid-search-readiness",
          subject: "insufficient-demand-evidence",
          readiness: "not-ready",
        }),
        type: "paid-search-readiness",
        readiness: "not-ready",
        title: "Paid-search readiness: insufficient verified demand evidence",
        whyItMatters:
          "Paid search requires verified high-intent demand before evaluation.",
        recommendedAction:
          "Defer paid-search evaluation until Search Strategy surfaces durable high-intent demand with a relevant landing path.",
        targetAudience: "engagement-buyers",
        geography: "unspecified",
        funnelStage: "consideration",
        costClass: "unknown",
        effort: "low",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 3,
        founderDependence: "none",
        externalVerification: "source-gap",
        isInference: false,
        evidenceConfidence: 0.75,
        strategicAttractiveness: 3,
        urgency: "low",
        approvalRequired: false,
        owner: "Founder / Opportunity",
        supportingReference: "lib/agent-os/opportunity/opportunities.ts",
        evidenceNotes: [
          "No eligible Search demand signal",
          "CPC data unavailable — no cost claims",
        ],
        disqualifyingRisks: ["Do not launch ads from Agent OS"],
        additionalLeverage: "Readiness gate only — prevents premature ad spend",
      }),
    ];
  }

  const matched = matchKnownRoute(demand.relatedQuery ?? "", bundle);
  const pageFromSignal =
    demand.relatedPage && demand.relatedPage.startsWith("/")
      ? demand.relatedPage
      : null;
  const destination = pageFromSignal ?? matched;
  const hasConversionPath = Boolean(
    destination &&
      (destination.includes("concierge") ||
        destination.includes("studio") ||
        destination.includes("diamond-guide") ||
        destination.includes("intelligence")),
  );
  const measurementReady = bundle.strategy.paidSearchTelemetryAvailable;
  const cpcOk = bundle.strategy.cpcEvidenceAvailable;
  const biMeasurementBlocked = bundle.signals.some(
    (s) =>
      s.id === "bi:handoff:paid-search-measurement-prerequisite" ||
      (s.kind === "bi-measurement" &&
        s.sourceExecutive === "business-intelligence" &&
        /paid-search measurement prerequisite|generate_lead|concierge-submit|authoritative conversion/i.test(
          s.title + s.summary,
        )),
  );
  const biPrerequisiteIds = bundle.biRecommendationIds.filter((id) =>
    id.includes(":measurement:"),
  );

  if (!destination) {
    return [
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "search",
          type: "paid-search-readiness",
          subject: demand.relatedQuery ?? demand.sourceEvidenceId,
          readiness: "not-ready",
        }),
        type: "paid-search-readiness",
        readiness: "not-ready",
        title: `Paid-search not ready: no suitable destination for ${truncate(demand.relatedQuery ?? demand.title, 32)}`,
        whyItMatters:
          "High-intent demand without a confirmed landing path must not become a paid evaluation.",
        recommendedAction:
          "Prepare measurement and confirm a suitable destination/Concierge path before any paid-search evaluation. Do not launch ads.",
        targetAudience: "engagement-buyers",
        geography: resolveGeography(demand.relatedQuery ?? "", demand),
        funnelStage: "decision",
        relatedQuery: demand.relatedQuery,
        sourceExecutive: "search-strategy",
        sourceEvidenceId: demand.sourceEvidenceId,
        costClass: "unknown",
        effort: "medium",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 4,
        founderDependence: "light",
        externalVerification: "source-gap",
        isInference: true,
        evidenceConfidence: Math.min(0.7, demand.confidence),
        strategicAttractiveness: 4,
        urgency: "low",
        approvalRequired: true,
        owner: "Founder / Opportunity",
        supportingReference: demand.supportingReference,
        evidenceNotes: [
          "Destination absent — paid readiness blocked",
          "CPC data unavailable — no cost or ROI claims",
        ],
        disqualifyingRisks: ["No conversion path", "Do not launch ads"],
        additionalLeverage:
          "Blocks premature paid evaluation when destination is missing",
      }),
    ];
  }

  if (!hasConversionPath) {
    return [
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "search",
          type: "paid-search-readiness",
          subject: demand.relatedQuery ?? demand.sourceEvidenceId,
          readiness: "not-ready",
        }),
        type: "paid-search-readiness",
        readiness: "not-ready",
        title: `Paid-search not ready: weak conversion path for ${truncate(demand.relatedQuery ?? "", 32)}`,
        whyItMatters:
          "A landing page alone is insufficient without a clear Concierge/tool conversion path.",
        recommendedAction:
          "Confirm Concierge or tool handoff on the destination before evaluating paid search. Do not launch ads.",
        targetAudience: "engagement-buyers",
        geography: resolveGeography(demand.relatedQuery ?? "", demand),
        funnelStage: "decision",
        relatedQuery: demand.relatedQuery,
        relatedPage: destination,
        sourceExecutive: "search-strategy",
        sourceEvidenceId: demand.sourceEvidenceId,
        costClass: "unknown",
        effort: "medium",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 4,
        founderDependence: "light",
        externalVerification: "source-gap",
        isInference: true,
        evidenceConfidence: Math.min(0.68, demand.confidence),
        strategicAttractiveness: 4,
        urgency: "low",
        approvalRequired: true,
        owner: "Founder / Opportunity",
        supportingReference: demand.supportingReference,
        evidenceNotes: [
          `Destination ${destination} lacks clear conversion path`,
          "CPC unavailable — no ROI implication",
        ],
        disqualifyingRisks: ["Weak conversion path"],
        additionalLeverage: "Requires conversion-path prerequisite before paid eval",
      }),
    ];
  }

  // Destination + demand exist; BI conversion measurement may still block
  if (biMeasurementBlocked || !measurementReady) {
    const readiness =
      biMeasurementBlocked
        ? ("measurement-blocked" as const)
        : ("ready-to-evaluate" as const);
    return [
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "search",
          type: "paid-search-readiness",
          subject: demand.relatedQuery ?? demand.sourceEvidenceId,
          readiness,
        }),
        type: "paid-search-readiness",
        readiness,
        title: biMeasurementBlocked
          ? `Paid-search blocked: conversion measurement prerequisite for ${truncate(demand.relatedQuery ?? demand.title, 32)}`
          : `Paid-search readiness: evaluate measurement for ${truncate(demand.relatedQuery ?? demand.title, 36)}`,
        whyItMatters: biMeasurementBlocked
          ? "High-intent demand and a destination exist, but BI reports authoritative conversion measurement is missing or unverified — paid evaluation must wait."
          : "High-intent demand and a destination exist — next step is measurement readiness and founder approval. Cost and ROI remain unknown without CPC evidence.",
        recommendedAction: biMeasurementBlocked
          ? "Do not launch ads. Defer to BI conversion/measurement prerequisites; Opportunity adds paid leverage only after generate_lead (or equivalent) is verified."
          : "Prepare measurement prerequisites (conversion tracking, destination quality, geographic fit) before any paid evaluation. Do not launch ads; cost remains unknown.",
        targetAudience: "engagement-buyers",
        geography: resolveGeography(demand.relatedQuery ?? "", demand),
        funnelStage: "decision",
        relatedQuery: demand.relatedQuery,
        relatedPage: destination,
        relatedTool: "/concierge",
        sourceExecutive: "search-strategy",
        sourceEvidenceId: demand.sourceEvidenceId,
        costClass: "unknown",
        effort: "medium",
        reversibility: "easily-reversed",
        timeToSignal: "weeks",
        strategicFit: biMeasurementBlocked ? 3 : 6,
        founderDependence: "light",
        externalVerification: "source-gap",
        isInference: true,
        evidenceConfidence: Math.min(0.75, demand.confidence + 0.1),
        strategicAttractiveness: biMeasurementBlocked ? 3 : 6,
        urgency: "low",
        dependency: biMeasurementBlocked
          ? `BI measurement prerequisite: ${biPrerequisiteIds[0] ?? "conversion-event-verification"}`
          : "Founder approval + measurement readiness before any spend",
        approvalRequired: true,
        owner: "Founder / Opportunity",
        supportingReference: demand.supportingReference,
        evidenceNotes: [
          ...demand.evidenceNotes.slice(0, 2),
          `Landing path: ${destination}`,
          "CPC data unavailable — no underpriced-paid or ROI claim",
          `measurementReady=${measurementReady}`,
          `biMeasurementBlocked=${biMeasurementBlocked}`,
          ...(biPrerequisiteIds.slice(0, 2).map((id) => `BI prerequisite: ${id}`)),
          "Readiness assessment only — no campaign launch",
        ],
        disqualifyingRisks: [
          "Budget unknown",
          "Do not launch ads from Agent OS",
        ],
        alreadyCoveredBy: biMeasurementBlocked
          ? biPrerequisiteIds[0] ?? "business-intelligence:measurement"
          : null,
        additionalLeverage: biMeasurementBlocked
          ? "References BI conversion prerequisites without duplicating measurement repair"
          : "Translates Search demand into a paid-readiness gate rather than duplicating SEO work",
      }),
    ];
  }

  const readiness = cpcOk
    ? ("ready-for-founder-decision" as const)
    : ("ready-to-evaluate" as const);

  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: "search",
        type: "paid-search-readiness",
        subject: demand.relatedQuery ?? demand.sourceEvidenceId,
        readiness,
      }),
      type: "paid-search-readiness",
      readiness,
      title: `Paid-search readiness: evaluate measurement for ${truncate(demand.relatedQuery ?? demand.title, 36)}`,
      whyItMatters:
        "High-intent demand and a destination exist — next step is measurement readiness and founder approval. Cost and ROI remain unknown without CPC evidence.",
      recommendedAction:
        "Evaluate a contained paid-search readiness brief for founder decision (Agent OS does not configure ads). Do not estimate CPC, lead volume, or ROI without cost data. Do not launch ads.",
      targetAudience: "engagement-buyers",
      geography: resolveGeography(demand.relatedQuery ?? "", demand),
      funnelStage: "decision",
      relatedQuery: demand.relatedQuery,
      relatedPage: destination,
      relatedTool: "/concierge",
      sourceExecutive: "search-strategy",
      sourceEvidenceId: demand.sourceEvidenceId,
      costClass: "unknown",
      effort: "medium",
      reversibility: "easily-reversed",
      timeToSignal: "weeks",
      strategicFit: 6,
      founderDependence: "light",
      externalVerification: "source-gap",
      isInference: true,
      evidenceConfidence: Math.min(0.62, demand.confidence),
      strategicAttractiveness: 6,
      urgency: "low",
      dependency: "Founder approval + measurement readiness before any spend",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: demand.supportingReference,
      evidenceNotes: [
        ...demand.evidenceNotes.slice(0, 2),
        `Landing path: ${destination}`,
        "CPC data unavailable — no underpriced-paid or ROI claim",
        `measurementReady=${measurementReady}`,
        "Readiness assessment only — no campaign launch",
      ],
      disqualifyingRisks: [
        "Budget unknown",
        "Do not launch ads from Agent OS",
      ],
      additionalLeverage:
        "Translates Search demand into a paid-readiness gate rather than duplicating SEO work",
    }),
  ];
}

function detectRemarketingReadiness(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const hasAudience = bundle.strategy.remarketingAudienceEvidenceAvailable;
  const readiness = hasAudience
    ? ("ready-to-evaluate" as const)
    : ("measurement-blocked" as const);

  // High evidenceConfidence that evidence is missing — low attractiveness/actionability
  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: "derived",
        type: "remarketing-readiness",
        subject: "audience-consent-config",
        readiness,
      }),
      type: "remarketing-readiness",
      readiness,
      title: hasAudience
        ? "Remarketing readiness: evaluate contained audience use"
        : "Remarketing readiness: measurement prerequisite (audience/consent missing)",
      whyItMatters: hasAudience
        ? "Verified audience evidence may support a contained remarketing evaluation."
        : "High confidence that required audience/consent/config evidence is missing — this is a measurement prerequisite, not a strong remarketing opportunity.",
      recommendedAction: hasAudience
        ? "Evaluate remarketing destination and exclusion rules with founder approval (Agent OS does not modify analytics or ads)."
        : "Do not implement remarketing. Close audience/consent/config measurement gaps before treating remarketing as an opportunity.",
      targetAudience: "returning-researchers",
      geography: "unspecified",
      funnelStage: "consideration",
      relatedPage: "/concierge",
      relatedTool: "/diamond-shape-studio",
      costClass: "unknown",
      effort: "high",
      reversibility: "partially-reversed",
      timeToSignal: "unknown",
      strategicFit: hasAudience ? 6 : 2,
      founderDependence: "heavy",
      externalVerification: "source-gap",
      isInference: false,
      evidenceConfidence: 0.9,
      strategicAttractiveness: hasAudience ? 6 : 2,
      urgency: "low",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: "lib/agent-os/opportunity/strategy.ts",
      evidenceNotes: [
        `remarketingAudienceEvidenceAvailable=${hasAudience}`,
        "evidenceConfidence reflects diagnostic certainty about the gap — not opportunity strength",
        "No audience-size claim fabricated",
      ],
      disqualifyingRisks: [
        "Do not modify analytics or ad platforms",
        "Do not claim audience availability without evidence",
      ],
      additionalLeverage:
        "Explicit measurement prerequisite preventing premature remarketing spend",
    }),
  ];
}

function detectConversionLeverage(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const bi = bundle.signals.find(
    (s) =>
      s.sourceExecutive === "business-intelligence" &&
      s.kind === "bi-conversion" &&
      /studio|cta|consultation/i.test(s.title + s.summary),
  );
  if (!bi) return [];

  // Do not restate BI measurement repair as Opportunity work
  if (
    /tracking|verify measurement|attribution|generate_lead|concierge-submit/i.test(
      bi.title,
    ) ||
    bi.sourceEvidenceId.includes(":measurement:")
  ) {
    return [
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "bi",
          type: "opportunity-already-covered",
          subject: bi.sourceEvidenceId,
          readiness: "already-covered",
        }),
        type: "opportunity-already-covered",
        readiness: "already-covered",
        title: `Already covered by BI measurement: ${truncate(bi.title, 40)}`,
        whyItMatters: "BI owns measurement repair — Opportunity must not repackage it.",
        recommendedAction: "Defer to BI. Opportunity adds leverage only after measurement is trustworthy.",
        targetAudience: "founders-peers",
        geography: "unspecified",
        funnelStage: "awareness",
        sourceExecutive: "business-intelligence",
        sourceEvidenceId: bi.sourceEvidenceId,
        costClass: "none",
        effort: "low",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 2,
        founderDependence: "none",
        externalVerification: "not-applicable",
        isInference: false,
        evidenceConfidence: 0.9,
        strategicAttractiveness: 1,
        urgency: "low",
        approvalRequired: false,
        owner: "Business Intelligence",
        supportingReference: bi.supportingReference,
        evidenceNotes: ["Same-objective suppression vs BI measurement"],
        disqualifyingRisks: ["Duplicate of BI ownership"],
        alreadyCoveredBy: "business-intelligence",
        additionalLeverage: "None — BI owns measurement",
      }),
    ];
  }

  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: "bi",
        type: "conversion-leverage-opportunity",
        subject: bi.sourceEvidenceId,
        readiness: bundle.signals.some(
          (s) => s.id === "bi:handoff:paid-search-measurement-prerequisite",
        )
          ? "measurement-blocked"
          : "ready-to-evaluate",
      }),
      type: "conversion-leverage-opportunity",
      readiness: bundle.signals.some(
        (s) => s.id === "bi:handoff:paid-search-measurement-prerequisite",
      )
        ? "measurement-blocked"
        : "ready-to-evaluate",
      title: "Conversion leverage: Studio engagement vs consultation movement",
      whyItMatters:
        "BI shows Studio usage movement without matching consultation progress — evaluate a contained handoff or partner-distribution experiment without duplicating BI’s measurement diagnosis.",
      recommendedAction: bundle.signals.some(
        (s) => s.id === "bi:handoff:paid-search-measurement-prerequisite",
      )
        ? "Do not run conversion experiments until BI confirms authoritative conversion measurement. Opportunity adds handoff/partner leverage after the prerequisite closes."
        : "Evaluate a contained Studio→Concierge handoff test and whether the tool could be useful in partner education (read-only — no site edits from Agent OS).",
      targetAudience: "engagement-buyers",
      geography: "charlotte-metro",
      funnelStage: "decision",
      relatedTool: "/diamond-studio",
      relatedPage: "/concierge",
      sourceExecutive: "business-intelligence",
      sourceEvidenceId: bi.sourceEvidenceId,
      costClass: "low",
      effort: "medium",
      reversibility: "easily-reversed",
      timeToSignal: "weeks",
      strategicFit: 8,
      founderDependence: "light",
      externalVerification: "not-applicable",
      isInference: true,
      evidenceConfidence: Math.min(0.72, bi.confidence),
      strategicAttractiveness: 8,
      urgency: "medium",
      dependency: `BI recommendation ${bi.sourceEvidenceId}`,
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: bi.supportingReference,
      evidenceNotes: [
        ...bi.evidenceNotes.slice(0, 3),
        "Does not restate BI tracking diagnosis as a new opportunity",
        "No revenue inference from Studio views",
      ],
      disqualifyingRisks: [
        "BI retains measurement ownership",
        "Do not alter Studio or analytics from Agent OS",
      ],
      alreadyCoveredBy: null,
      additionalLeverage:
        "Adds partner-distribution / handoff-experiment framing beyond BI’s measurement finding",
    }),
  ];
}

function detectLocalPartnershipCategories(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  // Exactly one category — never fan out all partner types from one local signal
  const cat = bundle.strategy.partnerCategories[0];
  if (!cat) return [];

  const localDemand = bundle.signals.some(
    (s) => s.kind === "search-local" || s.geographyHint === "charlotte-metro",
  );

  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: "repository",
        type: "local-partnership-opportunity",
        subject: cat.id,
        readiness: "research-required",
      }),
      type: "local-partnership-opportunity",
      readiness: "research-required",
      title: `Local partnership category to research: ${cat.label}`,
      whyItMatters: `${cat.trustTransfer}. ${localDemand ? "Local search demand strengthens regional relevance." : "Category fit is repository-backed."} Other adjacent categories (photographers, venues, boutiques) are not separate priorities from the same signal.`,
      recommendedAction: `Research whether a genuine education/tool-sharing relationship with ${cat.label.toLowerCase()} could help mutual clients — verify targets with founder. Do not contact partners from Agent OS.`,
      targetAudience: "partner-ecosystem",
      geography: "charlotte-metro",
      funnelStage: "trust",
      relatedTool: "/diamond-shape-studio",
      relatedPage: "/diamond-guide/charlotte-diamond-advisor-guide",
      sourceExecutive: "repository",
      sourceEvidenceId: cat.id,
      costClass: "low",
      effort: "medium",
      reversibility: "easily-reversed",
      timeToSignal: "months",
      strategicFit: 7,
      founderDependence: "heavy",
      externalVerification: "source-gap",
      isInference: true,
      evidenceConfidence: 0.55,
      strategicAttractiveness: 7,
      urgency: "low",
      dependency: "Founder-approved research; no verified partner list",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: "lib/agent-os/opportunity/strategy.ts",
      evidenceNotes: [
        `Category: ${cat.label}`,
        `Audience moment: ${cat.audienceMoment}`,
        `Hourglass asset: ${cat.hourglassAsset}`,
        `Mutual value: ${cat.mutualValue}`,
        `Brand risk: ${cat.brandRisk}`,
        `Founder involvement: required`,
        "No specific business named as a confirmed target",
        "Single category only — not photographers/venues/boutiques as separate high-priority items",
      ],
      disqualifyingRisks: [
        cat.brandRisk,
        "Do not send outreach from Agent OS",
        "Do not claim partner availability",
      ],
      additionalLeverage:
        "Surfaces one relationship-driven growth category with explicit research gate",
    }),
  ];
}

function detectBridalEcosystem(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  if (bundle.strategy.plannedContentAssets.length === 0) return [];

  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: "repository",
        type: "bridal-ecosystem-opportunity",
        subject: "engagement-journey-education",
        readiness: "research-required",
      }),
      type: "bridal-ecosystem-opportunity",
      readiness: "research-required",
      title: "Bridal/engagement ecosystem: education placement research candidate",
      whyItMatters:
        "Hourglass adds unique value before purchase through calm ring education — adjacent bridal ecosystems may amplify trust if verified carefully.",
      recommendedAction:
        "Research education-first placements adjacent to proposal/engagement planning (not generic wedding sponsorships). Verify with founder; Agent OS will not contact anyone.",
      targetAudience: "bridal-adjacent",
      geography: "regional",
      funnelStage: "consideration",
      relatedTool: "/diamond-shape-studio",
      relatedContent: bundle.strategy.plannedContentAssets[0]?.id ?? null,
      sourceExecutive: "repository",
      costClass: "low",
      effort: "medium",
      reversibility: "easily-reversed",
      timeToSignal: "months",
      strategicFit: 7,
      founderDependence: "heavy",
      externalVerification: "source-gap",
      isInference: true,
      evidenceConfidence: 0.52,
      strategicAttractiveness: 7,
      urgency: "low",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference: "lib/agent-os/content/themes.ts",
      evidenceNotes: [
        "Repository themes support engagement-buyer education",
        "No verified bridal outlet named",
        "Audience moment: pre-purchase education",
        "Reusable asset: guides + Shape Studio",
        "Founder burden: heavy (relationship work)",
      ],
      disqualifyingRisks: [
        "Avoid generic wedding sponsorships",
        "Do not fabricate outlet acceptance",
      ],
      additionalLeverage:
        "Frames bridal-adjacent trust-building beyond Content’s production backlog",
    }),
  ];
}

function detectMediaCommunityResearch(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const contentTheme = bundle.signals.find(
    (s) =>
      s.sourceExecutive === "content" &&
      (s.kind === "content-theme" || s.kind === "content-production") &&
      !/measurement-gap/i.test(s.title) &&
      !/current-outreach-wave|authority outreach/i.test(`${s.id} ${s.title} ${s.relatedContent ?? ""}`),
  );
  const angle =
    bundle.strategy.mediaAngles[0] ??
    ({
      id: "why-hourglass-exists",
      angle: "Why Hourglass exists",
      credibility: "Discerning guidance in a faster diamond market",
      audience: "Buyers seeking calm education",
      supportingThemeId: "why-hourglass-exists",
    } as const);

  const subject = contentTheme?.relatedContent ?? angle.id;

  // One combined podcast/newsletter research candidate — not separate high-priority items
  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: contentTheme ? "content" : "repository",
        type: "podcast-opportunity",
        subject,
        readiness: "research-required",
      }),
      type: "podcast-opportunity",
      readiness: "research-required",
      title: `Media research angle (podcast/newsletter): ${angle.angle}`,
      whyItMatters:
        "Founder expertise themes may fit buyer-education podcasts or newsletter contributions — research only until outlets are verified. Not separate priorities per channel.",
      recommendedAction: `Research whether a buyer-education podcast or newsletter fits “${angle.angle}” using existing themes. Verify outlet fit with founder; do not pitch from Agent OS.`,
      targetAudience: "engagement-buyers",
      geography: "national",
      funnelStage: "awareness",
      relatedContent: subject,
      sourceExecutive: contentTheme ? "content" : "repository",
      sourceEvidenceId: contentTheme?.sourceEvidenceId ?? angle.id,
      costClass: "low",
      effort: "medium",
      reversibility: "easily-reversed",
      timeToSignal: "months",
      strategicFit: 6,
      founderDependence: "heavy",
      externalVerification: "source-gap",
      isInference: true,
      evidenceConfidence: 0.5,
      strategicAttractiveness: 6,
      urgency: "low",
      approvalRequired: true,
      owner: "Founder / Opportunity",
      supportingReference:
        contentTheme?.supportingReference ?? "lib/agent-os/content/themes.ts",
      evidenceNotes: [
        `Proposed angle: ${angle.angle}`,
        `Credibility: ${angle.credibility}`,
        `Audience: ${angle.audience}`,
        "Reusable asset: existing founder conversation themes",
        "Verification required: outlet fit and acceptance",
        "Founder burden: heavy",
        "Single media research candidate — not separate podcast + newsletter priorities",
        "No outlet named as accepting guests",
      ],
      disqualifyingRisks: [
        "Do not fabricate publications or podcasts",
        "Content retains production ownership",
      ],
      additionalLeverage:
        "Adds earned-media/distribution research beyond Content’s production recommendation",
    }),
  ];
}

function detectPositioningLeverage(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const pos = bundle.strategy.positioningLeverage[0];
  if (!pos) return [];

  return [
    ensureConfidenceFields({
      id: buildOpportunityId({
        source: "repository",
        type: "competitor-positioning-gap",
        subject: pos.id,
        readiness: "research-required",
      }),
      type: "competitor-positioning-gap",
      readiness: "research-required",
      title: `Positioning leverage (internal): ${pos.claim}`,
      whyItMatters:
        "Internal positioning advantages may guide where Hourglass should show up — differentiation territory, not verified competitor weakness.",
      recommendedAction:
        "Consider where this positioning claim can guide partner/education choices. Do not claim competitors lack this capability without verified evidence.",
      targetAudience: "founders-peers",
      geography: "unspecified",
      funnelStage: "trust",
      costClass: "none",
      effort: "low",
      reversibility: "easily-reversed",
      timeToSignal: "unknown",
      strategicFit: 5,
      founderDependence: "light",
      externalVerification: "not-applicable",
      isInference: true,
      evidenceConfidence: 0.6,
      strategicAttractiveness: 5,
      urgency: "low",
      approvalRequired: false,
      owner: "Founder / Opportunity",
      supportingReference: "lib/agent-os/opportunity/strategy.ts",
      evidenceNotes: [
        `Internal claim: ${pos.claim}`,
        `Label: ${pos.label}`,
        "Not a verified competitor weakness",
      ],
      disqualifyingRisks: [
        "Do not claim named competitors lack capabilities without evidence",
      ],
      additionalLeverage:
        "Keeps differentiation guidance available without fabricating competitor research",
    }),
  ];
}

function detectAlreadyCovered(
  bundle: OpportunitySignalBundle,
): GrowthOpportunity[] {
  const contentProd = bundle.signals.find(
    (s) => s.sourceExecutive === "content" && s.isContentProduction,
  );
  const searchTech = bundle.signals.find(
    (s) => s.sourceExecutive === "search-strategy" && s.isTechnicalSeo,
  );
  const localAuthContent = bundle.signals.find(
    (s) =>
      s.sourceExecutive === "content" &&
      /local-authority|local authority/i.test(s.title + s.id),
  );

  const out: GrowthOpportunity[] = [];

  const authorityWave = bundle.signals.find(
    (s) =>
      s.sourceEvidenceId === "authority:current-outreach-wave" ||
      /current-outreach-wave/i.test(s.id),
  );
  if (authorityWave) {
    out.push(
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "content",
          type: "opportunity-already-covered",
          subject: "current-outreach-wave",
          readiness: "already-covered",
        }),
        type: "opportunity-already-covered",
        readiness: "already-covered",
        title: "Already covered by Content: current authority outreach wave",
        whyItMatters:
          "Content Authority owns the current editorial outreach-wave lifecycle — Opportunity must not open a parallel wave.",
        recommendedAction:
          "Defer. Let Content retain the current outreach-wave object.",
        targetAudience: "founders-peers",
        geography: "unspecified",
        funnelStage: "awareness",
        relatedContent: "authority:current-outreach-wave",
        sourceExecutive: "content",
        sourceEvidenceId: authorityWave.sourceEvidenceId,
        costClass: "none",
        effort: "low",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 2,
        founderDependence: "none",
        externalVerification: "not-applicable",
        isInference: false,
        evidenceConfidence: 0.95,
        strategicAttractiveness: 1,
        urgency: "low",
        approvalRequired: false,
        owner: "Content",
        supportingReference: authorityWave.supportingReference,
        evidenceNotes: [
          "Canonical object: authority:current-outreach-wave",
          "No new contacts, lists, or send actions from Opportunity",
        ],
        disqualifyingRisks: ["Duplicate of Content Authority ownership"],
        alreadyCoveredBy: "content",
        additionalLeverage: "None — explicitly deferred to Content Authority",
      }),
    );
  }

  if (contentProd) {
    out.push(
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "content",
          type: "opportunity-already-covered",
          subject: contentProd.sourceEvidenceId,
          readiness: "already-covered",
        }),
        type: "opportunity-already-covered",
        readiness: "already-covered",
        title: `Already covered by Content: ${truncate(contentProd.title, 50)}`,
        whyItMatters:
          "Content already owns this communication/production work — Opportunity must not compete.",
        recommendedAction:
          "Defer. Let Content retain production ownership.",
        targetAudience: "founders-peers",
        geography: "unspecified",
        funnelStage: "awareness",
        relatedContent: contentProd.relatedContent,
        sourceExecutive: "content",
        sourceEvidenceId: contentProd.sourceEvidenceId,
        costClass: "none",
        effort: "low",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 2,
        founderDependence: "none",
        externalVerification: "not-applicable",
        isInference: false,
        evidenceConfidence: 0.9,
        strategicAttractiveness: 1,
        urgency: "low",
        approvalRequired: false,
        owner: "Content",
        supportingReference: contentProd.supportingReference,
        evidenceNotes: [
          `Active Content opportunity: ${contentProd.sourceEvidenceId}`,
          "Includes Conversation Page / founder-conversation production ownership",
        ],
        disqualifyingRisks: ["Duplicate of Content ownership"],
        alreadyCoveredBy: "content",
        additionalLeverage: "None — explicitly deferred to Content",
      }),
    );
  }

  if (searchTech) {
    out.push(
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "search",
          type: "opportunity-already-covered",
          subject: searchTech.sourceEvidenceId,
          readiness: "already-covered",
        }),
        type: "opportunity-already-covered",
        readiness: "already-covered",
        title: `Already covered by Search Strategy: ${truncate(searchTech.title, 50)}`,
        whyItMatters:
          "Search Strategy owns technical SEO — Opportunity must not relabel schema/metadata/link audits.",
        recommendedAction:
          "Defer technical SEO to Search Strategy.",
        targetAudience: "founders-peers",
        geography: "unspecified",
        funnelStage: "awareness",
        sourceExecutive: "search-strategy",
        sourceEvidenceId: searchTech.sourceEvidenceId,
        costClass: "none",
        effort: "low",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 2,
        founderDependence: "none",
        externalVerification: "not-applicable",
        isInference: false,
        evidenceConfidence: 0.92,
        strategicAttractiveness: 1,
        urgency: "low",
        approvalRequired: false,
        owner: "Search Strategy",
        supportingReference: searchTech.supportingReference,
        evidenceNotes: [
          `Active Search technical opportunity: ${searchTech.sourceEvidenceId}`,
        ],
        disqualifyingRisks: ["Duplicate of Search Strategy ownership"],
        alreadyCoveredBy: "search-strategy",
        additionalLeverage: "None — explicitly deferred to Search Strategy",
      }),
    );
  }

  if (localAuthContent) {
    out.push(
      ensureConfidenceFields({
        id: buildOpportunityId({
          source: "content",
          type: "opportunity-already-covered",
          subject: `local-auth-${localAuthContent.sourceEvidenceId}`,
          readiness: "already-covered",
        }),
        type: "opportunity-already-covered",
        readiness: "already-covered",
        title: "Already covered: local-authority content recommendation",
        whyItMatters:
          "Content already owns local-authority communication — Opportunity must not restate the same objective.",
        recommendedAction: "Defer local-authority content production to Content.",
        targetAudience: "local-charlotte",
        geography: "charlotte-metro",
        funnelStage: "awareness",
        sourceExecutive: "content",
        sourceEvidenceId: localAuthContent.sourceEvidenceId,
        costClass: "none",
        effort: "low",
        reversibility: "easily-reversed",
        timeToSignal: "unknown",
        strategicFit: 2,
        founderDependence: "none",
        externalVerification: "not-applicable",
        isInference: false,
        evidenceConfidence: 0.85,
        strategicAttractiveness: 1,
        urgency: "low",
        approvalRequired: false,
        owner: "Content",
        supportingReference: localAuthContent.supportingReference,
        evidenceNotes: ["Same-objective suppression vs Content local-authority"],
        disqualifyingRisks: ["Duplicate local-authority recommendation"],
        alreadyCoveredBy: "content",
        additionalLeverage: "None — Content owns local-authority production",
      }),
    );
  }

  return out;
}

function buildRejectedGenericSpeculation(): GrowthOpportunity {
  return ensureConfidenceFields({
    id: buildOpportunityId({
      source: "derived",
      type: "low-cost-experiment",
      subject: "generic-network-more-run-ads",
      readiness: "rejected",
    }),
    type: "low-cost-experiment",
    readiness: "rejected",
    title: "Generic speculative idea: network more and run ads to go viral",
    whyItMatters: "Speculative spray-and-pray awareness with guaranteed ROI claims",
    recommendedAction: "Network more and run ads for cheap traffic and easy wins",
    targetAudience: "founders-peers",
    geography: "unspecified",
    funnelStage: "awareness",
    costClass: "high",
    effort: "high",
    reversibility: "hard-to-reverse",
    timeToSignal: "unknown",
    strategicFit: 1,
    founderDependence: "heavy",
    externalVerification: "unverified",
    isInference: true,
    evidenceConfidence: 0.1,
    strategicAttractiveness: 1,
    urgency: "low",
    approvalRequired: true,
    owner: "Founder / Opportunity",
    supportingReference: "qualification-rules",
    evidenceNotes: ["No verified demand", "No conversion path"],
    disqualifyingRisks: ["Generic awareness"],
    rejected: true,
    rejectionReason: "generic-speculative-language",
    additionalLeverage: "None — rejected by qualification rules",
  });
}

function sameObjectiveCoveredByContent(
  bundle: OpportunitySignalBundle,
  query: string,
): boolean {
  const q = query.toLowerCase();
  return bundle.signals.some((s) => {
    if (s.sourceExecutive !== "content" || !s.isContentProduction) return false;
    const blob = `${s.title} ${s.relatedContent ?? ""} ${s.summary}`.toLowerCase();
    const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 4);
    let hits = 0;
    for (const t of tokens.slice(0, 5)) {
      if (blob.includes(t)) hits += 1;
    }
    return hits >= 2;
  });
}

function ensureConfidenceFields(
  opp: Parameters<typeof withConfidenceContract>[0] | GrowthOpportunity,
): GrowthOpportunity {
  if (
    "evidenceConfidence" in opp &&
    "strategicAttractiveness" in opp &&
    "actionability" in opp &&
    typeof opp.actionability === "number"
  ) {
    return opp as GrowthOpportunity;
  }
  return withConfidenceContract({
    ...opp,
    evidenceConfidence:
      (opp as GrowthOpportunity).evidenceConfidence ??
      (opp as GrowthOpportunity).confidence ??
      0.5,
    strategicAttractiveness:
      (opp as GrowthOpportunity).strategicAttractiveness ??
      (opp as GrowthOpportunity).strategicFit ??
      5,
  });
}

function annotateWithRankingHints(opp: GrowthOpportunity): GrowthOpportunity {
  const adj = opportunityRankingAdjustments(opp);
  return {
    ...opp,
    likelyImpact: adj.effectiveImpact,
    // Keep evidenceConfidence intact; confidence alias stays diagnostic
    confidence: opp.evidenceConfidence,
    strategicFit: clamp(opp.strategicAttractiveness + adj.alignmentBoost, 0, 10),
  };
}

function matchKnownRoute(
  query: string,
  bundle: OpportunitySignalBundle,
): string | null {
  const q = query.toLowerCase();
  for (const route of bundle.strategy.conversionRoutes) {
    const token = route.replace(/^\//, "").split("/")[0] ?? "";
    if (token && q.includes(token.replace(/-/g, " "))) return route;
  }
  if (/oval|shape|studio/i.test(q)) return "/diamond-shape-studio";
  if (/lab.?grown|natural|guide/i.test(q)) return "/diamond-guide";
  if (/charlotte|custom engagement|waxhaw|fort mill/i.test(q)) {
    return "/diamond-guide/charlotte-diamond-advisor-guide";
  }
  if (/concierge|consult/i.test(q)) return "/concierge";
  return null;
}

function routeIncludesTool(route: string): boolean {
  return (
    route.includes("studio") ||
    route.includes("intelligence") ||
    route.includes("concierge")
  );
}

function resolveGeography(
  query: string,
  signal?: NormalizedOpportunitySignal,
): OpportunityGeography {
  if (signal?.geographyHint === "charlotte-metro") return "charlotte-metro";
  const q = query.toLowerCase();
  if (q.includes("waxhaw")) return "waxhaw";
  if (q.includes("fort mill")) return "fort-mill";
  for (const t of LOCAL_GEOGRAPHY_TOKENS) {
    if (q.includes(t)) return "charlotte-metro";
  }
  return "unspecified";
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "unknown";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dedupeById(items: GrowthOpportunity[]): GrowthOpportunity[] {
  const seen = new Set<string>();
  const out: GrowthOpportunity[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Material opportunities that may become Recommendations.
 * measurement-blocked / already-covered / rejected / not-ready stay in
 * opportunities[] only (JSON transparency) — not ranked recommendation flood.
 */
export function materialGrowthOpportunities(
  opps: GrowthOpportunity[],
): GrowthOpportunity[] {
  return opps.filter(
    (o) =>
      !o.rejected &&
      o.readiness !== "rejected" &&
      o.readiness !== "already-covered" &&
      o.readiness !== "defer" &&
      o.readiness !== "not-ready" &&
      o.readiness !== "measurement-blocked" &&
      o.additionalLeverage.length >= 20,
  );
}
