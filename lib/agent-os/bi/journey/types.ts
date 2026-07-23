/**
 * Client Journey & Conversion Analysis contracts.
 * Observed analytics ≠ inferred paths ≠ repository journey readiness.
 */

export const JOURNEY_STAGES = [
  "discovery",
  "consideration",
  "education",
  "visualization",
  "trust",
  "conversation-intent",
  "conversion",
  "unknown",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const JOURNEY_SURFACE_TYPES = [
  "homepage",
  "commercial",
  "guide",
  "local-guide",
  "tool",
  "trust",
  "brand",
  "editorial",
  "inquiry",
  "conversation",
  "conversion",
  "other",
] as const;

export type JourneySurfaceType = (typeof JOURNEY_SURFACE_TYPES)[number];

/**
 * Semantic journey role — finer than surfaceType.
 * Visiting a route ≠ completed conversion or appointment.
 */
export const JOURNEY_SURFACE_ROLES = [
  "editorial",
  "trust",
  "conversation-intent",
  "inquiry-conversion",
  "appointment",
  "tool",
  "commercial",
  "guide",
  "discovery",
  "ambiguous",
] as const;

export type JourneySurfaceRole = (typeof JOURNEY_SURFACE_ROLES)[number];

export const JOURNEY_TRANSITION_STATES = [
  "observed",
  "inferred",
  "repository-available",
  "unknown",
  "unsupported",
] as const;

export type JourneyTransitionState =
  (typeof JOURNEY_TRANSITION_STATES)[number];

export const JOURNEY_EVIDENCE_CLASSES = [
  "observed-analytics",
  "repository-backed",
  "inferred",
  "source-gap",
] as const;

export type JourneyEvidenceClass = (typeof JOURNEY_EVIDENCE_CLASSES)[number];

export const JOURNEY_FINDING_TYPES = [
  "high-entry-weak-next-step",
  "strong-engagement-missing-conversion-signal",
  "landing-intent-mismatch",
  "content-to-tool-disconnect",
  "tool-to-conversation-disconnect",
  "trust-surface-underuse",
  "fragmented-journey",
  "dead-end-route",
  "unclear-intended-next-step",
  "measurement-blocked-journey",
  "healthy-journey-coverage",
  "insufficient-sample",
  "source-unavailable",
  "conversion-signal-unknown",
  "repository-path-readiness",
] as const;

export type JourneyFindingType = (typeof JOURNEY_FINDING_TYPES)[number];

export const CONVERSION_SIGNAL_KINDS = [
  "form-submit",
  "conversation-start",
  "appointment-request",
  "click-to-call",
  "email-click",
  "studio-entry",
  "studio-completion",
  "guide-to-studio",
  "concierge-visit",
  "cta-click",
] as const;

export type ConversionSignalKind = (typeof CONVERSION_SIGNAL_KINDS)[number];

export const CONVERSION_SIGNAL_AVAILABILITY = [
  "observed",
  "not-observed",
  "unknown",
  "unsupported",
] as const;

export type ConversionSignalAvailability =
  (typeof CONVERSION_SIGNAL_AVAILABILITY)[number];

/** Stable root source-gap IDs — consolidate related symptoms under these. */
export const JOURNEY_PATH_MEASUREMENT_GAP_ID =
  "business-intelligence:journey:source-gap:journey-path-measurement" as const;

export const CONVERSION_EVENT_MEASUREMENT_GAP_ID =
  "business-intelligence:journey:source-gap:conversion-event-measurement" as const;

export const TOOL_COMPLETION_MEASUREMENT_GAP_ID =
  "business-intelligence:journey:source-gap:tool-completion-measurement" as const;

export const SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID =
  "business-intelligence:journey:source-gap:source-to-lead-attribution" as const;

export const JOURNEY_ROOT_SOURCE_GAP_IDS = [
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
] as const;

export type JourneyRootSourceGapId =
  (typeof JOURNEY_ROOT_SOURCE_GAP_IDS)[number];

export type JourneySurface = {
  id: string;
  route: string;
  label: string;
  stage: JourneyStage;
  surfaceType: JourneySurfaceType;
  /** Semantic role; editorial ≠ inquiry; inquiry visit ≠ submit/appointment. */
  role: JourneySurfaceRole;
  intendedNextSteps: string[];
  linkedTools: string[];
  linkedTrustSurfaces: string[];
  /** Routes that may lead toward inquiry — not proof of submit/appointment. */
  conversionDestinations: string[];
  repositoryEvidence: string;
  observability: "observable" | "partial" | "unobservable";
  measurementSource: "ga4" | "gsc" | "repository" | "none";
  confidence: number;
};

export type JourneyTransition = {
  id: string;
  fromSurfaceId: string;
  toSurfaceId: string;
  fromRoute: string;
  toRoute: string;
  state: JourneyTransitionState;
  sessionsOrCount: number | null;
  evidenceClass: JourneyEvidenceClass;
  evidenceNote: string;
  confidence: number;
};

export type ConversionSignal = {
  id: string;
  kind: ConversionSignalKind;
  label: string;
  source: "ga4" | "repository" | "none";
  availability: ConversionSignalAvailability;
  observedStatus: "observed" | "not-observed" | "unknown";
  count: number | null;
  confidence: number;
  supportsFounderConclusions: boolean;
  note: string;
};

export type JourneySourceGap = {
  id: JourneyRootSourceGapId;
  source: "ga4" | "gsc" | "cross-cutting";
  scope: string;
  affectedAnalyses: string[];
  founderRelevance: "prerequisite" | "diagnostic" | "suppressed";
  resolutionPrerequisite: string;
  suppressFromFounderRanking: boolean;
  /**
   * Parent/canonical founder-facing prerequisite when this gap is a child symptom.
   * Null when this gap is itself a root or is diagnostic-only.
   */
  parentRootId: string | null;
  /** True when this gap may appear as its own founder brief priority. */
  mayAppearIndependentlyInBrief: boolean;
};

export type JourneyFinding = {
  id: string;
  type: JourneyFindingType;
  title: string;
  evidenceClass: JourneyEvidenceClass;
  expectedEvidence: string;
  observedEvidence: string;
  confidence: number;
  sampleSize: number | null;
  severity: "critical" | "high" | "medium" | "low";
  affectedSurfaceId: string | null;
  affectedRoute: string | null;
  transitionState: JourneyTransitionState | null;
  owner:
    | "business-intelligence"
    | "chief-of-staff"
    | "search-strategy"
    | "content"
    | "opportunity";
  handoffTarget:
    | "business-intelligence"
    | "search-strategy"
    | "content"
    | "opportunity"
    | null;
  rootSourceGapId: JourneyRootSourceGapId | null;
  deduplicationKey: string;
  recommendedNextAction: string;
  whyItMatters: string;
  isInference: boolean;
  suppressRecommendation: boolean;
  suppressReason?: string | null;
  founderRankable: boolean;
};

export type JourneyHandoffs = {
  searchHandoffIds: string[];
  contentHandoffIds: string[];
  opportunityHandoffIds: string[];
  biDiagnosisIds: string[];
};

export type JourneyVolumeFunnel = {
  surfacesInventoried: number;
  observedEntries: number;
  observedTransitions: number;
  repositoryTransitions: number;
  conversionSignalsUnknown: number;
  rawFindings: number;
  qualifiedFindings: number;
  monitorDeferredFindings: number;
  rankedRecommendations: number;
  surfacedEligible: number;
};

export type JourneyObservationBundle = {
  mode: "fixture" | "live-derived";
  reportingPeriod: { start: string; end: string };
  landingPages: Array<{ route: string; sessions: number }>;
  /** Path-level transitions — only present when explicitly observed (fixture or future adapter). */
  transitions: Array<{
    fromRoute: string;
    toRoute: string;
    sessions: number;
  }>;
  /** True when path-level analytics were queried and available. */
  pathMeasurementAvailable: boolean;
  channelGroups: Array<{ value: string; sessions: number }>;
  eventCounts: Record<string, number>;
  queriedEventNames: readonly string[];
  gscTopPages: Array<{ path: string; clicks: number; impressions: number }>;
  gscTopQueries: Array<{ query: string; clicks: number; page?: string }>;
  ga4Available: boolean;
  gscAvailable: boolean;
  collectedAt: string;
};

export type ClientJourneyAudit = {
  surfaces: JourneySurface[];
  transitions: JourneyTransition[];
  conversionSignals: ConversionSignal[];
  sourceGaps: JourneySourceGap[];
  findings: JourneyFinding[];
  handoffs: JourneyHandoffs;
  volumeFunnel: JourneyVolumeFunnel;
  facts: string[];
  inferences: string[];
  observationMode: "fixture" | "live-derived" | "unavailable";
};
