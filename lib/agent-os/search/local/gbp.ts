/**
 * GBP intelligence / readiness model.
 *
 * Without a verified read-only adapter or trusted export:
 * - every dimension is unknown
 * - source state is not-configured / unavailable
 * - do NOT claim the profile is incomplete
 * - do NOT claim calls/directions/reviews/categories/map visibility
 */

import type { AgentOsDataBundle } from "../../adapters/types";
import {
  GBP_DIMENSION_KEYS,
  GBP_ROOT_SOURCE_GAP_ID,
  type GbpDimension,
  type GbpIntelligenceSnapshot,
  type GbpSourceState,
} from "./types";

export type GbpObserveInput = {
  bundle: AgentOsDataBundle;
  mode: "fixture" | "live";
  /**
   * Fixture-only optional observed dimension overlay.
   * Live mode must never receive this.
   */
  fixtureObservedDimensions?: Partial<
    Record<(typeof GBP_DIMENSION_KEYS)[number], string>
  > | null;
};

export function observeGbpIntelligence(
  input: GbpObserveInput,
): GbpIntelligenceSnapshot {
  if (input.mode === "live" && input.fixtureObservedDimensions) {
    throw new Error("Live GBP observe refused fixture dimension overlay");
  }

  const adapterPresent = false; // No verified GBP adapter in V1
  const gbpOk =
    input.bundle.gbp.ok &&
    input.bundle.gbp.health.retrievalState === "ok" &&
    input.bundle.gbp.data != null;

  // Typed payload would live here when a verified adapter exists.
  // Today AdapterResult<null> — never invent observations from dashboard statics.
  if (gbpOk) {
    // Future: map adapter payload → dimensions. Still unreachable without adapter.
    return {
      sourceState: "observed",
      dimensions: unknownDimensions("unavailable"),
      rootSourceGapId: null,
      adapterPresent: true,
      hasVerifiedGbpData: true,
    };
  }

  const sourceState: GbpSourceState =
    input.bundle.gbp.health.retrievalState === "not-configured"
      ? "not-configured"
      : input.bundle.gbp.health.retrievalState === "failed"
        ? "unavailable"
        : "unknown";

  const dimensions = unknownDimensions(
    sourceState === "not-configured" ? "unavailable" : "unknown",
  );

  // Fixture may optionally mark one dimension as observed for contract demos —
  // never in live mode, and never used to claim full profile completeness.
  if (
    input.mode === "fixture" &&
    input.fixtureObservedDimensions &&
    Object.keys(input.fixtureObservedDimensions).length > 0
  ) {
    for (const dim of dimensions) {
      const value = input.fixtureObservedDimensions[dim.key];
      if (value != null) {
        dim.observedValue = value;
        dim.source = "fixture-observed-only";
        dim.freshness = "unknown";
        dim.confidence = 0.4;
        dim.externalVerificationState = "required";
        dim.recommendationEligible = false;
        dim.evidenceClass = "observed";
      }
    }
    return {
      sourceState: "partially-observed",
      dimensions,
      rootSourceGapId: GBP_ROOT_SOURCE_GAP_ID,
      adapterPresent,
      hasVerifiedGbpData: false,
    };
  }

  return {
    sourceState,
    dimensions,
    rootSourceGapId: GBP_ROOT_SOURCE_GAP_ID,
    adapterPresent,
    hasVerifiedGbpData: false,
  };
}

function unknownDimensions(
  verification: "unavailable" | "unknown",
): GbpDimension[] {
  return GBP_DIMENSION_KEYS.map((key) => ({
    key,
    observedValue: null,
    source: "none" as const,
    freshness: "unknown" as const,
    confidence: 0,
    externalVerificationState: verification,
    recommendationEligible: false,
    evidenceClass: "unknown" as const,
  }));
}

/** Review/rating remain unknown without verified GBP/review adapter. */
export function gbpReviewMetricsUnknown(gbp: GbpIntelligenceSnapshot): boolean {
  const count = gbp.dimensions.find((d) => d.key === "review-count");
  const rating = gbp.dimensions.find((d) => d.key === "rating");
  return (
    (count?.observedValue == null || count.evidenceClass === "unknown") &&
    (rating?.observedValue == null || rating.evidenceClass === "unknown")
  );
}
