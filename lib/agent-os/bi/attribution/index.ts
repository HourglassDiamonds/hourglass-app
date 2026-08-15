/**
 * Accepted Concierge inquiry attribution evidence under Business Intelligence.
 * GREEN / read-only. Tiny samples stay descriptive / silent.
 */

import type { ConciergeAdapterResult } from "../client-attention/adapters/types";
import type { Recommendation } from "../../types";
import {
  emptyAcceptedInquiryAttributionSnapshot,
  runAcceptedInquiryAttribution,
  type Ga4AttributionCounts,
  type RunAcceptedInquiryAttributionInput,
} from "./aggregate";
import { attributionRecommendations } from "./recommendations";
import type { AcceptedInquiryAttributionSnapshot } from "./types";

export type RunAttributionOptions = {
  mode: "fixture" | "live";
  nowIso: string;
  reportingPeriod: { start: string; end: string };
  concierge?: ConciergeAdapterResult | null;
  crmReadLookbackDays?: number;
  crmRecordCap?: number | null;
  crmRecordsReturned?: number | null;
  ga4Available?: boolean;
  ga4Current?: Ga4AttributionCounts | null;
};

export function emptyAttributionSnapshot(
  note?: string,
): AcceptedInquiryAttributionSnapshot {
  return emptyAcceptedInquiryAttributionSnapshot(note);
}

export function runAcceptedInquiryAttributionSpecialist(
  options: RunAttributionOptions,
): {
  snapshot: AcceptedInquiryAttributionSnapshot;
  recommendations: Recommendation[];
} {
  const input: RunAcceptedInquiryAttributionInput = {
    mode: options.mode,
    nowIso: options.nowIso,
    concierge: options.concierge,
    crmReadLookbackDays:
      options.crmReadLookbackDays ?? 30,
    crmRecordCap: options.crmRecordCap,
    crmRecordsReturned: options.crmRecordsReturned,
    ga4Available: options.ga4Available ?? false,
    ga4Current: options.ga4Current,
  };
  const snapshot = runAcceptedInquiryAttribution(input);
  const recommendations = attributionRecommendations(
    snapshot,
    options.reportingPeriod,
    options.nowIso,
  );
  return { snapshot, recommendations };
}

export {
  ATTRIBUTION_PRIMARY_LOOKBACK_DAYS,
  ATTRIBUTION_COMPARISON_LOOKBACK_DAYS,
  ATTRIBUTION_INSUFFICIENT_SAMPLE_MAX,
  ATTRIBUTION_DESCRIPTIVE_SAMPLE_MAX,
  ATTRIBUTION_MATERIAL_SAMPLE_MIN,
  ATTRIBUTION_COVERAGE_COLLAPSE_RATE,
  ATTRIBUTION_COVERAGE_INTEGRITY_ID,
  ATTRIBUTION_FUNNEL_STAGES,
  ATTRIBUTION_JOIN_STATUS,
} from "./types";
export type {
  AcceptedInquiryAttributionSnapshot,
  AttributionSampleStrength,
  AttributionLookbackCompleteness,
  AttributionOriginClass,
  Ga4UnjoinedSanity,
} from "./types";

export {
  classifyAttributionPermissionTier,
  attributionMayExecute,
  ATTRIBUTION_GREEN_CAPABILITIES,
  ATTRIBUTION_YELLOW_CAPABILITIES,
  ATTRIBUTION_RED_CAPABILITIES,
} from "./permissions";

export {
  injectAttributionIntegrityIntoSurfacePool,
  isAttributionIntegrityRecommendationId,
} from "./cos-escalation";

export { classifyInquiryOrigin, classifySampleStrength } from "./classify";
export { founderFacingAttributionTextContainsPii } from "./sanitize";
