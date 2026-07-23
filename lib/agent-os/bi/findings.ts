/**
 * Conversion & measurement finding detection.
 * Prefer decision-quality issues; suppress tiny samples and speculative claims.
 */

import {
  AUTHORITATIVE_CONVERSION_EVENT,
  UNMEASURED_JOURNEY_STAGES,
} from "./expected-events";
import { FUNNEL_DEFINITIONS } from "./funnels";
import { buildMeasurementFindingId } from "./ids";
import {
  directTrafficShare,
  fragmentSourceMediumFamilies,
  getEventCount,
  resolveObservedStatus,
  totalSessions,
} from "./observe";
import type {
  BiConversionObservationBundle,
  ExpectedEventInventoryItem,
  MeasurementDecisionEffect,
  MeasurementFinding,
} from "./types";

/** Minimum upstream count before progression-gap language is allowed. */
export const MIN_FUNNEL_SAMPLE = 40;
/** Minimum absolute volume to discuss event regressions. */
export const MIN_REGRESSION_PRIOR = 25;
/** Relative drop threshold for possible regressions. */
export const REGRESSION_DROP_RATIO = 0.35;
/** Direct share + volume gates — avoid overclaiming. */
export const DIRECT_SHARE_THRESHOLD = 0.55;
export const DIRECT_MIN_SESSIONS = 200;
/** Source/medium fragmentation: need multiple variants + volume. */
export const FRAGMENT_MIN_VARIANTS = 3;
export const FRAGMENT_MIN_SESSIONS = 80;

export function detectMeasurementFindings(input: {
  inventory: ExpectedEventInventoryItem[];
  observations: BiConversionObservationBundle | null;
}): MeasurementFinding[] {
  const findings: MeasurementFinding[] = [];
  const { inventory, observations } = input;

  findings.push(...detectConversionIntegrity(inventory, observations));
  findings.push(...detectConciergeStartSubmitGap(inventory, observations));
  findings.push(...detectToolEntryCompletionGap(inventory, observations));
  findings.push(...detectToolToConciergeGap(inventory, observations));
  findings.push(...detectUnmeasuredJourneyStages());
  findings.push(...detectObservedUndocumented(observations));
  findings.push(...detectEventRegression(inventory, observations));
  findings.push(...detectAttributionIssues(observations));
  findings.push(...detectDestinationQuality(observations));
  findings.push(...detectHealthyStudioProgression(inventory, observations));
  findings.push(...detectLowValueMonitorGaps(inventory));
  findings.push(...detectSampleSizeLimitations(observations));

  return dedupeFindings(findings);
}

function detectConversionIntegrity(
  inventory: ExpectedEventInventoryItem[],
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  const lead = inventory.find(
    (e) => e.expectedEventName === AUTHORITATIVE_CONVERSION_EVENT,
  );
  const submit = inventory.find(
    (e) => e.expectedEventName === "concierge_form_submitted",
  );
  const cta = inventory.find(
    (e) => e.expectedEventName === "consultation_cta_clicked",
  );

  if (!lead) return [];

  const status = lead.observedStatus;
  const ctaObserved = cta?.observedStatus === "observed";
  const ctaCount = cta?.currentCount ?? 0;

  if (status === "unknown") {
    return [
      finding({
        type: "verification-required",
        subject: AUTHORITATIVE_CONVERSION_EVENT,
        funnel: "general-consultation",
        title:
          "Concierge conversion signal unverified in Agent OS GA4 reads",
        expectedEvidence:
          "Repository instruments Concierge conversion candidates (e.g. generate_lead, concierge_form_submitted) after soft-accept",
        observedEvidence: observations
          ? "Candidate conversion events are outside the current GA4 weekly adapter allowlist — status unknown/unverified (not proof the event is absent or tracking is broken)"
          : "GA4 unavailable — conversion status unknown/unverified (not proof of broken tracking or failed conversions)",
        confidence: 0.78,
        sampleSize: ctaCount || null,
        decisionEffect: "decision-blocking",
        severity: "critical",
        likelyDecisionImpact:
          "Cannot responsibly evaluate conversion performance, paid search, or channel ROI until a reporting conversion is verified",
        affectedRoute: "/concierge",
        affectedEvent: AUTHORITATIVE_CONVERSION_EVENT,
        recommendedNextAction:
          "Verify which repository candidate reliably represents successful Concierge submission in GA4 Explorations/DebugView; expand Agent OS GA4 read coverage in a later pass (no config changes in this audit). Retain form-start and CTA events for funnel diagnosis.",
        whyItMatters:
          "CTA and Studio proxies are not conversions — Opportunity paid/remarketing readiness stays gated without a verified reporting conversion",
        dependency: "GA4 conversion event read coverage",
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: true,
        blockedExecutive: "opportunity",
        isInference: false,
        suppressRecommendation: false,
      }),
    ];
  }

  if (status === "not-observed" && ctaObserved) {
    // Fixture / explicit observation only — live unread events stay unknown above
    return [
      finding({
        type: "expected-event-not-observed",
        subject: AUTHORITATIVE_CONVERSION_EVENT,
        funnel: "general-consultation",
        title:
          "Concierge conversion candidates not observed while CTA intent is present",
        expectedEvidence:
          "Repository instruments generate_lead and concierge_form_submitted as Concierge conversion candidates",
        observedEvidence: `consultation_cta_clicked observed (${ctaCount}) in the same period; generate_lead not observed in this observation set${
          submit?.observedStatus === "not-observed"
            ? "; concierge_form_submitted also not observed"
            : ""
        }`,
        confidence: 0.82,
        sampleSize: ctaCount,
        decisionEffect: "decision-blocking",
        severity: "critical",
        likelyDecisionImpact:
          "Core conversion path is unmeasured in the observation set — channel and Opportunity decisions are unreliable",
        affectedRoute: "/concierge",
        affectedEvent: AUTHORITATIVE_CONVERSION_EVENT,
        recommendedNextAction:
          "Verify which candidate conversion event reliably represents accepted Concierge submissions; treat CTA clicks as intent only until a reporting conversion is verified. Do not delete or replace events in this pass.",
        whyItMatters:
          "Without a verified reporting conversion, Agent OS cannot separate engagement from consultation requests",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: true,
        blockedExecutive: "opportunity",
        isInference: false,
        suppressRecommendation: false,
      }),
      finding({
        type: "conversion-definition-gap",
        subject: "authoritative-conversion",
        funnel: "general-consultation",
        title: "Designate one authoritative reporting conversion for Concierge",
        expectedEvidence:
          "Repository lists conversion candidates (generate_lead, concierge_form_submitted) plus diagnostic events (concierge_form_started, consultation_cta_clicked)",
        observedEvidence:
          "Multiple candidates exist; Agent OS still leans on CTA/Studio proxies when a reporting conversion is not verified — designate one authoritative reporting conversion without removing diagnostic events",
        confidence: 0.8,
        sampleSize: ctaCount,
        decisionEffect: "decision-blocking",
        severity: "high",
        likelyDecisionImpact:
          "Multiple unverified proxies invite unsupported conversion conclusions",
        affectedRoute: "/concierge",
        affectedEvent: AUTHORITATIVE_CONVERSION_EVENT,
        recommendedNextAction:
          "Define one authoritative reporting conversion for successful Concierge submission; verify which repository candidate is reliable; retain earlier-stage events for funnel diagnosis. Do not delete or replace events in this pass.",
        whyItMatters:
          "Clear reporting conversion definition prevents false lead/revenue inferences from page or Studio metrics",
        dependency: "Verified reporting conversion observation",
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: true,
        blockedExecutive: "opportunity",
        isInference: false,
        suppressRecommendation: false,
      }),
    ];
  }

  if (status === "not-observed" && !ctaObserved) {
    return [
      finding({
        type: "verification-required",
        subject: AUTHORITATIVE_CONVERSION_EVENT,
        funnel: "general-consultation",
        title:
          "Conversion candidate not observed — verify before claiming funnel failure",
        expectedEvidence:
          "Repository expects a Concierge conversion candidate after soft-accept",
        observedEvidence:
          "Conversion candidate not observed in this set; upstream CTA also not observed or unknown — unread or low-volume metrics are not proof of abandonment or broken tracking",
        confidence: 0.55,
        sampleSize: null,
        decisionEffect: "decision-degrading",
        severity: "medium",
        likelyDecisionImpact: "Conversion analysis confidence is reduced",
        affectedRoute: "/concierge",
        affectedEvent: AUTHORITATIVE_CONVERSION_EVENT,
        recommendedNextAction:
          "Verify instrumentation coverage and traffic volume before treating conversion as broken",
        whyItMatters:
          "Absent rows with weak upstream signal may reflect low traffic or unread metrics",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: true,
        suppressRecommendation: false,
      }),
    ];
  }

  return [];
}

function detectConciergeStartSubmitGap(
  inventory: ExpectedEventInventoryItem[],
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const start = inventory.find(
    (e) => e.expectedEventName === "concierge_form_started",
  );
  const submit = inventory.find(
    (e) => e.expectedEventName === "concierge_form_submitted",
  );
  if (!start || !submit) return [];

  if (start.observedStatus === "unknown" || submit.observedStatus === "unknown") {
    if (start.observedStatus === "unknown" && submit.observedStatus === "unknown") {
      return []; // covered by conversion verification-required
    }
  }

  if (
    start.observedStatus === "observed" &&
    (submit.observedStatus === "not-observed" ||
      (submit.currentCount !== null &&
        start.currentCount !== null &&
        start.currentCount >= MIN_FUNNEL_SAMPLE &&
        submit.currentCount === 0))
  ) {
    return [
      finding({
        type: "concierge-start-submit-gap",
        subject: "concierge",
        funnel: "general-consultation",
        title: "Concierge start is observed but submit measurement is absent",
        expectedEvidence:
          "concierge_form_started and concierge_form_submitted are both instrumented",
        observedEvidence: `Started=${start.currentCount} in ${observations.reportingPeriod.start}–${observations.reportingPeriod.end}; submitted not observed in this observation set (same period) — measurement gap, not proof users abandoned`,
        confidence: 0.8,
        sampleSize: start.currentCount,
        decisionEffect: "decision-blocking",
        severity: "critical",
        likelyDecisionImpact:
          "Cannot separate Concierge starts from completed consultation requests",
        affectedRoute: "/concierge",
        affectedEvent: "concierge_form_submitted",
        recommendedNextAction:
          "Verify concierge_form_submitted (and other conversion candidates) on accepted submissions; retain start events for funnel diagnosis; do not infer abandonment from this measurement gap alone",
        whyItMatters:
          "Start-without-submit may be a tracking gap or a real progression gap — language stays verification-first",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: true,
        blockedExecutive: "opportunity",
        isInference: false,
        suppressRecommendation: false,
      }),
    ];
  }

  // Comparable counts with sufficient sample — progression gap language only
  if (
    start.observedStatus === "observed" &&
    submit.observedStatus === "observed" &&
    start.currentCount !== null &&
    submit.currentCount !== null &&
    start.currentCount >= MIN_FUNNEL_SAMPLE &&
    submit.currentCount < start.currentCount * 0.25
  ) {
    return [
      finding({
        type: "funnel-dropoff",
        subject: "concierge-start-to-submit",
        funnel: "general-consultation",
        title: "Investigate Concierge start→submit progression gap",
        expectedEvidence: "Comparable Concierge start and submit counts in one period",
        observedEvidence: `Started=${start.currentCount}, submitted=${submit.currentCount} (same period ${observations.reportingPeriod.start}–${observations.reportingPeriod.end})`,
        confidence: 0.68,
        sampleSize: start.currentCount,
        decisionEffect: "decision-degrading",
        severity: "high",
        likelyDecisionImpact:
          "Possible friction or incomplete measurement between start and submit",
        affectedRoute: "/concierge",
        affectedEvent: "concierge_form_submitted",
        recommendedNextAction:
          "Investigate the observed stage difference cautiously — users may exit after value; confirm instrumentation match before product changes",
        whyItMatters:
          "A verified progression gap can guide Concierge UX review without claiming abandonment or revenue loss",
        dependency: "Instrumentation parity verified",
        owner: "Founder / product",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: true,
        suppressRecommendation: false,
      }),
    ];
  }

  // Small sample start/submit — suppress drop-off conclusion
  if (
    start.observedStatus === "observed" &&
    submit.observedStatus === "observed" &&
    start.currentCount !== null &&
    start.currentCount < MIN_FUNNEL_SAMPLE
  ) {
    return [
      finding({
        type: "sample-size-limitation",
        subject: "concierge-funnel",
        funnel: "general-consultation",
        title: "Concierge funnel sample too small for drop-off conclusions",
        expectedEvidence: `At least ${MIN_FUNNEL_SAMPLE} starts for progression claims`,
        observedEvidence: `Only ${start.currentCount} starts in the observation period`,
        confidence: 0.7,
        sampleSize: start.currentCount,
        decisionEffect: "monitor",
        severity: "low",
        likelyDecisionImpact: "Avoid unsupported abandonment claims",
        affectedRoute: "/concierge",
        affectedEvent: "concierge_form_started",
        recommendedNextAction: "Monitor until sample is adequate; do not act on ratios",
        whyItMatters: "Tiny samples amplify noise and invent false urgency",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Sample below minimum for funnel drop-off claims",
      }),
    ];
  }

  return [];
}

function detectToolEntryCompletionGap(
  inventory: ExpectedEventInventoryItem[],
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  const entry = inventory.find(
    (e) => e.expectedEventName === "diamond_studio_view",
  );
  const completion = inventory.find(
    (e) => e.expectedEventName === "studio_session_engaged",
  );
  if (!entry || !completion || !observations) return [];

  if (entry.observedStatus === "observed" && completion.observedStatus === "unknown") {
    return [
      finding({
        type: "tool-entry-completion-gap",
        subject: "diamond-studio",
        funnel: "diamond-studio",
        title: "Separate tool entry from meaningful completion for Size Studio",
        expectedEvidence: "diamond_studio_view vs studio_session_engaged",
        observedEvidence:
          "Entry observed; completion status unknown in this observation set",
        confidence: 0.72,
        sampleSize: entry.currentCount,
        decisionEffect: "decision-degrading",
        severity: "high",
        likelyDecisionImpact:
          "Tool performance cannot be judged from entry alone",
        affectedRoute: "/diamond-studio",
        affectedEvent: "studio_session_engaged",
        recommendedNextAction:
          "Ensure Studio completion/engagement is readable alongside entry before ranking tool effectiveness",
        whyItMatters:
          "Entry without completion confuses healthy exploration with unfinished journeys",
        dependency: null,
        owner: "Founder / product",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: false,
      }),
    ];
  }

  if (
    entry.observedStatus === "observed" &&
    completion.observedStatus === "not-observed" &&
    (entry.currentCount ?? 0) >= MIN_FUNNEL_SAMPLE
  ) {
    return [
      finding({
        type: "tool-entry-completion-gap",
        subject: "diamond-studio",
        funnel: "diamond-studio",
        title: "Studio entries are strong but completion cannot be verified",
        expectedEvidence: "studio_session_engaged after diamond_studio_view",
        observedEvidence: `Entry=${entry.currentCount}; studio_session_engaged not observed in the same period`,
        confidence: 0.78,
        sampleSize: entry.currentCount,
        decisionEffect: "decision-degrading",
        severity: "high",
        likelyDecisionImpact:
          "Cannot distinguish tool value delivery from page visits",
        affectedRoute: "/diamond-studio",
        affectedEvent: "studio_session_engaged",
        recommendedNextAction:
          "Verify studio_session_engaged measurement; do not treat entry volume as completion or conversion",
        whyItMatters:
          "Tool recommendations and Opportunity leverage need completion signal, not vanity entry counts",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: false,
      }),
    ];
  }

  return [];
}

function detectToolToConciergeGap(
  inventory: ExpectedEventInventoryItem[],
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const entry = getEventCount(observations, "diamond_studio_view") ?? 0;
  const engaged = getEventCount(observations, "studio_session_engaged");
  const cta = getEventCount(observations, "consultation_cta_clicked") ?? 0;
  const leadStatus = resolveObservedStatus(
    AUTHORITATIVE_CONVERSION_EVENT,
    observations,
  );

  if (entry < MIN_FUNNEL_SAMPLE) return [];

  // Tool traffic strong; Concierge movement weak or conversion unmeasured
  if (
    engaged !== null &&
    engaged >= Math.min(MIN_FUNNEL_SAMPLE, entry * 0.2) &&
    (cta < entry * 0.15 || leadStatus !== "observed")
  ) {
    return [
      finding({
        type: "tool-to-concierge-gap",
        subject: "diamond-studio-to-concierge",
        funnel: "diamond-studio",
        title: "Establish a measurable tool-to-Concierge handoff",
        expectedEvidence:
          "Studio engagement should connect to measurable Concierge CTA / conversion",
        observedEvidence: `Studio entry=${entry}, engaged=${engaged}, CTA=${cta}, generate_lead status=${leadStatus} (same period)`,
        confidence: 0.74,
        sampleSize: entry,
        decisionEffect: "decision-degrading",
        severity: "high",
        likelyDecisionImpact:
          "Tool engagement may not be translating into measurable consultation intent",
        affectedRoute: "/diamond-studio",
        affectedEvent: "consultation_cta_clicked",
        recommendedNextAction:
          "Confirm Studio→Concierge CTA measurement and path clarity; treat weak movement as a progression gap pending conversion verification — not proven revenue loss",
        whyItMatters:
          "Opportunity conversion leverage depends on a trustworthy tool→Concierge signal",
        dependency: "Authoritative conversion measurement",
        owner: "Founder / product",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: true,
        blockedExecutive: "opportunity",
        isInference: true,
        suppressRecommendation: false,
      }),
    ];
  }

  return [];
}

function detectUnmeasuredJourneyStages(): MeasurementFinding[] {
  return UNMEASURED_JOURNEY_STAGES.filter(
    (s) =>
      s.stage === "tool-entry" ||
      s.stage === "preview-completion" ||
      s.stage === "analysis-completion",
  ).map((s) =>
    finding({
      type: "funnel-stage-unmeasured",
      subject: `${s.journey}-${s.stage}`,
      funnel: s.journey,
      title: `Funnel stage unmeasured: ${s.journey} / ${s.stage}`,
      expectedEvidence: `Repository journey stage for ${s.route}`,
      observedEvidence: s.note,
      confidence: 0.88,
      sampleSize: null,
      decisionEffect:
        s.stage === "tool-entry" ? "decision-degrading" : "monitor",
      severity: s.stage === "tool-entry" ? "medium" : "low",
      likelyDecisionImpact:
        "Tool performance and Opportunity readiness for this journey stay limited",
      affectedRoute: s.route,
      affectedEvent: null,
      recommendedNextAction:
        "Document the measurement gap; add journey events only in a later instrumentation pass after founder approval",
      whyItMatters:
        "Unsupported stages are gaps — Agent OS must not invent completion metrics",
      dependency: null,
      owner: "Founder / analytics",
      founderApprovalRequired: true,
      codeOrConfigChangeEventuallyRequired: true,
      blocksOtherExecutive: false,
      isInference: false,
      // Static repository gaps stay in JSON; avoid flooding every brief
      suppressRecommendation: true,
      suppressReason:
        "Repository journey gap retained in structured findings — defer from brief surfacing",
    }),
  );
}

function detectObservedUndocumented(
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const documented = new Set(
    [
      ...EXPECTED_EVENT_INVENTORY_NAMES(),
      ...observations.queriedEventNames,
    ].map((n) => n),
  );
  // Only flag events present in counts that are truly outside inventory
  const unexpected = Object.keys(observations.eventCounts).filter(
    (name) =>
      !EXPECTED_EVENT_INVENTORY_NAMES().includes(name) &&
      (observations.eventCounts[name]?.current ?? 0) > 0,
  );

  // Known GA4 allowlist extras that are documented in expected inventory partially
  const novel = unexpected.filter(
    (n) =>
      ![
        "finger_size_changed",
        "skin_tone_selected",
        "orientation_changed",
        "coverage_zone_changed",
      ].includes(n),
  );

  // Add studio progression events that are in GA4 but not in EXPECTED_EVENT_INVENTORY as mild docs gaps — skip to avoid noise
  void documented;
  void novel;

  // Cautious: only surface if fixture injects a truly undocumented event
  const undocumented = Object.entries(observations.eventCounts).filter(
    ([name, c]) =>
      c.current > 0 &&
      !EXPECTED_EVENT_INVENTORY_NAMES().includes(name) &&
      !(GA4_STUDIO_EXTRAS as readonly string[]).includes(name),
  );

  return undocumented.slice(0, 1).map(([name, c]) =>
    finding({
      type: "observed-event-not-documented",
      subject: name,
      funnel: "cross-cutting",
      title: `Observed event not in BI expected inventory: ${name}`,
      expectedEvidence: "Documented expected-event inventory",
      observedEvidence: `Observed count=${c.current} — documentation may be incomplete`,
      confidence: 0.55,
      sampleSize: c.current,
      decisionEffect: "monitor",
      severity: "low",
      likelyDecisionImpact: "Minor inventory hygiene — not a conversion claim",
      affectedRoute: null,
      affectedEvent: name,
      recommendedNextAction:
        "Document the event in the expected inventory or confirm it is intentional noise",
      whyItMatters: "Inventory drift can hide real naming inconsistencies later",
      dependency: null,
      owner: "Founder / analytics",
      founderApprovalRequired: false,
      codeOrConfigChangeEventuallyRequired: false,
      blocksOtherExecutive: false,
      isInference: true,
      suppressRecommendation: true,
      suppressReason: "Cautious monitor-only unless volume and decision impact rise",
    }),
  );
}

const GA4_STUDIO_EXTRAS = [
  "finger_size_changed",
  "skin_tone_selected",
  "orientation_changed",
  "coverage_zone_changed",
  "carat_changed",
] as const;

function EXPECTED_EVENT_INVENTORY_NAMES(): string[] {
  return [
    "page_view",
    "consultation_cta_clicked",
    "concierge_form_started",
    "concierge_form_submitted",
    "generate_lead",
    "diamond_studio_view",
    "studio_session_engaged",
    "shape_selected",
    "conversation_concierge_clicked",
    "conversation_related_resource_clicked",
    "home_clicked",
    ...GA4_STUDIO_EXTRAS,
  ];
}

function detectEventRegression(
  inventory: ExpectedEventInventoryItem[],
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations?.comparisonPeriod) return [];
  // Live unread / unavailable GA4 must not invent regressions from repository presence alone
  if (observations.mode !== "fixture" && !observations.ga4Available) {
    return [];
  }

  const cta = inventory.find(
    (e) => e.expectedEventName === "consultation_cta_clicked",
  );
  if (
    !cta ||
    cta.observedStatus === "unknown" ||
    cta.currentCount === null ||
    cta.previousCount === null ||
    cta.previousCount < MIN_REGRESSION_PRIOR
  ) {
    return [];
  }

  const drop =
    (cta.previousCount - cta.currentCount) / Math.max(cta.previousCount, 1);
  const studio = getEventCount(observations, "diamond_studio_view");
  const studioPrev =
    observations.eventCounts.diamond_studio_view?.previous ?? null;
  const upstreamStable =
    studio !== null &&
    studioPrev !== null &&
    Math.abs(studio - studioPrev) / Math.max(studioPrev, 1) < 0.15;

  if (drop >= REGRESSION_DROP_RATIO && upstreamStable) {
    return [
      finding({
        type: "measurement-regression",
        subject: "consultation-cta-clicked",
        funnel: "general-consultation",
        title: "Possible consultation CTA event-volume regression",
        expectedEvidence:
          "Stable event definition with comparable prior period and adequate prior sample",
        observedEvidence: `CTA current=${cta.currentCount}, previous=${cta.previousCount} (${Math.round(drop * 100)}% drop); Studio entry relatively stable`,
        confidence: 0.7,
        sampleSize: cta.previousCount,
        decisionEffect: "decision-degrading",
        severity: "high",
        likelyDecisionImpact:
          "Funnel intent signal may have degraded — verify instrumentation before demand conclusions",
        affectedRoute: "/concierge",
        affectedEvent: "consultation_cta_clicked",
        recommendedNextAction:
          "Audit a possible event-volume regression for consultation_cta_clicked against Studio stability; label as possible until instrumentation is verified",
        whyItMatters:
          "A conversion-intent proxy declining while upstream tool activity holds suggests measurement or placement issues",
        dependency: "Comparable periods + stable event name",
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: true,
        suppressRecommendation: false,
      }),
    ];
  }

  return [];
}

function detectAttributionIssues(
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const out: MeasurementFinding[] = [];

  const fragments = fragmentSourceMediumFamilies(
    observations.sourceMediumRows,
  ).filter(
    (f) =>
      f.variants.length >= FRAGMENT_MIN_VARIANTS &&
      f.sessions >= FRAGMENT_MIN_SESSIONS,
  );

  for (const frag of fragments.slice(0, 1)) {
    out.push(
      finding({
        type: "source-medium-anomaly",
        subject: frag.family,
        funnel: "cross-cutting",
        title: `Resolve source/medium fragmentation for ${frag.family}`,
        expectedEvidence:
          "Repeated source/medium variants with sufficient combined volume",
        observedEvidence: `${frag.variants.length} variants totaling ${frag.sessions} sessions (e.g. ${frag.variants
          .slice(0, 3)
          .map((v) => `${v.source}/${v.medium}`)
          .join(", ")})`,
        confidence: 0.72,
        sampleSize: frag.sessions,
        decisionEffect: "decision-degrading",
        severity: "medium",
        likelyDecisionImpact:
          "Channel comparisons become unreliable when one property fragments across labels",
        affectedRoute: null,
        affectedEvent: null,
        recommendedNextAction:
          "Resolve source/medium fragmentation for repeated high-volume variants; do not treat a single odd row as attribution failure",
        whyItMatters:
          "Fragmented attribution undermines Content and Opportunity channel judgments",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: false,
      }),
    );
  }

  const share = directTrafficShare(observations);
  const sessions = totalSessions(observations);
  if (
    share !== null &&
    share >= DIRECT_SHARE_THRESHOLD &&
    sessions >= DIRECT_MIN_SESSIONS
  ) {
    out.push(
      finding({
        type: "direct-traffic-overconcentration",
        subject: "direct-none",
        funnel: "cross-cutting",
        title: "Direct/none concentration may degrade channel attribution",
        expectedEvidence: "Diversified attributed channels with UTM survival",
        observedEvidence: `Direct share=${(share * 100).toFixed(0)}% of ${sessions} sessions`,
        confidence: 0.6,
        sampleSize: sessions,
        decisionEffect: "decision-degrading",
        severity: "medium",
        likelyDecisionImpact:
          "Channel performance comparisons are less trustworthy",
        affectedRoute: null,
        affectedEvent: null,
        recommendedNextAction:
          "Investigate direct/none concentration cautiously — may include dark social, bookmarks, or missing UTMs; do not overclaim failure from share alone",
        whyItMatters:
          "Over-concentrated direct traffic limits Search/Content/Opportunity channel decisions",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: true,
        suppressRecommendation: false,
      }),
    );
  } else if (share !== null && share >= DIRECT_SHARE_THRESHOLD) {
    out.push(
      finding({
        type: "sample-size-limitation",
        subject: "direct-share",
        funnel: "cross-cutting",
        title: "Direct share elevated but session volume too low to overclaim",
        expectedEvidence: `At least ${DIRECT_MIN_SESSIONS} sessions for concentration claims`,
        observedEvidence: `Direct share=${(share * 100).toFixed(0)}% on only ${sessions} sessions`,
        confidence: 0.65,
        sampleSize: sessions,
        decisionEffect: "monitor",
        severity: "low",
        likelyDecisionImpact: "Avoid overclaiming attribution failure",
        affectedRoute: null,
        affectedEvent: null,
        recommendedNextAction: "Monitor direct share until volume supports a claim",
        whyItMatters: "Small totals make concentration percentages noisy",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Insufficient session volume for direct-concentration claim",
      }),
    );
  }

  if (
    observations.mode === "live-derived" &&
    observations.sourceMediumRows.length === 0
  ) {
    out.push(
      finding({
        type: "attribution-gap",
        subject: "session-source-medium",
        funnel: "cross-cutting",
        title: "Session source/medium detail unavailable in Agent OS GA4 reads",
        expectedEvidence: "sessionSource / sessionMedium for attribution quality",
        observedEvidence:
          "Live adapter provides channel group + landings only — source/medium quality checks limited",
        confidence: 0.75,
        sampleSize: sessions || null,
        decisionEffect: "decision-degrading",
        severity: "medium",
        likelyDecisionImpact:
          "Fine-grained attribution anomalies cannot be confirmed from Agent OS alone",
        affectedRoute: null,
        affectedEvent: null,
        recommendedNextAction:
          "Use GA4 Explorations for source/medium audits; consider a later read-only adapter expansion",
        whyItMatters:
          "Channel-group summaries are not a substitute for campaign/UTM integrity checks",
        dependency: "GA4 source/medium read coverage",
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: true,
        suppressReason:
          "Static live limitation — retain in structured findings; avoid flooding brief",
      }),
    );
  }

  return out;
}

function detectDestinationQuality(
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const out: MeasurementFinding[] = [];

  // Shape Studio receives traffic but journey completion is unmeasured
  const shapeLanding = observations.landingPages.find((p) =>
    p.value.includes("/diamond-shape-studio"),
  );
  if (shapeLanding && shapeLanding.sessions >= 50) {
    out.push(
      finding({
        type: "destination-quality-gap",
        subject: "diamond-shape-studio",
        funnel: "see-it-on-your-hand",
        title:
          "Destination receives traffic but conversion path measurement is incomplete",
        expectedEvidence:
          "Landing exists with tool/Concierge path and measurable conversion",
        observedEvidence: `${shapeLanding.value} has ${shapeLanding.sessions} sessions; tool completion events are unsupported in repository`,
        confidence: 0.7,
        sampleSize: shapeLanding.sessions,
        decisionEffect: "decision-degrading",
        severity: "medium",
        likelyDecisionImpact:
          "Paid or distribution evaluation for this destination lacks conversion measurement",
        affectedRoute: "/diamond-shape-studio",
        affectedEvent: null,
        recommendedNextAction:
          "Confirm destination tracking and Concierge path measurement before evaluating paid search against this landing — missing tracking ≠ missing destination",
        whyItMatters:
          "Traffic without measurable handoff blocks Opportunity readiness for this route",
        dependency: "Tool journey measurement",
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: true,
        blocksOtherExecutive: true,
        blockedExecutive: "opportunity",
        isInference: false,
        suppressRecommendation: false,
      }),
    );
  }

  // Distinct: missing destination (no landing evidence for a known high-intent path)
  const hasConciergeLanding = observations.landingPages.some((p) =>
    p.value.includes("/concierge"),
  );
  if (!hasConciergeLanding && totalSessions(observations) >= 100) {
    out.push(
      finding({
        type: "destination-quality-gap",
        subject: "concierge-landing-absent",
        funnel: "general-consultation",
        title: "Concierge destination not present among top landings",
        expectedEvidence: "/concierge among observed landings when CTA paths exist",
        observedEvidence:
          "No /concierge row in observed top landings — distinct from missing event tracking",
        confidence: 0.55,
        sampleSize: totalSessions(observations),
        decisionEffect: "monitor",
        severity: "low",
        likelyDecisionImpact:
          "May be ranking cutoff rather than absent page — verify before acting",
        affectedRoute: "/concierge",
        affectedEvent: null,
        recommendedNextAction:
          "Check whether Concierge is a secondary landing outside the top-N pull — do not confuse with a missing route",
        whyItMatters:
          "Missing destination evidence differs from missing tracking on an existing page",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: true,
        suppressRecommendation: true,
        suppressReason: "Top-N landing absence is weak evidence of a missing page",
      }),
    );
  }

  return out;
}

function detectHealthyStudioProgression(
  inventory: ExpectedEventInventoryItem[],
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const entry = inventory.find((e) => e.expectedEventName === "diamond_studio_view");
  const shape = inventory.find((e) => e.expectedEventName === "shape_selected");
  const engaged = inventory.find(
    (e) => e.expectedEventName === "studio_session_engaged",
  );

  if (
    entry?.observedStatus === "observed" &&
    shape?.observedStatus === "observed" &&
    engaged?.observedStatus === "observed" &&
    (entry.currentCount ?? 0) >= MIN_FUNNEL_SAMPLE &&
    (engaged.currentCount ?? 0) > 0
  ) {
    return [
      finding({
        type: "measurement-healthy",
        subject: "diamond-studio-progression",
        funnel: "diamond-studio",
        title: "Size Studio entry→progression→engagement measurement looks healthy",
        expectedEvidence:
          "diamond_studio_view, shape_selected, and studio_session_engaged observed",
        observedEvidence: `view=${entry.currentCount}, shape_selected=${shape.currentCount}, engaged=${engaged.currentCount}`,
        confidence: 0.8,
        sampleSize: entry.currentCount,
        decisionEffect: "monitor",
        severity: "low",
        likelyDecisionImpact: "No problem recommendation for this healthy area",
        affectedRoute: "/diamond-studio",
        affectedEvent: "studio_session_engaged",
        recommendedNextAction: "Continue monitoring — no repair action required",
        whyItMatters:
          "Healthy measurement areas should not generate noise recommendations",
        dependency: null,
        owner: "Founder / analytics",
        founderApprovalRequired: false,
        codeOrConfigChangeEventuallyRequired: false,
        blocksOtherExecutive: false,
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Healthy measurement — retain as fact, no problem rec",
      }),
    ];
  }

  return [];
}

function detectLowValueMonitorGaps(
  inventory: ExpectedEventInventoryItem[],
): MeasurementFinding[] {
  const home = inventory.find((e) => e.expectedEventName === "home_clicked");
  if (!home) return [];

  return [
    finding({
      type: "event-name-inconsistency",
      subject: "home-clicked",
      funnel: "diamond-studio",
      title: "home_clicked is allowlisted but has no clear UI emitter",
      expectedEvidence: "Typed event with a production call site",
      observedEvidence:
        "Repository types/ingests home_clicked; no verified UI emitter — low conversion importance",
      confidence: 0.7,
      sampleSize: home.currentCount,
      decisionEffect: "monitor",
      severity: "low",
      likelyDecisionImpact: "Negligible for consultation decisions",
      affectedRoute: "/diamond-studio",
      affectedEvent: "home_clicked",
      recommendedNextAction:
        "Defer cleanup of low-value dead events until core conversion measurement is trustworthy",
      whyItMatters: "Low-importance gaps must not outrank decision-blocking work",
      dependency: null,
      owner: "Founder / analytics",
      founderApprovalRequired: false,
      codeOrConfigChangeEventuallyRequired: true,
      blocksOtherExecutive: false,
      isInference: false,
      suppressRecommendation: true,
      suppressReason: "Low-value event gap remains monitor-only",
    }),
  ];
}

function detectSampleSizeLimitations(
  observations: BiConversionObservationBundle | null,
): MeasurementFinding[] {
  if (!observations) return [];
  const tiny = Object.entries(observations.eventCounts).filter(
    ([name, c]) =>
      c.current > 0 &&
      c.current < 5 &&
      name !== "home_clicked", // already covered
  );
  // Suppress false-alarm drop-off from tiny decorative events
  if (tiny.length === 0) return [];
  const [name, c] = tiny[0];
  return [
    finding({
      type: "event-volume-too-low",
      subject: name,
      funnel: "cross-cutting",
      title: `Event volume too low for decisions: ${name}`,
      expectedEvidence: "Adequate sample before ratio or drop-off claims",
      observedEvidence: `Only ${c.current} events in the observation period`,
      confidence: 0.75,
      sampleSize: c.current,
      decisionEffect: "monitor",
      severity: "low",
      likelyDecisionImpact: "Suppresses false-alarm funnel conclusions",
      affectedRoute: null,
      affectedEvent: name,
      recommendedNextAction: "Do not use this event for drop-off or ROI claims",
      whyItMatters: "Small samples invent urgency",
      dependency: null,
      owner: "Founder / analytics",
      founderApprovalRequired: false,
      codeOrConfigChangeEventuallyRequired: false,
      blocksOtherExecutive: false,
      isInference: false,
      suppressRecommendation: true,
      suppressReason: "Small-sample false alarm suppressed from recommendations",
    }),
  ];
}

function finding(input: {
  type: MeasurementFinding["type"];
  subject: string;
  funnel: MeasurementFinding["affectedFunnel"];
  title: string;
  expectedEvidence: string;
  observedEvidence: string;
  confidence: number;
  sampleSize: number | null;
  decisionEffect: MeasurementDecisionEffect;
  severity: MeasurementFinding["severity"];
  likelyDecisionImpact: string;
  affectedRoute: string | null;
  affectedEvent: string | null;
  recommendedNextAction: string;
  whyItMatters: string;
  dependency: string | null;
  owner: string;
  founderApprovalRequired: boolean;
  codeOrConfigChangeEventuallyRequired: boolean;
  blocksOtherExecutive: boolean;
  blockedExecutive?: MeasurementFinding["blockedExecutive"];
  isInference: boolean;
  suppressRecommendation: boolean;
  suppressReason?: string | null;
}): MeasurementFinding {
  return {
    id: buildMeasurementFindingId({
      type: input.type,
      subject: input.subject,
      funnel: input.funnel,
    }),
    type: input.type,
    title: input.title,
    expectedEvidence: input.expectedEvidence,
    observedEvidence: input.observedEvidence,
    confidence: input.confidence,
    sampleSize: input.sampleSize,
    freshness: "current",
    severity: input.severity,
    decisionEffect: input.decisionEffect,
    likelyDecisionImpact: input.likelyDecisionImpact,
    affectedFunnel: input.funnel,
    affectedRoute: input.affectedRoute,
    affectedEvent: input.affectedEvent,
    recommendedNextAction: input.recommendedNextAction,
    whyItMatters: input.whyItMatters,
    dependency: input.dependency,
    owner: input.owner,
    founderApprovalRequired: input.founderApprovalRequired,
    codeOrConfigChangeEventuallyRequired:
      input.codeOrConfigChangeEventuallyRequired,
    blocksOtherExecutive: input.blocksOtherExecutive,
    blockedExecutive: input.blockedExecutive ?? null,
    isInference: input.isInference,
    suppressRecommendation: input.suppressRecommendation,
    suppressReason: input.suppressReason ?? null,
  };
}

function dedupeFindings(findings: MeasurementFinding[]): MeasurementFinding[] {
  const seen = new Set<string>();
  const out: MeasurementFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

/** Export funnel defs for readiness/tests. */
export function listAuditedFunnels() {
  return FUNNEL_DEFINITIONS;
}
