import { deltaPercentage, formatDeltaLine, formatInteger } from "@/lib/intelligence/compare";
import type { AgentOsDataBundle } from "../adapters/types";
import {
  runConversionMeasurementAudit,
  type ConversionMeasurementAudit,
  type OpportunityMeasurementHandoff,
} from "../bi";
import {
  runClientJourneyAnalysis,
  type ClientJourneyAudit,
} from "../bi/journey";
import { createEvidence } from "../evidence";
import { buildRecommendation } from "../recommendation";
import { assertOperationalForRecommendations } from "../registry";
import type {
  Anomaly,
  DataGap,
  Evidence,
  Recommendation,
} from "../types";

export type BusinessIntelligenceOutput = {
  recommendations: Recommendation[];
  anomalies: Anomaly[];
  dataGaps: DataGap[];
  keyMetricChanges: string[];
  facts: string[];
  inferences: string[];
  incompleteAttribution: boolean;
  /** Conversion & Measurement Audit (V1 expansion). */
  conversionAudit: ConversionMeasurementAudit;
  opportunityHandoff: OpportunityMeasurementHandoff;
  /** Client Journey & Conversion Analysis (shared with Chief of Staff). */
  journeyAudit: ClientJourneyAudit;
};

export type RunBusinessIntelligenceOptions = {
  mode?: "fixture" | "live";
};

export function runBusinessIntelligence(
  bundle: AgentOsDataBundle,
  reportingPeriod: { start: string; end: string },
  options: RunBusinessIntelligenceOptions = {},
): BusinessIntelligenceOutput {
  assertOperationalForRecommendations("business-intelligence");

  const mode = options.mode ?? inferMode(bundle);
  const recommendations: Recommendation[] = [];
  const anomalies: Anomaly[] = [];
  const dataGaps: DataGap[] = [];
  const keyMetricChanges: string[] = [];
  const facts: string[] = [];
  const inferences: string[] = [];
  let incompleteAttribution = false;

  // Unavailable social / GBP / HubSpot — explicit gaps, no fabrication
  const unavailable: Array<{
    label: string;
    result: typeof bundle.hubspotAggregates;
    impact: string;
  }> = [
    {
      label: "HubSpot aggregates",
      result: bundle.hubspotAggregates,
      impact: "Cannot rank consultation CRM funnel health from Agent OS V1",
    },
    {
      label: "Buffer / social",
      result: bundle.buffer,
      impact: "Cannot recommend social posting or attribute content ROI beyond GA4 labels",
    },
    {
      label: "Google Business Profile",
      result: bundle.gbp,
      impact: "Cannot recommend GBP edits or local-pack actions",
    },
  ];
  for (const item of unavailable) {
    dataGaps.push({
      id: `gap-${item.result.sourceId}`,
      sourceId: item.result.sourceId,
      description: `${item.label} unavailable in Agent OS V1`,
      impactOnRecommendations: item.impact,
      suggestedRemedy:
        item.result.health.errors[0] ??
        "Add a verified read-only adapter in a later pass",
    });
  }

  if (bundle.ga4.failed) {
    dataGaps.push({
      id: "gap-ga4-failed",
      sourceId: "ga4",
      description: "GA4 retrieval failed",
      impactOnRecommendations:
        "Do not declare traffic declines; treat as measurement failure until verified",
      suggestedRemedy: bundle.ga4.health.errors.join("; ") || "Inspect GA4 OAuth and property access",
    });
  } else if (!bundle.ga4.ok && bundle.ga4.health.retrievalState === "not-configured") {
    dataGaps.push({
      id: "gap-ga4-config",
      sourceId: "ga4",
      description: "GA4 not configured",
      impactOnRecommendations: "Traffic and Studio recommendations blocked or low confidence",
      suggestedRemedy: "Configure GA4 readonly OAuth and GA4_PROPERTY_ID",
    });
  } else if (bundle.ga4.empty) {
    dataGaps.push({
      id: "gap-ga4-empty",
      sourceId: "ga4",
      description: "GA4 returned empty traffic (distinct from failure)",
      impactOnRecommendations: "Zero sessions may be real or a filter issue — verify before acting",
      suggestedRemedy: "Confirm property ID and date range",
    });
  }

  if (bundle.gsc.failed || bundle.gsc.health.retrievalState === "not-configured") {
    dataGaps.push({
      id: "gap-gsc",
      sourceId: "gsc",
      description: bundle.gsc.failed
        ? "Search Console retrieval failed"
        : "Search Console not configured",
      impactOnRecommendations: "Organic query/page recommendations limited",
      suggestedRemedy:
        bundle.gsc.health.errors.join("; ") || "Set GSC_SITE_URL with webmasters.readonly token",
    });
  }

  const ga4 = bundle.ga4.data;
  const weekly = bundle.weeklyIntelligence.data;
  const collectedAt =
    ga4?.fetchedAt ??
    weekly?.created_at ??
    new Date().toISOString();

  if (ga4) {
    const sessionsDelta = deltaPercentage(
      ga4.current.traffic.sessions,
      ga4.previous.traffic.sessions,
    );
    const studioDelta = deltaPercentage(
      ga4.current.studioViews,
      ga4.previous.studioViews,
    );
    const ctaDelta = deltaPercentage(
      ga4.current.consultationCtaClicks,
      ga4.previous.consultationCtaClicks,
    );
    const engagementDelta = deltaPercentage(
      ga4.current.traffic.engagementRate,
      ga4.previous.traffic.engagementRate,
    );

    keyMetricChanges.push(
      `Sessions ${formatInteger(ga4.current.traffic.sessions)} (${formatDeltaLine(sessionsDelta)})`,
      `Studio views ${formatInteger(ga4.current.studioViews)} (${formatDeltaLine(studioDelta)})`,
      `Consultation CTA clicks ${formatInteger(ga4.current.consultationCtaClicks)} (${formatDeltaLine(ctaDelta)})`,
      `Engagement rate ${(ga4.current.traffic.engagementRate * 100).toFixed(1)}% (${formatDeltaLine(engagementDelta)})`,
    );

    facts.push(
      `Organic Search sessions this week: ${formatInteger(ga4.current.sources.find((s) => s.value === "Organic Search")?.sessions ?? 0)}`,
      `Top Studio shape: ${ga4.current.topShapes[0]?.shape ?? "unknown"}`,
      `Top landing: ${ga4.current.landingPages[0]?.value ?? "unknown"}`,
    );

    // Incomplete attribution: Organic Social present but Buffer unavailable
    const socialSessions =
      ga4.current.sources.find((s) =>
        s.value.toLowerCase().includes("social"),
      )?.sessions ?? 0;
    if (socialSessions > 0 && !bundle.buffer.ok) {
      incompleteAttribution = true;
      dataGaps.push({
        id: "gap-social-attribution",
        sourceId: "buffer",
        description:
          "GA4 shows Organic Social sessions but no verified social/Buffer adapter exists",
        impactOnRecommendations:
          "Content channel ROI cannot be attributed beyond GA4 channel labels",
        suggestedRemedy: "Do not fabricate Buffer metrics; flag incomplete attribution",
      });
      inferences.push(
        "Social channel traffic is labeled in GA4 only — posting performance is unverified",
      );
    }

    // Never treat pageviews as conversions; CTA is an event, not revenue
    facts.push(
      "Consultation CTA clicks are engagement events, not confirmed consultations or revenue",
    );
    inferences.push(
      "Revenue must not be inferred from sessions or Studio views alone",
    );

    const period = reportingPeriod;
    const sessionsEvidence: Evidence[] = [
      createEvidence({
        source: "ga4",
        sourceType: "analytics",
        collectedAt,
        reportingPeriod: period,
        metricOrObservation: `sessions=${ga4.current.traffic.sessions}`,
        priorComparison: `previous=${ga4.previous.traffic.sessions} (${formatDeltaLine(sessionsDelta)})`,
        reliability: bundle.ga4.health.retrievalState === "fixture" ? "unverified" : "reliable",
        supportingReference: "ga4.traffic.sessions",
      }),
    ];

    if ((sessionsDelta ?? 0) <= -10) {
      const trackingSuspect =
        bundle.ga4.failed ||
        !bundle.weeklyIntelligence.ok ||
        Math.abs(studioDelta ?? 0) > 5 && (ctaDelta ?? 0) < -5;

      anomalies.push({
        id: "anom-sessions-soft",
        severity: "high",
        title: "Sessions softened week-over-week",
        observation: `Sessions ${formatDeltaLine(sessionsDelta)}`,
        evidence: sessionsEvidence,
        possibleCauses: trackingSuspect
          ? [
              "Demand softness",
              "Channel mix shift",
              "Possible tracking or CTA instrumentation issue (Studio up / CTA down divergence)",
            ]
          : ["Demand softness", "Channel mix shift", "Seasonality"],
        isTrackingFailureSuspect: Boolean(trackingSuspect),
      });

      recommendations.push(
        buildRecommendation({
          recommendationId: "bi-verify-tracking-before-decline",
          originatingExecutive: "business-intelligence",
          title: "Verify measurement before treating traffic drop as demand decline",
          plainLanguageExplanation:
            "Sessions fell double-digits week-over-week. Studio engagement did not move the same way as consultation CTAs, so a tracking or funnel instrumentation issue is plausible.",
          whyItMattersNow:
            "Acting on a false decline wastes founder time and can break a working funnel.",
          proposedAction:
            "Review website consultation-request and Diamond Studio visit counts against Studio UI placements for the reporting week; confirm analytics gates are still recording cleanly.",
          expectedUpside:
            "Avoid mistaken product changes; restore trustworthy funnel signal within one cycle",
          effortEstimate: "low",
          urgency: "high",
          reversibility: "easily-reversed",
          baseConfidence: 0.72,
          evidence: [
            ...sessionsEvidence,
            createEvidence({
              source: "ga4",
              sourceType: "analytics",
              collectedAt,
              reportingPeriod: period,
              metricOrObservation: `studioViews=${ga4.current.studioViews}, ctaClicks=${ga4.current.consultationCtaClicks}`,
              priorComparison: `studio ${formatDeltaLine(studioDelta)}; cta ${formatDeltaLine(ctaDelta)}`,
              reliability: "reliable",
              supportingReference: "ga4.studioEvents",
            }),
          ],
          assumptions: [
            "Week ranges are complete Mon–Sun periods",
            "Event names match production instrumentation",
          ],
          risks: [
            "Small sample CTA counts amplify percentage swings",
            "One-week noise can overstate urgency",
          ],
          dependencies: ["GA4 event definitions verified"],
          approvalRequired: false,
          suggestedOwner: "Founder / analytics",
          rankingFactors: {
            expectedBusinessImpact: 8,
            strategicAlignment: 9,
          },
        }),
      );
    }

    if ((studioDelta ?? 0) >= 5 && (ctaDelta ?? 0) <= -8) {
      recommendations.push(
        buildRecommendation({
          recommendationId: "bi-studio-cta-divergence",
          originatingExecutive: "business-intelligence",
          title: "Investigate Studio engagement vs consultation CTA divergence",
          plainLanguageExplanation:
            "Diamond Studio views rose while consultation CTA clicks fell. That pattern is a funnel-health signal, not proof of weaker demand.",
          whyItMattersNow:
            "If the CTA is under-firing or poorly placed, consultation intent is being lost despite healthy Studio use.",
          proposedAction:
            "Review the mobile path from Diamond Studio engagement to consultation requests, and improve CTA visibility where most sessions occur.",
          expectedUpside:
            "Recover qualified consultation inquiries from existing Studio traffic without paid spend",
          effortEstimate: "low",
          urgency: "high",
          reversibility: "easily-reversed",
          baseConfidence: 0.7,
          evidence: [
            createEvidence({
              source: "ga4",
              sourceType: "analytics",
              collectedAt,
              reportingPeriod: period,
              metricOrObservation: `studioViews delta ${formatDeltaLine(studioDelta)}; cta delta ${formatDeltaLine(ctaDelta)}`,
              priorComparison: null,
              reliability: "reliable",
              supportingReference: "ga4.studio-vs-cta",
            }),
          ],
          assumptions: ["CTA event fires only on intentional clicks"],
          risks: ["Sample size for CTA clicks is small"],
          dependencies: [],
          approvalRequired: false,
          suggestedOwner: "Founder / product",
          rankingFactors: {
            expectedBusinessImpact: 8,
            strategicAlignment: 9,
          },
        }),
      );
    }

    const guideLanding = ga4.current.landingPages.find(
      (p) =>
        p.value.includes("/diamond-guide/") || p.value.includes("/guides/"),
    );
    if (guideLanding) {
      recommendations.push(
        buildRecommendation({
          recommendationId: "bi-guide-landing-momentum",
          originatingExecutive: "business-intelligence",
          title: "Protect guide landing momentum into Studio and Concierge",
          plainLanguageExplanation: `Guide landing ${guideLanding.value} is among top landings this week with ${formatInteger(guideLanding.sessions)} sessions.`,
          whyItMattersNow:
            "Guide traffic is a compounding owned asset; weak internal paths waste it.",
          proposedAction:
            "Audit internal links from the active guide into Diamond Studio and Concierge; schedule Search Strategy follow-up once that executive is operational.",
          expectedUpside:
            "Higher Studio/Concierge continuation from existing organic landings",
          effortEstimate: "medium",
          urgency: "medium",
          reversibility: "easily-reversed",
          baseConfidence: 0.62,
          evidence: [
            createEvidence({
              source: "ga4",
              sourceType: "analytics",
              collectedAt,
              reportingPeriod: period,
              metricOrObservation: `landing=${guideLanding.value} sessions=${guideLanding.sessions}`,
              priorComparison: null,
              reliability: "reliable",
              supportingReference: "ga4.landingPages",
            }),
          ],
          assumptions: ["Sessions on guides include qualified research traffic"],
          risks: ["Without GSC query detail, intent mix is partially unknown"],
          dependencies: bundle.gsc.ok ? [] : ["GSC query detail for intent confirmation"],
          missingDependencies: bundle.gsc.ok
            ? []
            : ["Search Strategy executive + live GSC detail"],
          approvalRequired: false,
          suggestedOwner: "Founder / content",
          rankingFactors: {
            expectedBusinessImpact: 6,
            strategicAlignment: 8,
          },
        }),
      );
    }

    // Cosmetic low-impact item for ranking tests / contrast
    recommendations.push(
      buildRecommendation({
        recommendationId: "bi-cosmetic-nav-label",
        originatingExecutive: "business-intelligence",
        title: "Optional nav label polish on secondary pages",
        plainLanguageExplanation:
          "Minor copy consistency on secondary nav labels — no evidence this moves consultations.",
        whyItMattersNow: "It does not matter now relative to funnel measurement.",
        proposedAction:
          "Defer cosmetic nav label tweaks until measurement gaps and CTA divergence are resolved.",
        expectedUpside: "Negligible near-term business impact",
        effortEstimate: "high",
        urgency: "low",
        reversibility: "easily-reversed",
        baseConfidence: 0.55,
        evidence: [
          createEvidence({
            source: "ga4",
            sourceType: "analytics",
            collectedAt,
            reportingPeriod: period,
            metricOrObservation: "No conversion lift signal tied to nav labels",
            reliability: "unverified",
            supportingReference: "bi.heuristic",
          }),
        ],
        assumptions: ["Cosmetic work does not improve consultation rate"],
        risks: ["Displaces higher-ROI work"],
        dependencies: [],
        approvalRequired: false,
        suggestedOwner: "Founder",
        rankingFactors: {
          expectedBusinessImpact: 2,
          strategicAlignment: 3,
        },
        agendaBucket: "ignore",
      }),
    );
  }

  if (bundle.gsc.data?.current && bundle.gsc.ok) {
    const gsc = bundle.gsc.data;
    const clicks = gsc.current!.totals.clicks;
    const prev = gsc.previous?.totals.clicks ?? null;
    const clickDelta =
      prev === null ? null : deltaPercentage(clicks, prev);
    facts.push(
      `GSC clicks ${formatInteger(clicks)}${prev !== null ? ` (${formatDeltaLine(clickDelta)})` : ""}`,
    );
    keyMetricChanges.push(
      `Search Console clicks ${formatInteger(clicks)} (${formatDeltaLine(clickDelta)})`,
    );

    if ((gsc.current!.totals.impressions ?? 0) > 0 && clicks < 50) {
      inferences.push(
        "Low click volume — flag small sample before strong SEO claims",
      );
    }
  }

  if (weekly) {
    facts.push(`Latest weekly intelligence report: ${weekly.id}`);
    for (const problem of weekly.problems.slice(0, 3)) {
      facts.push(`Weekly report problem: ${problem}`);
    }
  } else if (bundle.weeklyIntelligence.failed) {
    dataGaps.push({
      id: "gap-weekly-failed",
      sourceId: "weekly-intelligence",
      description: "Weekly intelligence report read failed",
      impactOnRecommendations: "Cannot cross-check stored dashboard snapshot",
      suggestedRemedy: bundle.weeklyIntelligence.health.errors.join("; "),
    });
  }

  // Explicit: never invent revenue
  facts.push("No verified revenue metric is available to Agent OS V1");

  // ——— Conversion & Measurement Audit ———
  const { audit, recommendations: measurementRecs } =
    runConversionMeasurementAudit({
      mode,
      bundle,
      reportingPeriod,
      legacyRecommendations: recommendations,
    });

  facts.push(...audit.facts);
  inferences.push(...audit.inferences);

  // One data-gap row for the Concierge conversion root; retain other non-cluster blockers
  const conciergeRootRec = measurementRecs.find(
    (r) =>
      r.recommendationId ===
      "business-intelligence:measurement:concierge-conversion-root:concierge",
  );
  if (conciergeRootRec) {
    dataGaps.push({
      id: "gap-measurement-concierge-conversion-root",
      sourceId: "ga4",
      description: conciergeRootRec.title,
      impactOnRecommendations: conciergeRootRec.expectedUpside,
      suggestedRemedy: conciergeRootRec.proposedAction,
    });
  }
  for (const f of audit.findings) {
    if (f.decisionEffect !== "decision-blocking") continue;
    if (
      f.type === "expected-event-not-observed" ||
      f.type === "concierge-start-submit-gap" ||
      f.type === "conversion-definition-gap" ||
      (f.type === "verification-required" &&
        (f.affectedEvent === "generate_lead" ||
          f.affectedRoute === "/concierge"))
    ) {
      continue; // folded into Concierge conversion root gap
    }
    dataGaps.push({
      id: `gap-measurement-${f.type}`,
      sourceId: "ga4",
      description: f.title,
      impactOnRecommendations: f.likelyDecisionImpact,
      suggestedRemedy: f.recommendedNextAction,
    });
  }

  const { audit: journeyAudit, recommendations: journeyRecs } =
    runClientJourneyAnalysis({
      mode,
      bundle,
      reportingPeriod,
      measurementRecommendations: measurementRecs,
    });

  facts.push(...journeyAudit.facts);
  inferences.push(...journeyAudit.inferences);

  for (const gap of journeyAudit.sourceGaps) {
    if (gap.suppressFromFounderRanking && gap.founderRelevance !== "prerequisite") {
      continue;
    }
    // Soft-dedupe conversion journey gap when Concierge measurement root exists
    if (
      gap.id.includes("conversion-event-measurement") &&
      conciergeRootRec
    ) {
      continue;
    }
    dataGaps.push({
      id: `gap-journey-${gap.id.split(":").pop() ?? "source"}`,
      sourceId: gap.source === "cross-cutting" ? "ga4" : gap.source,
      description: gap.scope,
      impactOnRecommendations: gap.affectedAnalyses.join("; "),
      suggestedRemedy: gap.resolutionPrerequisite,
    });
  }

  const mergedRecommendations = [
    ...recommendations,
    ...measurementRecs,
    ...journeyRecs,
  ];

  return {
    recommendations: mergedRecommendations,
    anomalies,
    dataGaps,
    keyMetricChanges,
    facts,
    inferences,
    incompleteAttribution,
    conversionAudit: audit,
    opportunityHandoff: audit.opportunityHandoff,
    journeyAudit,
  };
}

function inferMode(bundle: AgentOsDataBundle): "fixture" | "live" {
  if (bundle.ga4.health.retrievalState === "fixture") return "fixture";
  if (bundle.gsc.health.retrievalState === "fixture") return "fixture";
  return "live";
}
