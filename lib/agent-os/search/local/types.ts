/**
 * Search Strategy — Local Authority / GBP Intelligence contracts.
 *
 * Source-of-truth separation:
 * - repository evidence ≠ GBP observation
 * - GSC local queries ≠ map-pack ranking
 * - testimonials ≠ GBP reviews
 */

export const LOCAL_AUTHORITY_FINDING_TYPES = [
  "local-intent-query",
  "local-query-page-mismatch",
  "local-near-page-one",
  "local-high-impression-low-ctr",
  "local-content-gap",
  "local-hub-gap",
  "service-area-gap",
  "service-area-inconsistency",
  "local-entity-inconsistency",
  "local-schema-gap",
  "local-metadata-gap",
  "local-internal-link-gap",
  "local-tool-handoff-gap",
  "local-concierge-handoff-gap",
  "local-review-readiness-gap",
  "gbp-source-gap",
  "gbp-profile-readiness",
  "gbp-category-verification-required",
  "gbp-service-area-verification-required",
  "gbp-appointment-link-verification-required",
  "gbp-review-measurement-gap",
  "gbp-engagement-measurement-gap",
  "map-pack-readiness-signal",
  "map-pack-data-unavailable",
  "local-authority-opportunity",
  "local-measurement-gap",
  "local-coverage-healthy",
  "verification-required",
] as const;

export type LocalAuthorityFindingType =
  (typeof LOCAL_AUTHORITY_FINDING_TYPES)[number];

export const LOCAL_GEOGRAPHIES = [
  "charlotte",
  "waxhaw",
  "fort-mill",
  "south-charlotte",
  "charlotte-metro",
  "national",
  "unknown",
] as const;

export type LocalGeography = (typeof LOCAL_GEOGRAPHIES)[number];

export const LOCAL_INTENT_KINDS = [
  "city-name-query",
  "near-me-query",
  "regional-service-query",
  "branded-location-query",
  "venue-neighborhood-query",
  "local-informational-query",
  "local-commercial-query",
] as const;

export type LocalIntentKind = (typeof LOCAL_INTENT_KINDS)[number];

export const LOCAL_EVIDENCE_CLASSES = [
  "observed",
  "repository-backed",
  "unknown",
  "verified",
  "readiness",
  "source-gap",
  "healthy",
] as const;

export type LocalEvidenceClass = (typeof LOCAL_EVIDENCE_CLASSES)[number];

export const LOCAL_EXTERNAL_VERIFICATION_STATES = [
  "not-required",
  "required",
  "verified",
  "unavailable",
  "unknown",
] as const;

export type LocalExternalVerificationState =
  (typeof LOCAL_EXTERNAL_VERIFICATION_STATES)[number];

export const GBP_SOURCE_STATES = [
  "observed",
  "partially-observed",
  "not-configured",
  "unavailable",
  "unknown",
] as const;

export type GbpSourceState = (typeof GBP_SOURCE_STATES)[number];

export const GBP_DIMENSION_KEYS = [
  "primary-category",
  "secondary-categories",
  "business-description",
  "service-areas",
  "address-public-location",
  "hours",
  "appointment-url",
  "website-url",
  "phone",
  "products-services",
  "photos",
  "posts",
  "q-and-a",
  "review-count",
  "rating",
  "review-recency",
  "response-coverage",
  "search-terms",
  "calls",
  "messages",
  "directions",
  "website-clicks",
  "profile-views",
] as const;

export type GbpDimensionKey = (typeof GBP_DIMENSION_KEYS)[number];

export type GbpDimension = {
  key: GbpDimensionKey;
  observedValue: string | null;
  source: "gbp-adapter" | "gbp-export" | "none" | "fixture-observed-only";
  freshness: "fresh" | "stale" | "unknown";
  confidence: number;
  externalVerificationState: LocalExternalVerificationState;
  recommendationEligible: boolean;
  evidenceClass: LocalEvidenceClass;
};

export type GbpIntelligenceSnapshot = {
  sourceState: GbpSourceState;
  dimensions: GbpDimension[];
  /** Single root source-gap ID when GBP is unreadable. */
  rootSourceGapId: string | null;
  adapterPresent: boolean;
  /** True only when a verified read adapter or trusted export supplied data. */
  hasVerifiedGbpData: boolean;
};

export type LocalEntityFieldKey =
  | "business-name"
  | "founder-name"
  | "founder-credentials"
  | "primary-location"
  | "service-areas"
  | "phone"
  | "email"
  | "address"
  | "locality"
  | "region"
  | "postal-code"
  | "country"
  | "website-url"
  | "primary-service-description"
  | "local-business-schema"
  | "organization-schema"
  | "social-profile-links"
  | "contact-concierge-route"
  | "review-testimonial-route"
  | "charlotte-guide-routes"
  | "local-metadata-titles"
  | "local-internal-links";

export type LocalEntityField = {
  key: LocalEntityFieldKey;
  present: boolean;
  normalizedValue: string | null;
  sourceRouteOrFile: string;
  consistencyStatus:
    | "consistent"
    | "complementary"
    | "ambiguous"
    | "contradiction"
    | "missing"
    | "unknown";
  confidence: number;
  sensitivity: "public" | "internal" | "sensitive";
  public: boolean;
  externalVerificationRequired: boolean;
};

export type LocalEntityInventory = {
  fields: LocalEntityField[];
  charlotteGuideRoutes: string[];
  serviceAreaSignals: string[];
  schemaTypesPresent: string[];
  hasAggregateRatingSchema: boolean;
  hasReviewSchema: boolean;
  hasStreetAddress: boolean;
  hasPostalCode: boolean;
  hasTelephoneInSchema: boolean;
};

export type LocalAuthorityFinding = {
  id: string;
  type: LocalAuthorityFindingType;
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  geography: LocalGeography;
  queryOrPage: string | null;
  route: string | null;
  source: "gsc" | "repository" | "gbp" | "local";
  evidenceClass: LocalEvidenceClass;
  confidence: number;
  sampleSize: number | null;
  freshness: "fresh" | "stale" | "unknown";
  localIntentKind: LocalIntentKind | null;
  likelyImpact: number;
  effort: "low" | "medium" | "high";
  urgency: "critical" | "high" | "medium" | "low";
  dependency: string | null;
  owner: "search-strategy" | "content" | "opportunity" | "business-intelligence";
  founderApprovalRequired: boolean;
  externalVerificationState: LocalExternalVerificationState;
  isInference: boolean;
  executionOwnedElsewhere: boolean;
  suppressRecommendation: boolean;
  evidenceNotes: string[];
  supportingReference: string;
};

export type LocalAuthorityVolumeFunnel = {
  rawFindings: number;
  qualifiedFindings: number;
  gbpUnknownDimensions: number;
  monitorDeferredFindings: number;
  rankedRecommendations: number;
  surfacedEligible: number;
};

export type LocalAuthorityHandoff = {
  contentHandoffIds: string[];
  opportunityHandoffIds: string[];
  biHandoffIds: string[];
  /** Search retains diagnosis ownership for these finding IDs. */
  searchDiagnosisIds: string[];
};

export type LocalAuthorityAudit = {
  entityInventory: LocalEntityInventory;
  gbp: GbpIntelligenceSnapshot;
  findings: LocalAuthorityFinding[];
  handoffs: LocalAuthorityHandoff;
  volumeFunnel: LocalAuthorityVolumeFunnel;
  facts: string[];
  inferences: string[];
  observationMode: "fixture" | "live" | "unavailable";
};

/** Stable root GBP measurement/source gap — one recommendation, not per-dimension flood. */
export const GBP_ROOT_SOURCE_GAP_ID =
  "search-strategy:gbp:measurement-gap:google-business-profile";
