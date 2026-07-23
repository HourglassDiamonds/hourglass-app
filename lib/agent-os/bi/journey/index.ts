/**
 * Business Intelligence — Client Journey & Conversion Analysis entrypoint.
 */

import type { AgentOsDataBundle } from "../../adapters/types";
import type { Recommendation } from "../../types";
import { detectJourneyFindings } from "./findings";
import { resolveJourneyObservations } from "./observe";
import {
  buildJourneyHandoffs,
  buildJourneyVolumeFunnel,
  dedupeJourneyAgainstMeasurement,
  journeyFindingsToRecommendations,
} from "./recommendations";
import type {
  ClientJourneyAudit,
  JourneyObservationBundle,
} from "./types";

export type RunClientJourneyInput = {
  mode: "fixture" | "live";
  bundle: AgentOsDataBundle;
  reportingPeriod: { start: string; end: string };
  /** Fixture-only overlay; refused in live mode. */
  fixtureOverlay?: JourneyObservationBundle | null;
  /** Existing measurement recommendations for soft dedupe. */
  measurementRecommendations?: Recommendation[];
};

export type ClientJourneyRunResult = {
  audit: ClientJourneyAudit;
  recommendations: Recommendation[];
};

export function runClientJourneyAnalysis(
  input: RunClientJourneyInput,
): ClientJourneyRunResult {
  if (input.mode === "live" && input.fixtureOverlay) {
    throw new Error("Live journey analysis refused fixture observation overlay");
  }

  const observations = resolveJourneyObservations({
    mode: input.mode,
    bundle: input.bundle,
    reportingPeriod: input.reportingPeriod,
    fixtureOverlay: input.mode === "fixture" ? input.fixtureOverlay : null,
  });

  if (input.mode === "live" && observations?.mode === "fixture") {
    throw new Error("Live journey analysis refused fixture observation data");
  }

  const detected = detectJourneyFindings({ observations });
  const collectedAt =
    observations?.collectedAt ?? new Date().toISOString();

  const hasConciergeConversionRoot = Boolean(
    input.measurementRecommendations?.some((r) =>
      r.recommendationId.includes("concierge-conversion-root"),
    ),
  );

  let recommendations = journeyFindingsToRecommendations(
    detected.findings,
    detected.sourceGaps,
    input.reportingPeriod,
    collectedAt,
    { hasConciergeConversionRoot },
  );

  if (input.measurementRecommendations?.length) {
    recommendations = dedupeJourneyAgainstMeasurement(
      recommendations,
      input.measurementRecommendations,
    ).filter((r) => r.status !== "consolidated");
  }

  const handoffs = buildJourneyHandoffs(detected.findings);
  const observedTransitions = detected.transitions.filter(
    (t) => t.state === "observed",
  ).length;
  const repositoryTransitions = detected.transitions.filter(
    (t) => t.state === "repository-available",
  ).length;
  const conversionSignalsUnknown = detected.conversionSignals.filter(
    (s) =>
      s.availability === "unknown" || s.availability === "unsupported",
  ).length;

  const volumeFunnel = buildJourneyVolumeFunnel({
    surfacesInventoried: detected.surfaces.length,
    observedEntries: observations?.landingPages.length ?? 0,
    observedTransitions,
    repositoryTransitions,
    conversionSignalsUnknown,
    findings: detected.findings,
    recommendations,
  });

  const facts: string[] = [
    `Journey surfaces inventoried: ${detected.surfaces.length}`,
    `Observation mode: ${observations?.mode ?? "unavailable"}`,
    `Path measurement available: ${observations?.pathMeasurementAvailable ?? false}`,
    `Journey volume: rawFindings=${volumeFunnel.rawFindings}, qualified=${volumeFunnel.qualifiedFindings}, deferred=${volumeFunnel.monitorDeferredFindings}, recs=${volumeFunnel.rankedRecommendations}`,
  ];

  const inferences: string[] = [
    "Repository links describe journey readiness — not observed user transitions",
    "Missing conversion events remain unknown — not automatic zero conversions or low conversion rate",
    "Inferred journeys are labeled inferred and must not be presented as observed behavior",
  ];

  if (!observations) {
    facts.push("GA4 unavailable — journey entry/transition status unknown");
  } else if (!observations.pathMeasurementAvailable) {
    facts.push(
      "Path-level next-page analytics unavailable — landing→next-step movement unknown",
    );
  }

  const audit: ClientJourneyAudit = {
    surfaces: detected.surfaces,
    transitions: detected.transitions,
    conversionSignals: detected.conversionSignals,
    sourceGaps: detected.sourceGaps,
    findings: detected.findings,
    handoffs,
    volumeFunnel,
    facts,
    inferences,
    observationMode: observations?.mode ?? "unavailable",
  };

  return { audit, recommendations };
}

export function emptyClientJourneyAudit(): ClientJourneyAudit {
  return {
    surfaces: [],
    transitions: [],
    conversionSignals: [],
    sourceGaps: [],
    findings: [],
    handoffs: {
      searchHandoffIds: [],
      contentHandoffIds: [],
      opportunityHandoffIds: [],
      biDiagnosisIds: [],
    },
    volumeFunnel: {
      surfacesInventoried: 0,
      observedEntries: 0,
      observedTransitions: 0,
      repositoryTransitions: 0,
      conversionSignalsUnknown: 0,
      rawFindings: 0,
      qualifiedFindings: 0,
      monitorDeferredFindings: 0,
      rankedRecommendations: 0,
      surfacedEligible: 0,
    },
    facts: [],
    inferences: [],
    observationMode: "unavailable",
  };
}

export type {
  ClientJourneyAudit,
  JourneyFinding,
  JourneyFindingType,
  JourneySurface,
  JourneyTransition,
  ConversionSignal,
  JourneySourceGap,
  JourneyEvidenceClass,
  JourneyObservationBundle,
} from "./types";

export {
  JOURNEY_FINDING_TYPES,
  JOURNEY_STAGES,
  JOURNEY_TRANSITION_STATES,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
  JOURNEY_ROOT_SOURCE_GAP_IDS,
} from "./types";

export {
  buildJourneyFindingId,
  journeyIdLooksSafe,
} from "./ids";

export {
  buildJourneySurfaceInventory,
  normalizeRoute,
} from "./inventory";

export {
  createFixtureJourneyObservations,
  createLowSampleJourneyObservations,
} from "./fixtures";

export {
  resolveJourneyObservations,
  deriveLiveJourneyObservations,
} from "./observe";

export { detectJourneyFindings, MIN_JOURNEY_SAMPLE } from "./findings";

export {
  journeyFindingsToRecommendations,
  buildJourneyHandoffs,
  buildJourneyVolumeFunnel,
  dedupeJourneyAgainstMeasurement,
} from "./recommendations";

export {
  buildJourneySemanticDedupeKey,
  consolidateJourneyDuplicates,
  applyJourneyFounderRankingGate,
  sequenceJourneyMeasurementPrerequisites,
  isJourneyRecommendation,
  classifyJourneyDedupeFamily,
} from "./ranking-policy";
