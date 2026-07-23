/**
 * Search Strategy — Local Authority / GBP Intelligence entrypoint.
 */

import type { AgentOsDataBundle } from "../../adapters/types";
import type { Recommendation } from "../../types";
import type { GuideAuthoritySnapshot } from "../guide-authority";
import { inspectLocalEntityInventory } from "./entity-inventory";
import { detectLocalAuthorityFindings } from "./findings";
import {
  applyLocalAuthorityFixtureGscQueries,
  FIXTURE_GBP_OBSERVED_DIMENSIONS,
} from "./fixtures";
import { observeGbpIntelligence } from "./gbp";
import {
  buildLocalHandoffs,
  buildLocalVolumeFunnel,
  dedupeLocalAgainstSearchRecommendations,
  localFindingsToRecommendations,
} from "./recommendations";
import type { LocalAuthorityAudit } from "./types";
import { GBP_ROOT_SOURCE_GAP_ID } from "./types";

export type RunLocalAuthorityInput = {
  mode: "fixture" | "live";
  bundle: AgentOsDataBundle;
  reportingPeriod: { start: string; end: string };
  guideAuthority: GuideAuthoritySnapshot;
  gscAvailable: boolean;
  /** Existing Search recommendations for soft dedupe. */
  existingSearchRecommendations?: Recommendation[];
};

export type LocalAuthorityRunResult = {
  audit: LocalAuthorityAudit;
  recommendations: Recommendation[];
};

export function runLocalAuthorityIntelligence(
  input: RunLocalAuthorityInput,
): LocalAuthorityRunResult {
  if (input.mode === "live") {
    // Hard guard: never accept fixture GBP overlays in live
    // (observeGbpIntelligence also throws if overlay is passed).
  }

  const entityInventory = inspectLocalEntityInventory();

  const gbp = observeGbpIntelligence({
    bundle: input.bundle,
    mode: input.mode,
    fixtureObservedDimensions:
      input.mode === "fixture" ? FIXTURE_GBP_OBSERVED_DIMENSIONS : null,
  });

  if (input.mode === "live" && gbp.dimensions.some((d) => d.source === "fixture-observed-only")) {
    throw new Error("Live local authority refused fixture GBP dimensions");
  }

  let gscData = input.bundle.gsc.data;
  if (input.mode === "fixture" && input.gscAvailable && gscData) {
    gscData = applyLocalAuthorityFixtureGscQueries(gscData);
  }
  if (input.mode === "live" && gscData) {
    // Live uses adapter data only — never apply fixture local queries
    const leaked = gscData.current?.topQueries?.some(
      (q) => q.query === "waxhaw diamond appraisal" && q.impressions === 42,
    );
    // Do not throw on coincidence; fixture applicator is simply not called.
    void leaked;
  }

  const findings = detectLocalAuthorityFindings({
    gsc: input.gscAvailable ? gscData : null,
    gscAvailable: input.gscAvailable,
    entityInventory,
    gbp,
    guideAuthority: input.guideAuthority,
  });

  const collectedAt =
    input.bundle.gsc.data?.fetchedAt ?? new Date().toISOString();

  let recommendations = localFindingsToRecommendations(
    findings,
    input.reportingPeriod,
    collectedAt,
  );

  if (input.existingSearchRecommendations?.length) {
    recommendations = dedupeLocalAgainstSearchRecommendations(
      recommendations,
      input.existingSearchRecommendations,
    );
  }

  const handoffs = buildLocalHandoffs(findings);
  const volumeFunnel = buildLocalVolumeFunnel({ findings, recommendations });

  const facts: string[] = [
    `Local entity fields inventoried: ${entityInventory.fields.length}`,
    `Charlotte Guides routes: ${entityInventory.charlotteGuideRoutes.length}`,
    `GBP sourceState=${gbp.sourceState}; verified=${gbp.hasVerifiedGbpData}`,
    `Local finding volume: raw=${volumeFunnel.rawFindings}, qualified=${volumeFunnel.qualifiedFindings}, deferred=${volumeFunnel.monitorDeferredFindings}, recs=${volumeFunnel.rankedRecommendations}`,
  ];

  const inferences: string[] = [
    "Repository local evidence proves site intent/readiness only — not GBP acceptance or map-pack ranking",
    "GSC local queries show discovery demand — not physical-user location or pack position",
    "Repository testimonials are not GBP reviews",
  ];

  if (gbp.rootSourceGapId) {
    facts.push(`GBP root source gap: ${GBP_ROOT_SOURCE_GAP_ID}`);
  }

  const audit: LocalAuthorityAudit = {
    entityInventory,
    gbp,
    findings,
    handoffs,
    volumeFunnel,
    facts,
    inferences,
    observationMode: input.mode,
  };

  return { audit, recommendations };
}

export function emptyLocalAuthorityAudit(): LocalAuthorityAudit {
  return {
    entityInventory: inspectLocalEntityInventory(),
    gbp: {
      sourceState: "not-configured",
      dimensions: [],
      rootSourceGapId: GBP_ROOT_SOURCE_GAP_ID,
      adapterPresent: false,
      hasVerifiedGbpData: false,
    },
    findings: [],
    handoffs: {
      contentHandoffIds: [],
      opportunityHandoffIds: [],
      biHandoffIds: [],
      searchDiagnosisIds: [],
    },
    volumeFunnel: {
      rawFindings: 0,
      qualifiedFindings: 0,
      gbpUnknownDimensions: 0,
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
  LocalAuthorityAudit,
  LocalAuthorityFinding,
  LocalAuthorityFindingType,
  LocalGeography,
  LocalIntentKind,
  LocalEvidenceClass,
  GbpIntelligenceSnapshot,
  LocalEntityInventory,
  LocalAuthorityVolumeFunnel,
} from "./types";

export {
  LOCAL_AUTHORITY_FINDING_TYPES,
  LOCAL_GEOGRAPHIES,
  LOCAL_INTENT_KINDS,
  GBP_ROOT_SOURCE_GAP_ID,
  GBP_DIMENSION_KEYS,
} from "./types";

export {
  buildLocalAuthorityFindingId,
  localAuthorityIdLooksSafe,
} from "./ids";

export {
  classifyLocalGeography,
  classifyLocalIntentKind,
  isLocalAuthorityQuery,
} from "./geography";

export { inspectLocalEntityInventory } from "./entity-inventory";
export { observeGbpIntelligence, gbpReviewMetricsUnknown } from "./gbp";
export { detectLocalAuthorityFindings } from "./findings";

export {
  buildLocalSemanticDedupeKey,
  consolidateLegacyWithLocalAuthority,
  applyLocalAuthorityFounderRankingGate,
  isRepositoryBackedLocalAuthorityRec,
  countFounderRankableRepositoryLocal,
  recommendationIsFounderRankableLocal,
  classifyLocalDedupeFamily,
} from "./ranking-policy";
