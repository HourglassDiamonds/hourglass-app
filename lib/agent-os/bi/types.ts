/**
 * Business Intelligence — Conversion & Measurement Audit contracts.
 * Expected instrumentation ≠ observed analytics ≠ verified operational conversion.
 */

export const MEASUREMENT_HEALTH_TYPES = [
  "expected-event-not-observed",
  "observed-event-not-documented",
  "event-volume-too-low",
  "event-name-inconsistency",
  "event-parameter-gap",
  "funnel-stage-unmeasured",
  "funnel-dropoff",
  "tool-entry-completion-gap",
  "tool-to-concierge-gap",
  "concierge-start-submit-gap",
  "destination-quality-gap",
  "attribution-gap",
  "source-medium-anomaly",
  "direct-traffic-overconcentration",
  "self-referral-risk",
  "cross-domain-risk",
  "conversion-definition-gap",
  "measurement-regression",
  "sample-size-limitation",
  "data-freshness-gap",
  "privacy-sensitive-event-risk",
  "measurement-healthy",
  "verification-required",
] as const;

export type MeasurementHealthType = (typeof MEASUREMENT_HEALTH_TYPES)[number];

export const MEASUREMENT_DECISION_EFFECTS = [
  "decision-blocking",
  "decision-degrading",
  "monitor",
] as const;

export type MeasurementDecisionEffect =
  (typeof MEASUREMENT_DECISION_EFFECTS)[number];

export const EXPECTED_EVENT_CATEGORIES = [
  "page-view",
  "tool-entry",
  "tool-progression",
  "tool-completion",
  "cta-click",
  "concierge-start",
  "concierge-submit",
  "contact-click",
  "content-engagement",
  "outbound-click",
  "error",
  "validation-failure",
] as const;

export type ExpectedEventCategory =
  (typeof EXPECTED_EVENT_CATEGORIES)[number];

export const OBSERVED_STATUSES = [
  "observed",
  "not-observed",
  "unknown",
] as const;

export type ObservedStatus = (typeof OBSERVED_STATUSES)[number];

export const CONVERSION_IMPORTANCE = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export type ConversionImportance = (typeof CONVERSION_IMPORTANCE)[number];

export const FUNNEL_IDS = [
  "general-consultation",
  "diamond-studio",
  "see-it-on-your-hand",
  "analyze-sparkle",
  "content-to-conversion",
] as const;

export type FunnelId = (typeof FUNNEL_IDS)[number];

export type ExpectedEventDefinition = {
  /** Stable expected-event ID (not a finding ID). */
  stableEventId: string;
  expectedEventName: string;
  category: ExpectedEventCategory;
  route: string | null;
  journey: FunnelId | "cross-cutting" | null;
  funnelStage: string;
  triggerDescription: string;
  sourceReference: string;
  expectedParameters: string[];
  conversionImportance: ConversionImportance;
  required: boolean;
  privacySensitivity: "none" | "low" | "elevated";
  repositoryConfidence: number;
  /** True when repo evidence is clear call-site / constant documentation. */
  repositoryEvidenceClear: boolean;
};

export type ObservedEventRecord = {
  eventName: string;
  observedStatus: ObservedStatus;
  currentCount: number | null;
  previousCount: number | null;
  observationPeriod: { start: string; end: string } | null;
  comparisonPeriod: { start: string; end: string } | null;
  sampleSize: number | null;
  /** True when count comes from a verified analytics pull for this event. */
  queriedByAdapter: boolean;
  inferenceFlag: boolean;
};

export type ExpectedEventInventoryItem = ExpectedEventDefinition & {
  observedStatus: ObservedStatus;
  observationPeriod: { start: string; end: string } | null;
  observationSample: number | null;
  inferenceFlag: boolean;
  currentCount: number | null;
  previousCount: number | null;
};

export type FunnelStageDefinition = {
  stageId: string;
  label: string;
  expectedEventName: string | null;
  route: string | null;
  /** Stage is defined from repository evidence only until observed. */
  evidenceBasis: "repository" | "observed" | "both" | "unsupported";
};

export type FunnelDefinition = {
  funnelId: FunnelId;
  label: string;
  stages: FunnelStageDefinition[];
};

export type SourceMediumRow = {
  source: string;
  medium: string;
  sessions: number;
};

export type BiConversionObservationBundle = {
  mode: "fixture" | "live-derived";
  reportingPeriod: { start: string; end: string };
  comparisonPeriod: { start: string; end: string } | null;
  /** Event names Agent OS attempted to observe in this pass. */
  queriedEventNames: readonly string[];
  eventCounts: Record<
    string,
    { current: number; previous: number | null }
  >;
  channelGroups: Array<{ value: string; sessions: number }>;
  landingPages: Array<{ value: string; sessions: number }>;
  /** Optional source/medium rows — fixture only unless a future adapter supplies them. */
  sourceMediumRows: SourceMediumRow[];
  ga4Available: boolean;
  ga4RetrievalState: string;
  collectedAt: string;
};

export type MeasurementFinding = {
  id: string;
  type: MeasurementHealthType;
  title: string;
  expectedEvidence: string;
  observedEvidence: string;
  confidence: number;
  sampleSize: number | null;
  freshness: "current" | "stale" | "unknown";
  severity: "critical" | "high" | "medium" | "low";
  decisionEffect: MeasurementDecisionEffect;
  likelyDecisionImpact: string;
  affectedFunnel: FunnelId | "cross-cutting" | null;
  affectedRoute: string | null;
  affectedEvent: string | null;
  recommendedNextAction: string;
  whyItMatters: string;
  dependency: string | null;
  owner: string;
  founderApprovalRequired: boolean;
  codeOrConfigChangeEventuallyRequired: boolean;
  blocksOtherExecutive: boolean;
  blockedExecutive?: "opportunity" | "search-strategy" | "content" | null;
  isInference: boolean;
  suppressRecommendation: boolean;
  suppressReason?: string | null;
};

export type OpportunityMeasurementHandoff = {
  conversionEventVerified: boolean;
  conversionEventStatus: ObservedStatus;
  authoritativeConversionEvent: string;
  destinationMeasurable: boolean;
  sourceAttributionUsable: boolean;
  geographicSegmentationAvailable: boolean;
  paidSearchMeasurementPrerequisiteMissing: boolean;
  remarketingAudienceEvidenceAvailable: boolean;
  remarketingConsentEvidenceAvailable: boolean;
  toolEngagementObserved: boolean;
  toolToConciergeMeasurable: boolean;
  measurementPrerequisites: string[];
  decisionBlockingFindingIds: string[];
  decisionDegradingFindingIds: string[];
  notes: string[];
};

/**
 * Volume funnel for measurement audit transparency.
 * Confirms the audit does not promote every unknown/missing event to a recommendation.
 */
export type MeasurementVolumeFunnel = {
  expectedEventsInventoried: number;
  observedEvents: number;
  notObservedEvents: number;
  unknownEvents: number;
  rawFindings: number;
  /** Non-monitor, non-healthy findings that could support decisions. */
  qualifiedFindings: number;
  /** Findings retained as monitor/deferred/healthy (no problem rec). */
  monitorDeferredFindings: number;
  rankedBiRecommendations: number;
  /** Recommendations eligible for founder brief (not consolidated/ignore). */
  surfacedEligibleBiRecommendations: number;
};

export type ConversionMeasurementAudit = {
  expectedEvents: ExpectedEventInventoryItem[];
  funnels: FunnelDefinition[];
  findings: MeasurementFinding[];
  opportunityHandoff: OpportunityMeasurementHandoff;
  volumeFunnel: MeasurementVolumeFunnel;
  facts: string[];
  inferences: string[];
  observationMode: "fixture" | "live-derived" | "unavailable";
};

/** Stable root ID for the Concierge conversion-measurement cluster. */
export const CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID =
  "business-intelligence:measurement:concierge-conversion-root:concierge" as const;
