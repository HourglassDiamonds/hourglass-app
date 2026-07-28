/**
 * AI Fan-Out Coverage Analyzer — domain contracts.
 *
 * Question-universe + content-inventory coverage for Search Strategy.
 * Explainable, deterministic V1. No paid external AI dependency.
 */

export const QUERY_FAMILIES = [
  "beginner-education",
  "diamond-quality",
  "cut-and-sparkle",
  "natural-versus-lab",
  "shapes-and-appearance",
  "pricing-and-budgeting",
  "custom-design",
  "buying-process-anxiety",
  "proposal-and-surprise",
  "luxury-and-private-client",
  "local-charlotte-intent",
  "jeweler-comparison",
  "trust-ethics-credibility",
  "maintenance-repairs-ownership",
] as const;

export type QueryFamily = (typeof QUERY_FAMILIES)[number];

export const AUDIENCE_STAGES = [
  "discovering",
  "researching",
  "comparing",
  "selecting",
  "ready-to-contact",
  "post-purchase",
] as const;

export type AudienceStage = (typeof AUDIENCE_STAGES)[number];

export const SEARCH_INTENTS = [
  "informational",
  "commercial",
  "local",
  "transactional",
  "navigational",
] as const;

export type FanOutSearchIntent = (typeof SEARCH_INTENTS)[number];

export const GEOGRAPHIES = [
  "national",
  "charlotte",
  "waxhaw",
  "charlotte-metro",
  "unspecified",
] as const;

export type FanOutGeography = (typeof GEOGRAPHIES)[number];

export const QUESTION_STATUSES = [
  "active",
  "draft",
  "deprecated",
  "duplicate",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_SOURCES = [
  "seed-curated",
  "faq-derived",
  "guide-title-derived",
  "manual",
] as const;

export type QuestionSource = (typeof QUESTION_SOURCES)[number];

export const CONTENT_TYPES = [
  "core-page",
  "diamond-guide-article",
  "faq",
  "conversation",
  "transcript",
  "approach-qa",
  "testimonial",
  "structured-data",
  "local-landing",
  "tool-page",
] as const;

export type FanOutContentType = (typeof CONTENT_TYPES)[number];

export const COVERAGE_BANDS = ["fully-covered", "partially-covered", "uncovered"] as const;
export type CoverageBand = (typeof COVERAGE_BANDS)[number];

export const RECOMMENDED_ACTIONS = [
  "expand-existing-page",
  "create-diamond-guide-article",
  "add-faq",
  "create-conversation-topic",
  "create-local-landing-section",
  "add-schema",
  "strengthen-internal-linking",
  "add-founder-evidence",
  "add-comparison-or-demonstration",
  "no-action-needed",
] as const;

export type RecommendedContentAction = (typeof RECOMMENDED_ACTIONS)[number];

export const RECOMMENDED_FORMATS = [
  "diamond-guide-article",
  "faq-block",
  "core-page-section",
  "conversation-episode",
  "local-landing-section",
  "schema-markup",
  "internal-links",
  "founder-evidence-block",
  "comparison-demonstration",
] as const;

export type RecommendedContentFormat = (typeof RECOMMENDED_FORMATS)[number];

/** Stable curated or derived question in the fan-out universe. */
export type FanOutQuestion = {
  id: string;
  canonicalQuestion: string;
  queryFamily: QueryFamily;
  searchIntent: FanOutSearchIntent;
  audienceStage: AudienceStage;
  geography: FanOutGeography;
  /** 1–10 commercial conversion proximity */
  commercialValue: number;
  /** 1–10 authority / trust-building value */
  authorityValue: number;
  source: QuestionSource;
  status: QuestionStatus;
  /** Terms used for deterministic matching */
  matchTerms: string[];
  /** Entity/topic tags */
  entities: string[];
  topics: string[];
  /** Optional near-duplicate of another question id */
  duplicateOfId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FanOutContentRecord = {
  id: string;
  url: string;
  title: string;
  contentType: FanOutContentType;
  /** Short extract for matching — never full article dump in reports */
  summary: string;
  topics: string[];
  entities: string[];
  geography: FanOutGeography;
  publicationStatus: "published" | "draft" | "unknown";
  publishedOrUpdatedAt: string | null;
  hasStructuredData: boolean;
  sourceSystemId: string;
  /**
   * Groups FAQ fragments, approach Q&A, transcripts, and the parent page
   * that share one underlying route/source. Used to prevent double-counting.
   */
  canonicalSourceId: string;
  /** Normalized searchable blob (title + summary + tags) */
  searchableText: string;
  relatedHrefs: string[];
};

export type MatchStrength = "strong" | "moderate" | "weak";

export type ContentMatch = {
  contentId: string;
  strength: MatchStrength;
  score: number;
  reasons: string[];
};

export type CoverageFactorKey =
  | "directAnswer"
  | "completeness"
  | "specificity"
  | "firstPartyExpertise"
  | "supportingEvidence"
  | "localRelevance"
  | "formatDiversity"
  | "freshness"
  | "internalLinkSupport"
  | "schemaSupport";

export type CoverageFactorScore = {
  key: CoverageFactorKey;
  label: string;
  weight: number;
  score: number;
  reason: string;
};

export type QuestionCoverage = {
  questionId: string;
  band: CoverageBand;
  /** 0–100 explainable composite */
  score: number;
  factors: CoverageFactorScore[];
  matches: ContentMatch[];
  reasons: string[];
};

export type GapClusterRole =
  | "flagship"
  | "supporting-faq"
  | "expand-existing"
  | "distinct";

export type FanOutOpportunity = {
  id: string;
  questionId: string;
  question: string;
  queryFamily: QueryFamily;
  audienceStage: AudienceStage;
  geography: FanOutGeography;
  coverageScore: number;
  coverageBand: CoverageBand;
  whyCoverageWeak: string[];
  recommendedAction: RecommendedContentAction;
  recommendedFormat: RecommendedContentFormat;
  suggestedExistingPage: string | null;
  commercialValue: number;
  authorityValue: number;
  /** 0–100 explainable priority */
  priorityScore: number;
  priorityReasons: string[];
  /** Overlapping-gap cluster — avoids recommending competing thin pages */
  gapClusterId: string | null;
  clusterRole: GapClusterRole;
  /** Human title for a consolidated flagship when clusterRole is flagship */
  flagshipTitle: string | null;
  /** Sibling questions covered by the same flagship / FAQ set */
  supportingQuestionIds: string[];
  /** When supporting, points at the flagship opportunity id */
  consolidatedIntoOpportunityId: string | null;
};

export type FamilyCoverageStat = {
  family: QueryFamily;
  questionCount: number;
  averageScore: number;
  fullyCovered: number;
  partiallyCovered: number;
  uncovered: number;
};

export type FanOutExecutiveSummary = {
  totalQuestionsAnalyzed: number;
  fullyCovered: number;
  partiallyCovered: number;
  uncovered: number;
  averageCoverageScore: number;
  strongestQueryFamilies: FamilyCoverageStat[];
  weakestQueryFamilies: FamilyCoverageStat[];
  contentInventoryCount: number;
  topOpportunityCount: number;
};

/**
 * Run outcome for the fan-out capability (enhancement — must not abort Search Strategy).
 * - ok: analysis completed; recommendations may flow downstream
 * - unavailable: intentionally skipped (e.g. synthesis aborted / empty output)
 * - failed: unexpected failure; recommendations suppressed; inspect degradation
 */
export type FanOutCoverageStatus = "ok" | "unavailable" | "failed";

/** Stable categories for tests and internal inspection (not founder-facing noise). */
export type FanOutCoverageErrorCategory =
  | "inventory-construction"
  | "question-loading"
  | "matching"
  | "coverage-scoring"
  | "prioritization"
  | "summary-generation"
  | "unexpected";

export type FanOutFailureStage =
  | "inventory"
  | "question-loading"
  | "matching"
  | "coverage-scoring"
  | "prioritization"
  | "summary"
  | "unknown";

/** Structured degradation metadata — internal inspection only. */
export type FanOutCoverageDegradation = {
  errorCategory: FanOutCoverageErrorCategory;
  failedStage: FanOutFailureStage;
  /** Redacted, length-capped message — no stack traces or filesystem paths */
  safeMessage: string;
  recommendationsSuppressed: true;
};

/** Structured internal event (not founder brief content). */
export type FanOutCoverageInternalEvent = {
  at: string;
  level: "info" | "warn" | "error";
  category: FanOutCoverageErrorCategory | "ok" | "unavailable";
  stage: FanOutFailureStage | null;
  message: string;
};

export type FanOutCoverageSnapshot = {
  /** Distinguishes success / intentional skip / failure without missing-property inference */
  status: FanOutCoverageStatus;
  /** ISO timestamp when analysis completed or failure was recorded; null if unavailable */
  completedAt: string | null;
  /** Present only when status === "failed" */
  degradation: FanOutCoverageDegradation | null;
  /** Inspectable internal events — never copy raw stacks into founder briefs */
  internalEvents: FanOutCoverageInternalEvent[];
  summary: FanOutExecutiveSummary;
  questions: FanOutQuestion[];
  contentInventory: FanOutContentRecord[];
  coverages: QuestionCoverage[];
  /** Full ranked opportunities (internal inspection) */
  opportunities: FanOutOpportunity[];
  /** Cap for Search Strategy founder-facing recommendations */
  founderFacingOpportunities: FanOutOpportunity[];
  facts: string[];
  inferences: string[];
};
