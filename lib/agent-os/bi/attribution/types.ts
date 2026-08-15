/**
 * Accepted Concierge inquiry attribution evidence (P1-BI-2).
 * Lives under Business Intelligence. Not a sixth executive.
 *
 * Source of truth: HubSpot Concierge deal reconstruction.
 * GA4 event counts are an UNJOINED parallel track — never identity-joined.
 * Qualification and revenue are out of scope.
 */

export const ATTRIBUTION_PRIMARY_LOOKBACK_DAYS = 90;
export const ATTRIBUTION_COMPARISON_LOOKBACK_DAYS = 28;

/**
 * Simple documented sample floors — not a statistics framework.
 * n < 4: too small even for descriptive origin rankings.
 * 4–7: descriptive counts allowed with a required qualifier.
 * n >= 8: material enough for a coverage-integrity finding if capture collapses.
 */
export const ATTRIBUTION_INSUFFICIENT_SAMPLE_MAX = 3;
export const ATTRIBUTION_DESCRIPTIVE_SAMPLE_MAX = 7;
export const ATTRIBUTION_MATERIAL_SAMPLE_MIN = 8;
export const ATTRIBUTION_COVERAGE_COLLAPSE_RATE = 0.25;

export const ATTRIBUTION_SAMPLE_STRENGTHS = [
  "INSUFFICIENT_SAMPLE",
  "DESCRIPTIVE_ONLY",
  "MATERIAL_SIGNAL",
] as const;

export type AttributionSampleStrength =
  (typeof ATTRIBUTION_SAMPLE_STRENGTHS)[number];

/** null = source was not observed; do not treat as a tiny sample. */
export type AttributionSampleStrengthOrUnevaluated =
  | AttributionSampleStrength
  | null;

export const ATTRIBUTION_LOOKBACK_COMPLETENESS = [
  "complete",
  "partial",
  "unavailable",
] as const;

export type AttributionLookbackCompleteness =
  (typeof ATTRIBUTION_LOOKBACK_COMPLETENESS)[number];

export const ATTRIBUTION_ORIGIN_CLASSES = [
  "explicit-tool-origin",
  "explicit-cta-surface",
  "landing-campaign-context",
  "unknown",
] as const;

export type AttributionOriginClass =
  (typeof ATTRIBUTION_ORIGIN_CLASSES)[number];

export const ATTRIBUTION_EPISTEMIC_CLASSES = [
  "observed",
  "derived",
  "unknown",
] as const;

export type AttributionEpistemicClass =
  (typeof ATTRIBUTION_EPISTEMIC_CLASSES)[number];

export const ATTRIBUTION_SOURCE_STATUSES = [
  "ok",
  "empty",
  "unavailable",
  "fixture",
] as const;

export type AttributionSourceStatus =
  (typeof ATTRIBUTION_SOURCE_STATUSES)[number];

export const ATTRIBUTION_JOIN_STATUS = "unjoined" as const;

export const ATTRIBUTION_FUNNEL_STAGES = {
  visitEngagedIntent: "not-joined-to-inquiry",
  consultationStart: "ga4-unjoined",
  acceptedConciergeInquiry: "crm-source-of-truth",
  qualifiedOpportunity: "unknown-not-yet-defined",
  clientClosedWon: "crm-readable-not-bi-attributed",
  revenue: "not-attributed",
} as const;

export type AttributionCountBucket = {
  key: string;
  count: number;
};

export type AttributionWindowSnapshot = {
  lookbackDays: number;
  start: string;
  end: string;
  acceptedInquiryCount: number;
  explicitOriginCount: number;
  unknownOriginCount: number;
  originCoverageRate: number | null;
};

export type Ga4UnjoinedSanity = {
  joinStatus: typeof ATTRIBUTION_JOIN_STATUS;
  status: "ok" | "unavailable";
  generateLeadCount: number | null;
  conciergeFormSubmitted: number | null;
  conciergeFormStarted: number | null;
  consultationCtaClicked: number | null;
  /** Always true: these counts do not identify the same people as CRM inquiries. */
  identityJoinPerformed: false;
  reconciliationClaim: false;
  note: string;
};

export type AcceptedInquiryAttributionSnapshot = {
  acceptedInquiryCount: number;
  explicitOriginCount: number;
  unknownOriginCount: number;
  originCoverageRate: number | null;
  byOriginatingTool: AttributionCountBucket[];
  byCtaSurface: AttributionCountBucket[];
  byLandingPath: AttributionCountBucket[];
  byUtmSource: AttributionCountBucket[];
  byUtmMedium: AttributionCountBucket[];
  byUtmCampaign: AttributionCountBucket[];
  byReferrerHost: AttributionCountBucket[];
  byOriginClass: Record<AttributionOriginClass, number>;
  lookback: {
    requestedDays: number;
    actualCrmCoverageDays: number;
    start: string;
    end: string;
    completeness: AttributionLookbackCompleteness;
    recordCap: number | null;
    truncatedByRecordCap: boolean;
    note: string;
  };
  /** Present only when CRM coverage is at least 56 days and not truncated. */
  optionalComparison: {
    current28: AttributionWindowSnapshot;
    prior28: AttributionWindowSnapshot;
  } | null;
  sourceStatus: AttributionSourceStatus;
  epistemicClass: AttributionEpistemicClass;
  sampleStrength: AttributionSampleStrengthOrUnevaluated;
  ga4Sanity: Ga4UnjoinedSanity;
  funnel: typeof ATTRIBUTION_FUNNEL_STAGES;
  coverageIntegrityFinding: boolean;
  founderRecommendationEmitted: boolean;
  facts: string[];
  inferences: string[];
};

export const ATTRIBUTION_COVERAGE_INTEGRITY_ID =
  "business-intelligence:attribution:accepted-inquiry-coverage-integrity" as const;
