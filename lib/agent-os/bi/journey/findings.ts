/**
 * Client Journey finding detection.
 * Observed behavior requires verified analytics; repository links stay repository-available.
 */

import { buildJourneyFindingId } from "./ids";
import {
  buildJourneySurfaceInventory,
  buildRepositoryTransitions,
  CONTENT_HANDOFF_GUIDE_TO_TOOL_KEY,
  CONTENT_HANDOFF_TRUST_NARRATIVE_KEY,
  findSurfaceByRoute,
  normalizeRoute,
} from "./inventory";
import {
  getQueriedEventCount,
  landingSessions,
  observedTransitionSessions,
  totalLandingSessions,
} from "./observe";
import type {
  ConversionSignal,
  JourneyEvidenceClass,
  JourneyFinding,
  JourneyObservationBundle,
  JourneySourceGap,
  JourneySurface,
  JourneyTransition,
  JourneyTransitionState,
} from "./types";
import {
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
} from "./types";
import { CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID } from "../types";

/** Reuse BI funnel sample floor for journey progression claims. */
export const MIN_JOURNEY_SAMPLE = 40;
/** Next-step movement below this share of entry is "weak" when both observed. */
export const WEAK_NEXT_STEP_RATIO = 0.15;
/** Healthy next-step share (homepage / guide) when path measurement exists. */
export const HEALTHY_NEXT_STEP_RATIO = 0.25;

export function detectJourneyFindings(input: {
  observations: JourneyObservationBundle | null;
  surfaces?: JourneySurface[];
}): {
  findings: JourneyFinding[];
  transitions: JourneyTransition[];
  conversionSignals: ConversionSignal[];
  sourceGaps: JourneySourceGap[];
  surfaces: JourneySurface[];
} {
  const surfaces = input.surfaces ?? buildJourneySurfaceInventory();
  const { observations } = input;

  const conversionSignals = buildConversionSignals(observations);
  const sourceGaps = buildStableSourceGaps(observations, conversionSignals);
  const transitions = buildTransitionRecords(surfaces, observations);

  const findings: JourneyFinding[] = [];

  if (!observations) {
    findings.push(sourceUnavailableFinding());
    return {
      findings: dedupeFindings(findings),
      transitions,
      conversionSignals,
      sourceGaps,
      surfaces,
    };
  }

  findings.push(...detectHighEntryWeakNextStep(surfaces, observations));
  findings.push(...detectGuideToToolMovement(surfaces, observations));
  findings.push(...detectToolCompletionGaps(surfaces, observations, sourceGaps));
  findings.push(
    ...detectRepositoryToolToConversation(surfaces, observations, transitions),
  );
  findings.push(...detectLowSampleJourneys(surfaces, observations));
  findings.push(...detectHealthyJourneyCoverage(surfaces, observations));
  findings.push(...detectLandingIntentMismatch(observations));
  findings.push(...detectContentToToolDisconnect(surfaces, observations));
  findings.push(...detectTrustUnderuse(surfaces, observations));
  findings.push(
    ...detectConversionSignalUnknown(conversionSignals, observations),
  );
  findings.push(...detectMeasurementBlocked(sourceGaps, observations));
  findings.push(...detectDeadEndAndUnclearNext(surfaces));
  findings.push(...detectFragmentedJourney(surfaces, observations));

  return {
    findings: dedupeFindings(findings),
    transitions,
    conversionSignals,
    sourceGaps,
    surfaces: annotateSurfaceObservability(surfaces, observations),
  };
}

function annotateSurfaceObservability(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneySurface[] {
  return surfaces.map((s) => {
    const sessions = landingSessions(observations, s.route);
    const hasLanding = sessions > 0;
    return {
      ...s,
      observability: hasLanding
        ? s.observability === "unobservable"
          ? "partial"
          : s.observability
        : s.observability,
      measurementSource: hasLanding ? "ga4" : s.measurementSource,
      confidence: hasLanding ? Math.min(0.95, s.confidence + 0.05) : s.confidence,
    };
  });
}

function buildTransitionRecords(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle | null,
): JourneyTransition[] {
  const out: JourneyTransition[] = [];

  if (observations?.pathMeasurementAvailable) {
    for (const t of observations.transitions) {
      const from = findSurfaceByRoute(surfaces, t.fromRoute);
      const to = findSurfaceByRoute(surfaces, t.toRoute);
      out.push({
        id: `transition-observed-${normalizeRoute(t.fromRoute)}-${normalizeRoute(t.toRoute)}`,
        fromSurfaceId: from?.id ?? `unknown:${t.fromRoute}`,
        toSurfaceId: to?.id ?? `unknown:${t.toRoute}`,
        fromRoute: normalizeRoute(t.fromRoute),
        toRoute: normalizeRoute(t.toRoute),
        state: "observed",
        sessionsOrCount: t.sessions,
        evidenceClass: "observed-analytics",
        evidenceNote: `Observed path transition sessions=${t.sessions}`,
        confidence: t.sessions >= MIN_JOURNEY_SAMPLE ? 0.82 : 0.45,
      });
    }
  }

  for (const link of buildRepositoryTransitions(surfaces)) {
    const alreadyObserved = out.some(
      (t) =>
        t.fromRoute === link.fromRoute &&
        t.toRoute === link.toRoute &&
        t.state === "observed",
    );
    if (alreadyObserved) continue;
    const from = findSurfaceByRoute(surfaces, link.fromRoute);
    const to = findSurfaceByRoute(surfaces, link.toRoute);
    out.push({
      id: `transition-repo-${link.fromRoute}-${link.toRoute}`,
      fromSurfaceId: from?.id ?? `unknown:${link.fromRoute}`,
      toSurfaceId: to?.id ?? `unknown:${link.toRoute}`,
      fromRoute: link.fromRoute,
      toRoute: link.toRoute,
      state: "repository-available",
      sessionsOrCount: null,
      evidenceClass: "repository-backed",
      evidenceNote: link.note,
      confidence: 0.88,
    });
  }

  return out;
}

function buildConversionSignals(
  observations: JourneyObservationBundle | null,
): ConversionSignal[] {
  const signals: ConversionSignal[] = [
    signal("studio-entry", "Studio entry (diamond_studio_view)", "ga4", observations),
    signal(
      "studio-completion",
      "Studio soft-completion (studio_session_engaged)",
      "ga4",
      observations,
    ),
    signal("cta-click", "Consultation CTA click", "ga4", observations, "consultation_cta_clicked"),
    signal("form-submit", "Concierge form submit", "ga4", observations, "concierge_form_submitted"),
    signal(
      "appointment-request",
      "Authoritative conversion (generate_lead)",
      "ga4",
      observations,
      "generate_lead",
    ),
    signal(
      "conversation-start",
      "Concierge form start",
      "ga4",
      observations,
      "concierge_form_started",
    ),
    signal("concierge-visit", "Concierge landing visits", "ga4", observations),
    {
      id: "signal-guide-to-studio",
      kind: "guide-to-studio",
      label: "Guide → Studio path movement",
      source: observations?.pathMeasurementAvailable ? "ga4" : "none",
      availability: observations?.pathMeasurementAvailable
        ? observedTransitionSessions(observations, "/diamond-guide") > 0
          ? "observed"
          : "not-observed"
        : "unknown",
      observedStatus: observations?.pathMeasurementAvailable
        ? observedTransitionSessions(observations, "/diamond-guide") > 0
          ? "observed"
          : "not-observed"
        : "unknown",
      count: observations?.pathMeasurementAvailable
        ? observedTransitionSessions(observations, "/diamond-guide", "/diamond-studio")
        : null,
      confidence: observations?.pathMeasurementAvailable ? 0.7 : 0.2,
      supportsFounderConclusions: Boolean(
        observations?.pathMeasurementAvailable &&
          observedTransitionSessions(observations, "/diamond-guide", "/diamond-studio") >=
            MIN_JOURNEY_SAMPLE * 0.5,
      ),
      note: observations?.pathMeasurementAvailable
        ? "Path measurement available for guide→tool claims"
        : "Path measurement unavailable — guide→Studio movement unknown",
    },
    {
      id: "signal-click-to-call",
      kind: "click-to-call",
      label: "Click-to-call",
      source: "none",
      availability: "unsupported",
      observedStatus: "unknown",
      count: null,
      confidence: 0,
      supportsFounderConclusions: false,
      note: "No verified call-tracking adapter in Agent OS V1",
    },
    {
      id: "signal-email-click",
      kind: "email-click",
      label: "Email click",
      source: "none",
      availability: "unsupported",
      observedStatus: "unknown",
      count: null,
      confidence: 0,
      supportsFounderConclusions: false,
      note: "No verified email-click adapter in Agent OS V1",
    },
  ];
  return signals;
}

function signal(
  kind: ConversionSignal["kind"],
  label: string,
  source: "ga4" | "repository" | "none",
  observations: JourneyObservationBundle | null,
  eventName?: string,
): ConversionSignal {
  if (kind === "concierge-visit") {
    const count = landingSessions(observations, "/concierge");
    return {
      id: `signal-${kind}`,
      kind,
      label,
      source,
      availability: observations ? (count > 0 ? "observed" : "not-observed") : "unknown",
      observedStatus: observations
        ? count > 0
          ? "observed"
          : "not-observed"
        : "unknown",
      count: observations ? count : null,
      confidence: observations ? 0.75 : 0.2,
      supportsFounderConclusions: false,
      note: "Landing sessions are engagement, not conversion",
    };
  }

  const event =
    eventName ??
    (kind === "studio-entry"
      ? "diamond_studio_view"
      : kind === "studio-completion"
        ? "studio_session_engaged"
        : kind === "cta-click"
          ? "consultation_cta_clicked"
          : null);

  if (!event) {
    return {
      id: `signal-${kind}`,
      kind,
      label,
      source,
      availability: "unknown",
      observedStatus: "unknown",
      count: null,
      confidence: 0.2,
      supportsFounderConclusions: false,
      note: "No mapped event",
    };
  }

  const count = getQueriedEventCount(observations, event);
  const queried = observations?.queriedEventNames.includes(event) ?? false;

  let availability: ConversionSignal["availability"];
  let observedStatus: ConversionSignal["observedStatus"];
  if (!observations || !queried) {
    availability = "unknown";
    observedStatus = "unknown";
  } else if ((count ?? 0) > 0) {
    availability = "observed";
    observedStatus = "observed";
  } else {
    availability = "not-observed";
    observedStatus = "not-observed";
  }

  const isConversionCore =
    kind === "form-submit" || kind === "appointment-request";

  return {
    id: `signal-${kind}`,
    kind,
    label,
    source,
    availability,
    observedStatus,
    count,
    confidence: queried && observations ? 0.8 : 0.25,
    supportsFounderConclusions:
      isConversionCore && observedStatus === "observed" && (count ?? 0) > 0,
    note: !queried
      ? "Event not in current Agent OS GA4 allowlist — status unknown (not proof of zero conversions)"
      : observedStatus === "not-observed"
        ? "Queried event returned zero in observation set — still not proof of zero real conversions without healthy verified measurement"
        : "Observed analytics volume present",
  };
}

function buildStableSourceGaps(
  observations: JourneyObservationBundle | null,
  signals: ConversionSignal[],
): JourneySourceGap[] {
  const gaps: JourneySourceGap[] = [];

  const pathUnavailable =
    !observations || !observations.pathMeasurementAvailable;
  if (pathUnavailable) {
    gaps.push({
      id: JOURNEY_PATH_MEASUREMENT_GAP_ID,
      source: "ga4",
      scope: "page-path / next-page transitions",
      affectedAnalyses: [
        "landing→next-step",
        "guide→tool",
        "tool→conversation path",
        "exit/abandonment",
      ],
      // Distinct adapter capability from Concierge conversion events — but it is an
      // internal analytics implementation task that does not block a current founder
      // decision without verified path-dependent findings. Keep stable ID; suppress brief.
      founderRelevance: "diagnostic",
      resolutionPrerequisite:
        "Add verified read-only path/next-page analytics before diagnosing journey drop-off",
      suppressFromFounderRanking: true,
      parentRootId: null,
      mayAppearIndependentlyInBrief: false,
    });
  }

  const conversionUnknown = signals.some(
    (s) =>
      (s.kind === "form-submit" || s.kind === "appointment-request") &&
      (s.availability === "unknown" || s.availability === "not-observed"),
  );
  if (conversionUnknown) {
    gaps.push({
      id: CONVERSION_EVENT_MEASUREMENT_GAP_ID,
      source: "ga4",
      scope: "Concierge form submit / generate_lead",
      affectedAnalyses: [
        "conversion performance",
        "funnel rates",
        "source-to-lead",
      ],
      founderRelevance: "prerequisite",
      resolutionPrerequisite:
        "Verify one authoritative Concierge conversion signal in Agent OS GA4 reads",
      // Child of existing BI Concierge conversion measurement root when that root exists
      suppressFromFounderRanking: false,
      parentRootId: CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
      mayAppearIndependentlyInBrief: false,
    });
  }

  gaps.push({
    id: TOOL_COMPLETION_MEASUREMENT_GAP_ID,
    source: "ga4",
    scope: "See It On Your Hand / Analyze Sparkle completion; Studio soft-completion coverage",
    affectedAnalyses: ["tool completion", "tool→conversation quality"],
    founderRelevance: "diagnostic",
    resolutionPrerequisite:
      "Instrument or expose verified tool-completion events before claiming completion rates",
    suppressFromFounderRanking: true,
    parentRootId: null,
    mayAppearIndependentlyInBrief: false,
  });

  gaps.push({
    id: SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
    source: "cross-cutting",
    scope: "channel/source → qualified lead linkage",
    affectedAnalyses: ["attribution", "channel ROI", "paid readiness"],
    founderRelevance: "diagnostic",
    resolutionPrerequisite:
      "Connect verified conversion events to source/medium before attributing leads",
    suppressFromFounderRanking: true,
    parentRootId: CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
    mayAppearIndependentlyInBrief: false,
  });

  return gaps;
}

function detectHighEntryWeakNextStep(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  // Live safety: landing totals alone never prove weak next-step movement.
  // Requires verified path measurement AND at least one observed transition row.
  if (!observations.pathMeasurementAvailable) {
    return [];
  }
  if (observations.transitions.length === 0) {
    // Path measurement claimed available but no transitions → unknown, not zero/weak
    return [];
  }

  const findings: JourneyFinding[] = [];
  for (const page of observations.landingPages) {
    if (page.sessions < MIN_JOURNEY_SAMPLE) continue;
    const surface = findSurfaceByRoute(surfaces, page.route);
    if (!surface) continue;
    if (
      surface.surfaceType === "inquiry" ||
      surface.surfaceType === "conversion" ||
      surface.role === "inquiry-conversion"
    ) {
      continue;
    }

    const next = observedTransitionSessions(observations, page.route);
    const ratio = next / page.sessions;
    if (ratio >= WEAK_NEXT_STEP_RATIO) continue;

    findings.push(
      finding({
        type: "high-entry-weak-next-step",
        subject: page.route,
        title: `High entry on ${surface.label} with weak observed next-step movement`,
        evidenceClass: "observed-analytics",
        expectedEvidence:
          "Observed landing sessions with measurable next-page movement toward intended tools/trust/conversion",
        observedEvidence: `Landing sessions=${page.sessions}; observed next-step sessions=${next} (${(ratio * 100).toFixed(1)}%)`,
        confidence: 0.78,
        sampleSize: page.sessions,
        severity: "high",
        affectedSurfaceId: surface.id,
        affectedRoute: page.route,
        transitionState: "observed",
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: null,
        deduplicationKey: `high-entry-weak-next|${normalizeRoute(page.route)}`,
        recommendedNextAction:
          "Inspect on-page next-step clarity for this high-entry route using observed path evidence — do not increase traffic until the path is clearer",
        whyItMatters:
          "Prospects enter a high-traffic surface but rarely continue to intended tools or conversation",
        isInference: false,
        suppressRecommendation: false,
        founderRankable: true,
      }),
    );
  }
  return findings;
}

function detectGuideToToolMovement(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  if (!observations.pathMeasurementAvailable) return [];

  const findings: JourneyFinding[] = [];
  for (const page of observations.landingPages) {
    if (!page.route.includes("/diamond-guide")) continue;
    if (page.sessions < MIN_JOURNEY_SAMPLE) continue;

    const toStudio = observedTransitionSessions(
      observations,
      page.route,
      "/diamond-studio",
    );
    if (toStudio <= 0) continue;
    const ratio = toStudio / page.sessions;
    if (ratio < HEALTHY_NEXT_STEP_RATIO) continue;

    const surface = findSurfaceByRoute(surfaces, page.route);
    findings.push(
      finding({
        type: "healthy-journey-coverage",
        subject: `guide-to-tool-${page.route}`,
        title: `Guide entry shows observed tool movement (${surface?.label ?? page.route})`,
        evidenceClass: "observed-analytics",
        expectedEvidence: "Guide landing with observed transitions into Studio tools",
        observedEvidence: `Guide landing sessions=${page.sessions}; observed → /diamond-studio sessions=${toStudio}`,
        confidence: 0.8,
        sampleSize: page.sessions,
        severity: "low",
        affectedSurfaceId: surface?.id ?? null,
        affectedRoute: page.route,
        transitionState: "observed",
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: null,
        deduplicationKey: `guide-to-tool-healthy|${normalizeRoute(page.route)}`,
        recommendedNextAction:
          "No action required — preserve the guide→tool path; monitor rather than expand recklessly",
        whyItMatters:
          "Observed guide→tool movement is a healthy education-to-visualization signal",
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Healthy coverage — monitor only",
        founderRankable: false,
      }),
    );
  }
  return findings;
}

function detectToolCompletionGaps(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
  sourceGaps: JourneySourceGap[],
): JourneyFinding[] {
  const studioEntry = getQueriedEventCount(observations, "diamond_studio_view") ?? 0;
  const softComplete =
    getQueriedEventCount(observations, "studio_session_engaged");
  const findings: JourneyFinding[] = [];

  if (studioEntry >= MIN_JOURNEY_SAMPLE && softComplete === null) {
    findings.push(
      finding({
        type: "strong-engagement-missing-conversion-signal",
        subject: "diamond-studio-completion",
        title: "Studio entry observed but completion measurement unavailable",
        evidenceClass: "source-gap",
        expectedEvidence:
          "Verified tool-completion or soft-completion signal alongside Studio entry",
        observedEvidence: `diamond_studio_view=${studioEntry}; studio_session_engaged not queried — completion unknown`,
        confidence: 0.72,
        sampleSize: studioEntry,
        severity: "medium",
        affectedSurfaceId: "surface-diamond-studio",
        affectedRoute: "/diamond-studio",
        transitionState: "unknown",
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: TOOL_COMPLETION_MEASUREMENT_GAP_ID,
        deduplicationKey: "tool-completion-root",
        recommendedNextAction:
          "Verify Studio completion / soft-completion measurement before diagnosing tool abandonment",
        whyItMatters:
          "Entry without completion visibility blocks responsible tool-friction diagnosis",
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Folded into tool-completion root source gap",
        founderRankable: false,
      }),
    );
  }

  // See It On Your Hand / Analyze Sparkle — repository tools without completion events
  for (const route of ["/diamond-shape-studio", "/diamond-intelligence"]) {
    const surface = findSurfaceByRoute(surfaces, route);
    const entry = landingSessions(observations, route);
    findings.push(
      finding({
        type: "measurement-blocked-journey",
        subject: `tool-completion-${route}`,
        title: `${surface?.label ?? route} lacks verified completion measurement`,
        evidenceClass: "source-gap",
        expectedEvidence: "Verified mid-funnel / completion events for this tool",
        observedEvidence:
          entry > 0
            ? `Landing sessions=${entry}; completion events unsupported in Agent OS inventory`
            : "Completion events unsupported in Agent OS inventory (repository readiness only)",
        confidence: 0.7,
        sampleSize: entry || null,
        severity: "medium",
        affectedSurfaceId: surface?.id ?? null,
        affectedRoute: route,
        transitionState: "unsupported",
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: TOOL_COMPLETION_MEASUREMENT_GAP_ID,
        deduplicationKey: "tool-completion-root",
        recommendedNextAction:
          sourceGaps.find((g) => g.id === TOOL_COMPLETION_MEASUREMENT_GAP_ID)
            ?.resolutionPrerequisite ??
          "Establish tool-completion measurement before claiming completion rates",
        whyItMatters:
          "Without completion signals, tool engagement cannot be distinguished from bounce",
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Consolidated under tool-completion root gap",
        founderRankable: false,
      }),
    );
  }

  return findings;
}

function detectRepositoryToolToConversation(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
  transitions: JourneyTransition[],
): JourneyFinding[] {
  const findings: JourneyFinding[] = [];
  const toolSurfaces = surfaces.filter((s) => s.surfaceType === "tool");

  for (const tool of toolSurfaces) {
    const repo = transitions.find(
      (t) =>
        t.fromRoute === tool.route &&
        t.toRoute === "/concierge" &&
        t.state === "repository-available",
    );
    if (!repo) continue;

    const observed = transitions.find(
      (t) =>
        t.fromRoute === tool.route &&
        t.toRoute === "/concierge" &&
        t.state === "observed",
    );

    if (observed) continue;

    findings.push(
      finding({
        type: "tool-to-conversation-disconnect",
        subject: tool.route,
        title: `${tool.label} → Concierge path is repository-available, not observed`,
        evidenceClass: "repository-backed",
        expectedEvidence:
          "Observed tool→Concierge transitions or verified CTA completion",
        observedEvidence: observations.pathMeasurementAvailable
          ? "Path measurement available but no observed tool→Concierge transition in the set"
          : "Repository CTA/link exists; path-level analytics unavailable — transition state repository-available only",
        confidence: 0.74,
        sampleSize: landingSessions(observations, tool.route) || null,
        severity: "medium",
        affectedSurfaceId: tool.id,
        affectedRoute: tool.route,
        transitionState: "repository-available",
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: observations.pathMeasurementAvailable
          ? null
          : JOURNEY_PATH_MEASUREMENT_GAP_ID,
        deduplicationKey: `tool-to-conversation|${tool.route}`,
        recommendedNextAction: observations.pathMeasurementAvailable
          ? "Inspect Studio→Concierge CTA clarity using observed path gaps"
          : "Do not treat repository tool→Concierge links as observed user flow; close path measurement before diagnosing disconnect",
        whyItMatters:
          "Intended conversion path exists in the site structure but is not proven by analytics",
        isInference: false,
        suppressRecommendation: !observations.pathMeasurementAvailable,
        suppressReason: !observations.pathMeasurementAvailable
          ? "Deferred to journey-path measurement root gap"
          : null,
        founderRankable: Boolean(observations.pathMeasurementAvailable),
      }),
    );
  }

  return findings;
}

function detectLowSampleJourneys(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  const findings: JourneyFinding[] = [];
  for (const page of observations.landingPages) {
    if (page.sessions <= 0 || page.sessions >= MIN_JOURNEY_SAMPLE) continue;
    const surface = findSurfaceByRoute(surfaces, page.route);
    if (!surface) continue;
    if (
      surface.surfaceType !== "local-guide" &&
      surface.surfaceType !== "trust" &&
      !page.route.includes("charlotte")
    ) {
      continue;
    }

    findings.push(
      finding({
        type: "insufficient-sample",
        subject: page.route,
        title: `Low-sample journey on ${surface.label}`,
        evidenceClass: "observed-analytics",
        expectedEvidence: `At least ${MIN_JOURNEY_SAMPLE} comparable landing sessions before progression claims`,
        observedEvidence: `Landing sessions=${page.sessions} — below sample floor`,
        confidence: 0.4,
        sampleSize: page.sessions,
        severity: "low",
        affectedSurfaceId: surface.id,
        affectedRoute: page.route,
        transitionState: null,
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: null,
        deduplicationKey: `insufficient-sample|${normalizeRoute(page.route)}`,
        recommendedNextAction:
          "Monitor only — do not escalate low-sample local/trust journeys into founder priorities",
        whyItMatters:
          "Thin samples amplify noise and produce unreliable journey conclusions",
        isInference: false,
        suppressRecommendation: true,
        suppressReason: "Low sample — monitor/defer",
        founderRankable: false,
      }),
    );
  }
  return findings;
}

function detectHealthyJourneyCoverage(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  if (!observations.pathMeasurementAvailable) return [];
  const home = landingSessions(observations, "/");
  if (home < MIN_JOURNEY_SAMPLE) return [];
  const next = observedTransitionSessions(observations, "/");
  const ratio = next / home;
  if (ratio < HEALTHY_NEXT_STEP_RATIO) return [];

  return [
    finding({
      type: "healthy-journey-coverage",
      subject: "homepage",
      title: "Homepage shows healthy observed next-step coverage",
      evidenceClass: "observed-analytics",
      expectedEvidence: "Homepage entry with solid next-step movement",
      observedEvidence: `Homepage sessions=${home}; observed next-step sessions=${next} (${(ratio * 100).toFixed(1)}%)`,
      confidence: 0.8,
      sampleSize: home,
      severity: "low",
      affectedSurfaceId: "surface-homepage",
      affectedRoute: "/",
      transitionState: "observed",
      owner: "business-intelligence",
      handoffTarget: null,
      rootSourceGapId: null,
      deduplicationKey: "healthy-homepage",
      recommendedNextAction: "No founder action — healthy coverage",
      whyItMatters: "Confirms homepage continues to intended surfaces",
      isInference: false,
      suppressRecommendation: true,
      suppressReason: "Healthy — no recommendation",
      founderRankable: false,
    }),
  ];
}

function detectLandingIntentMismatch(
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  if (!observations.gscAvailable || observations.gscTopQueries.length === 0) {
    return [];
  }

  const findings: JourneyFinding[] = [];
  for (const q of observations.gscTopQueries) {
    if (q.clicks < 40) continue;
    const page = q.page ? normalizeRoute(q.page) : null;
    if (!page) continue;

    // High-intent custom/local query landing on weakly aligned commercial page
    const intentCustom = /custom|bespoke|design/i.test(q.query);
    const intentLocal = /charlotte|waxhaw|fort mill/i.test(q.query);
    if (!intentCustom && !intentLocal) continue;

    const aligned =
      (intentCustom && page.includes("custom")) ||
      (intentLocal &&
        (page.includes("charlotte") ||
          page.includes("engagement") ||
          page.includes("concierge")));

    if (aligned) continue;

    findings.push(
      finding({
        type: "landing-intent-mismatch",
        subject: q.query,
        title: `Search intent may mismatch landing page for “${q.query}”`,
        evidenceClass: "inferred",
        expectedEvidence:
          "High-intent query landing on an aligned commercial/local/guide surface",
        observedEvidence: `GSC clicks=${q.clicks} for query; associated page=${page} — alignment uncertain`,
        confidence: 0.55,
        sampleSize: q.clicks,
        severity: "medium",
        affectedSurfaceId: null,
        affectedRoute: page,
        transitionState: "inferred",
        owner: "search-strategy",
        handoffTarget: "search-strategy",
        rootSourceGapId: null,
        deduplicationKey: `landing-intent-mismatch|${q.query.toLowerCase()}`,
        recommendedNextAction:
          "Search Strategy should evaluate query→landing alignment; do not treat as observed user-path abandonment",
        whyItMatters:
          "Misaligned search landings waste high-intent discovery before journey progression starts",
        isInference: true,
        suppressRecommendation: true,
        suppressReason: "Internal handoff to Search Strategy",
        founderRankable: false,
      }),
    );
  }
  return findings;
}

function detectContentToToolDisconnect(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  // Repository guide→tool links without observed movement when path measurement exists
  if (!observations.pathMeasurementAvailable) return [];

  const weakGuides: Array<{
    route: string;
    sessions: number;
    toTool: number;
    surface: JourneySurface | undefined;
  }> = [];

  const guideLandings = observations.landingPages.filter(
    (p) =>
      p.route.includes("/diamond-guide") && p.sessions >= MIN_JOURNEY_SAMPLE,
  );

  for (const page of guideLandings) {
    const toTool = observedTransitionSessions(
      observations,
      page.route,
      "/diamond-studio",
    );
    const ratio = toTool / page.sessions;
    // Healthy guide→tool paths do not emit Content handoffs
    if (ratio >= WEAK_NEXT_STEP_RATIO) continue;

    weakGuides.push({
      route: page.route,
      sessions: page.sessions,
      toTool,
      surface: findSurfaceByRoute(surfaces, page.route),
    });
  }

  if (weakGuides.length === 0) return [];

  // One canonical Content handoff root — not one unresolved item per route
  const examples = weakGuides
    .slice(0, 3)
    .map((g) => `${g.route} (entry=${g.sessions}, →Studio=${g.toTool})`)
    .join("; ");

  return [
    finding({
      type: "content-to-tool-disconnect",
      subject: "guide-to-tool-root",
      title:
        "Guide content shows weak observed movement into Studio tools",
      evidenceClass: "observed-analytics",
      expectedEvidence: "Guide landings progressing into Diamond Studio suite",
      observedEvidence: `${weakGuides.length} guide surface(s) below next-step floor: ${examples}`,
      confidence: 0.7,
      sampleSize: weakGuides.reduce((s, g) => s + g.sessions, 0),
      severity: "medium",
      affectedSurfaceId: weakGuides[0]?.surface?.id ?? null,
      affectedRoute: weakGuides[0]?.route ?? null,
      transitionState: "observed",
      owner: "content",
      handoffTarget: "content",
      rootSourceGapId: null,
      deduplicationKey: CONTENT_HANDOFF_GUIDE_TO_TOOL_KEY,
      recommendedNextAction:
        "Content owns editorial bridging from guide copy to Studio entry — BI retains measurement diagnosis. Consolidate guide→tool bridging as one production theme.",
      whyItMatters:
        "Education surfaces are not converting attention into visualization tools",
      isInference: false,
      suppressRecommendation: true,
      suppressReason: "Internal Content handoff — not founder-rankable",
      founderRankable: false,
    }),
  ];
}

function detectTrustUnderuse(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  const total = totalLandingSessions(observations);
  if (total < 200) return [];

  const trust = surfaces.filter(
    (s) =>
      s.role === "trust" ||
      s.surfaceType === "trust" ||
      s.route === "/whispered-praise",
  );
  const thin: Array<{ surface: JourneySurface; sessions: number }> = [];
  for (const s of trust) {
    const sessions = landingSessions(observations, s.route);
    if (sessions > 0 && sessions / total >= 0.02) continue;
    // Low-sample trust paths do not emit production work
    if (sessions > 0 && sessions < MIN_JOURNEY_SAMPLE) continue;
    if (sessions >= MIN_JOURNEY_SAMPLE) continue;
    // sessions === 0 with large site traffic → candidate underuse
    thin.push({ surface: s, sessions });
  }

  if (thin.length === 0) return [];

  const examples = thin
    .slice(0, 3)
    .map((t) => `${t.surface.route} (sessions=${t.sessions})`)
    .join("; ");

  return [
    finding({
      type: "trust-surface-underuse",
      subject: "trust-narrative-root",
      title: "Trust surfaces show thin observed entry relative to site traffic",
      evidenceClass: "observed-analytics",
      expectedEvidence: "Meaningful landing share on trust surfaces",
      observedEvidence: `${thin.length} trust surface(s): ${examples}; total landing sessions≈${total}`,
      confidence: 0.5,
      sampleSize: thin.reduce((s, t) => s + t.sessions, 0) || null,
      severity: "low",
      affectedSurfaceId: thin[0]?.surface.id ?? null,
      affectedRoute: thin[0]?.surface.route ?? null,
      transitionState: null,
      owner: "content",
      handoffTarget: "content",
      rootSourceGapId: null,
      deduplicationKey: CONTENT_HANDOFF_TRUST_NARRATIVE_KEY,
      recommendedNextAction:
        "Content may strengthen trust narrative links as one theme — thin entry is not proof of abandonment",
      whyItMatters: "Trust surfaces may be under-linked from high-entry paths",
      isInference: true,
      suppressRecommendation: true,
      suppressReason: "Internal Content handoff — not founder-rankable",
      founderRankable: false,
    }),
  ];
}

function detectConversionSignalUnknown(
  signals: ConversionSignal[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  const core = signals.filter(
    (s) => s.kind === "form-submit" || s.kind === "appointment-request",
  );
  const unknownOrAbsent = core.filter(
    (s) =>
      s.availability === "unknown" || s.availability === "not-observed",
  );
  if (unknownOrAbsent.length === 0) return [];

  const studio = getQueriedEventCount(observations, "diamond_studio_view") ?? 0;
  const cta = getQueriedEventCount(observations, "consultation_cta_clicked") ?? 0;
  const strongEngagement = studio >= MIN_JOURNEY_SAMPLE || cta >= 20;

  return [
    finding({
      type: "conversion-signal-unknown",
      subject: "concierge-conversion",
      title: strongEngagement
        ? "Strong engagement with unknown Concierge conversion measurement"
        : "Concierge conversion performance remains unknown",
      evidenceClass: "source-gap",
      expectedEvidence:
        "Verified form-submit / generate_lead (or designated reporting conversion)",
      observedEvidence: unknownOrAbsent
        .map((s) => `${s.kind}:${s.availability}`)
        .join("; "),
      confidence: 0.8,
      sampleSize: Math.max(studio, cta) || null,
      severity: "critical",
      affectedSurfaceId: "surface-concierge",
      affectedRoute: "/concierge",
      transitionState: "unknown",
      owner: "business-intelligence",
      handoffTarget: null,
      rootSourceGapId: CONVERSION_EVENT_MEASUREMENT_GAP_ID,
      deduplicationKey: "conversion-event-root",
      recommendedNextAction:
        "Establish one verified Concierge conversion signal before diagnosing conversion rate or funnel performance",
      whyItMatters:
        "Without verified conversion measurement, Agent OS must not claim conversion is low, high, zero, or improving",
      isInference: false,
      suppressRecommendation: false,
      founderRankable: true,
    }),
  ];
}

function detectMeasurementBlocked(
  sourceGaps: JourneySourceGap[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  const findings: JourneyFinding[] = [];

  const pathGap = sourceGaps.find((g) => g.id === JOURNEY_PATH_MEASUREMENT_GAP_ID);
  if (pathGap && !observations.pathMeasurementAvailable) {
    findings.push(
      finding({
        type: "source-unavailable",
        subject: "journey-path-measurement",
        title: "Journey path measurement unavailable",
        evidenceClass: "source-gap",
        expectedEvidence: "Verified landing→next-page / path analytics",
        observedEvidence:
          "Live GA4 weekly adapter does not expose path-level transitions — next-step movement unknown (not zero movement)",
        confidence: 0.85,
        sampleSize: totalLandingSessions(observations) || null,
        severity: "medium",
        affectedSurfaceId: null,
        affectedRoute: null,
        transitionState: "unknown",
        owner: "business-intelligence",
        handoffTarget: null,
        rootSourceGapId: JOURNEY_PATH_MEASUREMENT_GAP_ID,
        deduplicationKey: "journey-path-root",
        recommendedNextAction: pathGap.resolutionPrerequisite,
        whyItMatters:
          "Without path measurement, journey drop-off and guide→tool claims cannot be observed — internal analytics prerequisite, not a standalone founder growth action",
        isInference: false,
        suppressRecommendation: true,
        suppressReason:
          "Diagnostic path-measurement gap — suppressed from founder ranking unless a distinct path-dependent founder decision is later gated",
        founderRankable: false,
      }),
    );
  }

  return findings;
}

function detectDeadEndAndUnclearNext(
  surfaces: JourneySurface[],
): JourneyFinding[] {
  const findings: JourneyFinding[] = [];
  for (const s of surfaces) {
    if (s.surfaceType === "conversion" || s.surfaceType === "inquiry") continue;
    if (s.intendedNextSteps.length === 0 && s.conversionDestinations.length === 0) {
      findings.push(
        finding({
          type: "dead-end-route",
          subject: s.route,
          title: `${s.label} lacks a defined intended next-step in repository inventory`,
          evidenceClass: "repository-backed",
          expectedEvidence: "Clear next-step CTAs toward tools, trust, or Concierge",
          observedEvidence: "Repository inventory lists no intended next steps",
          confidence: 0.65,
          sampleSize: null,
          severity: "low",
          affectedSurfaceId: s.id,
          affectedRoute: s.route,
          transitionState: "repository-available",
          owner: "business-intelligence",
          handoffTarget: null,
          rootSourceGapId: null,
          deduplicationKey: `dead-end|${s.route}`,
          recommendedNextAction:
            "Structural readiness only — confirm whether the route intentionally ends or needs a next-step CTA (no website change in this pass)",
          whyItMatters: "Ambiguous ends fragment the intended client journey",
          isInference: false,
          suppressRecommendation: true,
          suppressReason: "Repository-only structural note — limited founder ranking",
          founderRankable: false,
        }),
      );
    }

    if (s.intendedNextSteps.length >= 4) {
      findings.push(
        finding({
          type: "unclear-intended-next-step",
          subject: s.route,
          title: `${s.label} has many competing intended next steps`,
          evidenceClass: "repository-backed",
          expectedEvidence: "One primary next-step for the stage",
          observedEvidence: `Intended next steps: ${s.intendedNextSteps.join(", ")}`,
          confidence: 0.55,
          sampleSize: null,
          severity: "low",
          affectedSurfaceId: s.id,
          affectedRoute: s.route,
          transitionState: "repository-available",
          owner: "business-intelligence",
          handoffTarget: null,
          rootSourceGapId: null,
          deduplicationKey: `unclear-next|${s.route}`,
          recommendedNextAction:
            "Structural readiness — clarify primary next-step hierarchy when redesigning (read-only diagnosis now)",
          whyItMatters: "Competing CTAs can fragment consideration",
          isInference: true,
          suppressRecommendation: true,
          suppressReason: "Repository-only — limited founder ranking",
          founderRankable: false,
        }),
      );
    }
  }
  return findings;
}

function detectFragmentedJourney(
  surfaces: JourneySurface[],
  observations: JourneyObservationBundle,
): JourneyFinding[] {
  // Multiple high-entry commercial surfaces without observed consolidation toward Concierge
  if (!observations.pathMeasurementAvailable) return [];

  const commercial = observations.landingPages.filter((p) => {
    const s = findSurfaceByRoute(surfaces, p.route);
    return s?.surfaceType === "commercial" && p.sessions >= MIN_JOURNEY_SAMPLE;
  });
  if (commercial.length < 2) return [];

  const toConcierge = commercial.reduce(
    (sum, p) =>
      sum + observedTransitionSessions(observations, p.route, "/concierge"),
    0,
  );
  const entry = commercial.reduce((sum, p) => sum + p.sessions, 0);
  if (entry <= 0 || toConcierge / entry >= WEAK_NEXT_STEP_RATIO) return [];

  return [
    finding({
      type: "fragmented-journey",
      subject: "commercial-to-concierge",
      title: "Commercial entry surfaces show fragmented movement toward Concierge",
      evidenceClass: "observed-analytics",
      expectedEvidence:
        "Commercial landings consolidating toward conversation/conversion",
      observedEvidence: `Commercial entry sessions=${entry}; observed → Concierge=${toConcierge}`,
      confidence: 0.72,
      sampleSize: entry,
      severity: "high",
      affectedSurfaceId: null,
      affectedRoute: null,
      transitionState: "observed",
      owner: "business-intelligence",
      handoffTarget: null,
      rootSourceGapId: null,
      deduplicationKey: "fragmented-commercial-journey",
      recommendedNextAction:
        "Treat as one root journey problem: clarify commercial→Concierge next steps before adding more acquisition",
      whyItMatters:
        "Multiple commercial doors without conversation consolidation wastes high-intent entry",
      isInference: false,
      suppressRecommendation: false,
      founderRankable: true,
    }),
  ];
}

function sourceUnavailableFinding(): JourneyFinding {
  return finding({
    type: "source-unavailable",
    subject: "ga4-journey",
    title: "Journey analytics unavailable",
    evidenceClass: "source-gap",
    expectedEvidence: "Healthy GA4 weekly adapter for landings and events",
    observedEvidence: "GA4 unavailable — journey entry and transition status unknown",
    confidence: 0.9,
    sampleSize: null,
    severity: "critical",
    affectedSurfaceId: null,
    affectedRoute: null,
    transitionState: "unknown",
    owner: "business-intelligence",
    handoffTarget: null,
    rootSourceGapId: JOURNEY_PATH_MEASUREMENT_GAP_ID,
    deduplicationKey: "journey-source-unavailable",
    recommendedNextAction:
      "Restore GA4 read access before diagnosing client journey performance",
    whyItMatters: "Without analytics, journey claims would be fabricated",
    isInference: false,
    suppressRecommendation: false,
    founderRankable: true,
  });
}

function finding(input: {
  type: JourneyFinding["type"];
  subject: string;
  title: string;
  evidenceClass: JourneyEvidenceClass;
  expectedEvidence: string;
  observedEvidence: string;
  confidence: number;
  sampleSize: number | null;
  severity: JourneyFinding["severity"];
  affectedSurfaceId: string | null;
  affectedRoute: string | null;
  transitionState: JourneyTransitionState | null;
  owner: JourneyFinding["owner"];
  handoffTarget: JourneyFinding["handoffTarget"];
  rootSourceGapId: JourneyFinding["rootSourceGapId"];
  deduplicationKey: string;
  recommendedNextAction: string;
  whyItMatters: string;
  isInference: boolean;
  suppressRecommendation: boolean;
  suppressReason?: string | null;
  founderRankable: boolean;
}): JourneyFinding {
  return {
    id: buildJourneyFindingId({ type: input.type, subject: input.subject }),
    type: input.type,
    title: input.title,
    evidenceClass: input.evidenceClass,
    expectedEvidence: input.expectedEvidence,
    observedEvidence: input.observedEvidence,
    confidence: input.confidence,
    sampleSize: input.sampleSize,
    severity: input.severity,
    affectedSurfaceId: input.affectedSurfaceId,
    affectedRoute: input.affectedRoute,
    transitionState: input.transitionState,
    owner: input.owner,
    handoffTarget: input.handoffTarget,
    rootSourceGapId: input.rootSourceGapId,
    deduplicationKey: input.deduplicationKey,
    recommendedNextAction: input.recommendedNextAction,
    whyItMatters: input.whyItMatters,
    isInference: input.isInference,
    suppressRecommendation: input.suppressRecommendation,
    suppressReason: input.suppressReason ?? null,
    founderRankable: input.founderRankable,
  };
}

function dedupeFindings(findings: JourneyFinding[]): JourneyFinding[] {
  const seen = new Set<string>();
  const out: JourneyFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}
