/**
 * Business Intelligence — Conversion & Measurement Audit entrypoint.
 */

import type { AgentOsDataBundle } from "../adapters/types";
import type { Recommendation } from "../types";
import { FUNNEL_DEFINITIONS } from "./funnels";
import { detectMeasurementFindings } from "./findings";
import {
  buildExpectedEventInventory,
  resolveConversionObservations,
} from "./observe";
import { buildOpportunityMeasurementHandoff } from "./readiness";
import {
  buildMeasurementVolumeFunnel,
  dedupeMeasurementAgainstLegacyBi,
  measurementFindingsToRecommendations,
} from "./recommendations";
import type {
  BiConversionObservationBundle,
  ConversionMeasurementAudit,
} from "./types";

export type RunConversionAuditInput = {
  mode: "fixture" | "live";
  bundle: AgentOsDataBundle;
  reportingPeriod: { start: string; end: string };
  /** Fixture-only overlay; ignored in live mode. */
  fixtureOverlay?: BiConversionObservationBundle | null;
  /** Existing BI recommendations for soft dedupe. */
  legacyRecommendations?: Recommendation[];
};

export type ConversionAuditRunResult = {
  audit: ConversionMeasurementAudit;
  recommendations: Recommendation[];
};

export function runConversionMeasurementAudit(
  input: RunConversionAuditInput,
): ConversionAuditRunResult {
  if (input.mode === "live" && input.fixtureOverlay) {
    throw new Error(
      "Live conversion audit refused fixture observation overlay",
    );
  }

  const observations =
    input.mode === "live"
      ? resolveConversionObservations({
          mode: "live",
          bundle: input.bundle,
          reportingPeriod: input.reportingPeriod,
        })
      : resolveConversionObservations({
          mode: "fixture",
          bundle: input.bundle,
          reportingPeriod: input.reportingPeriod,
          fixtureOverlay: input.fixtureOverlay,
        });

  if (input.mode === "live" && observations?.mode === "fixture") {
    throw new Error(
      "Live conversion audit refused fixture observation data",
    );
  }

  const inventory = buildExpectedEventInventory(observations);
  const findings = detectMeasurementFindings({ inventory, observations });
  const opportunityHandoff = buildOpportunityMeasurementHandoff({
    inventory,
    findings,
    observations,
  });

  const observed = inventory.filter((e) => e.observedStatus === "observed").length;
  const notObserved = inventory.filter(
    (e) => e.observedStatus === "not-observed",
  ).length;
  const unknown = inventory.filter((e) => e.observedStatus === "unknown").length;

  const facts: string[] = [
    `Expected instrumentation events inventoried: ${inventory.length}`,
    `Observation mode: ${observations?.mode ?? "unavailable"}`,
    `Authoritative conversion candidate (${opportunityHandoff.authoritativeConversionEvent}) status: ${opportunityHandoff.conversionEventStatus}`,
  ];

  const inferences: string[] = [
    "Repository expected events do not prove production firing",
    "Missing live analytics yields unknown/unverified status, not automatic broken tracking",
  ];

  if (!observations) {
    facts.push(
      "GA4 unavailable — conversion observation status unknown/unverified for adapter-backed events",
    );
  } else {
    facts.push(
      `Expected-event observation mix: observed=${observed}, not-observed=${notObserved}, unknown=${unknown}`,
    );
  }

  const collectedAt =
    observations?.collectedAt ?? new Date().toISOString();
  let recommendations = measurementFindingsToRecommendations(
    findings,
    input.reportingPeriod,
    collectedAt,
  );

  if (input.legacyRecommendations?.length) {
    recommendations = dedupeMeasurementAgainstLegacyBi(
      recommendations,
      input.legacyRecommendations,
    ).filter((r) => r.status !== "consolidated");
  }

  const volumeFunnel = buildMeasurementVolumeFunnel({
    inventoryLength: inventory.length,
    observed,
    notObserved,
    unknown,
    findings,
    recommendations,
  });

  facts.push(
    `Measurement volume funnel: rawFindings=${volumeFunnel.rawFindings}, qualified=${volumeFunnel.qualifiedFindings}, monitor/deferred=${volumeFunnel.monitorDeferredFindings}, rankedRecs=${volumeFunnel.rankedBiRecommendations}, surfacedEligible=${volumeFunnel.surfacedEligibleBiRecommendations}`,
  );

  const audit: ConversionMeasurementAudit = {
    expectedEvents: inventory,
    funnels: [...FUNNEL_DEFINITIONS],
    findings,
    opportunityHandoff,
    volumeFunnel,
    facts,
    inferences,
    observationMode: observations?.mode ?? "unavailable",
  };

  return { audit, recommendations };
}

export type {
  ConversionMeasurementAudit,
  ExpectedEventInventoryItem,
  MeasurementFinding,
  OpportunityMeasurementHandoff,
  MeasurementDecisionEffect,
  MeasurementHealthType,
  MeasurementVolumeFunnel,
} from "./types";

export {
  MEASUREMENT_HEALTH_TYPES,
  MEASUREMENT_DECISION_EFFECTS,
  FUNNEL_IDS,
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
} from "./types";

export {
  buildMeasurementFindingId,
  measurementIdLooksSafe,
} from "./ids";

export {
  EXPECTED_EVENT_INVENTORY,
  AUTHORITATIVE_CONVERSION_EVENT,
  GA4_ADAPTER_QUERIED_EVENTS,
} from "./expected-events";

export { FUNNEL_DEFINITIONS } from "./funnels";

export {
  createFixtureConversionObservations,
  deriveLiveConversionObservations,
  resolveObservedStatus,
  buildExpectedEventInventory,
} from "./observe";

export { emptyBusinessIntelligenceOutput } from "./empty";

export {
  isConciergeConversionClusterFinding,
  buildConciergeConversionRootRecommendation,
  buildMeasurementVolumeFunnel,
} from "./recommendations";

export { MIN_FUNNEL_SAMPLE } from "./findings";
