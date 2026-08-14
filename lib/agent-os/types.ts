/**
 * Hourglass Agent OS V1 — shared typed contracts.
 * Server-only. Read-only execution boundary.
 */

export const AGENT_OS_VERSION = "1.0.0" as const;

export type ExecutiveId =
  | "chief-of-staff"
  | "business-intelligence"
  | "search-strategy"
  | "content"
  | "opportunity";

export type ImplementationStatus =
  | "operational"
  | "scaffold"
  | "planned";

export type DataSourceId =
  | "ga4"
  | "gsc"
  | "weekly-intelligence"
  | "executive-dashboard-snapshot"
  | "hubspot-aggregates"
  | "buffer"
  | "gbp"
  | "fixture";

export type PermissionPosture = "read-only" | "write-capable" | "unknown";

export type FreshnessStatus =
  | "fresh"
  | "stale"
  | "unknown"
  | "unavailable";

export type ReliabilityStatus =
  | "reliable"
  | "degraded"
  | "unverified"
  | "unavailable";

export type RedactionStatus = "clean" | "redacted" | "blocked";

export type SourceType =
  | "analytics"
  | "search"
  | "crm"
  | "social"
  | "local"
  | "internal-report"
  | "fixture"
  | "derived";

export type Evidence = {
  source: DataSourceId | string;
  sourceType: SourceType;
  collectedAt: string;
  reportingPeriod: { start: string; end: string };
  metricOrObservation: string;
  priorComparison?: string | null;
  freshness: FreshnessStatus;
  reliability: ReliabilityStatus;
  supportingReference?: string | null;
  redactionStatus: RedactionStatus;
};

export type Urgency = "critical" | "high" | "medium" | "low";
export type EffortEstimate = "low" | "medium" | "high";
export type Reversibility = "easily-reversed" | "partially-reversed" | "hard-to-reverse";
export type RecommendationStatus =
  | "proposed"
  | "blocked"
  | "downgraded"
  | "consolidated"
  | "monitor"
  | "ignore";

export type AgendaBucket = "do-now" | "schedule-next" | "monitor" | "ignore";

export type RankingFactors = {
  expectedBusinessImpact: number; // 0–10
  confidence: number; // 0–1
  urgency: number; // 0–10
  effort: number; // 0–10 (higher = more effort; ranking penalizes)
  reversibility: number; // 0–10 (higher = easier to reverse)
  strategicAlignment: number; // 0–10
  dependencyReadiness: number; // 0–1
  dataQuality: number; // 0–1
};

export type Recommendation = {
  recommendationId: string;
  originatingExecutive: ExecutiveId;
  title: string;
  plainLanguageExplanation: string;
  whyItMattersNow: string;
  proposedAction: string;
  expectedUpside: string;
  effortEstimate: EffortEstimate;
  urgency: Urgency;
  reversibility: Reversibility;
  confidence: number; // 0–1
  evidence: Evidence[];
  assumptions: string[];
  risks: string[];
  dependencies: string[];
  approvalRequired: boolean;
  suggestedOwner: string;
  status: RecommendationStatus;
  agendaBucket: AgendaBucket;
  rankingFactors: RankingFactors;
  /** Transparent composite score; never the sole confidence signal. */
  priorityScore: number;
  blockedReasons?: string[];
};

export type EscalationRule = {
  id: string;
  condition: string;
  action: string;
};

export type ExecutiveDefinition = {
  id: ExecutiveId;
  displayName: string;
  mission: string;
  ownedDomains: string[];
  allowedDataSources: DataSourceId[];
  prohibitedActions: string[];
  escalationRules: EscalationRule[];
  implementationStatus: ImplementationStatus;
  version: string;
};

export type SourceHealth = {
  sourceId: DataSourceId;
  configured: boolean;
  reachable: boolean;
  fresh: boolean;
  complete: boolean;
  permissionPosture: PermissionPosture;
  lastSuccessfulRead: string | null;
  errors: string[];
  effectOnConfidence: string;
  retrievalState: "ok" | "empty" | "failed" | "not-configured" | "fixture";
  /**
   * Precise measurement classification for GA4/GSC (and future adapters).
   * Prefer this over parsing free-form errors when present.
   */
  healthCode?: import("./measurement/health-codes").MeasurementHealthCode;
  /** Founder-facing compact label derived from healthCode. */
  founderLabel?: string;
  /** Newest reliable source date when known (YYYY-MM-DD). */
  newestSourceDate?: string | null;
  /** Age of newest source date vs most recent complete local day. */
  sourceAgeDays?: number | null;
};

export type Anomaly = {
  id: string;
  severity: Urgency;
  title: string;
  observation: string;
  evidence: Evidence[];
  possibleCauses: string[];
  isTrackingFailureSuspect: boolean;
};

export type DataGap = {
  id: string;
  sourceId: DataSourceId | string;
  description: string;
  impactOnRecommendations: string;
  suggestedRemedy: string;
};

export type EscalationItem = {
  id: string;
  executiveId: ExecutiveId;
  title: string;
  reason: string;
  requiresFounderDecision: boolean;
};

/**
 * Structured run outcomes for future automation (e.g. email schedulers).
 * - completed: healthy finish
 * - completed-with-warnings: usable finish with non-fatal gaps/warnings
 * - failed: runner could not complete safely
 * - blocked: critical sources unavailable — zero recommendations is NOT “all clear”
 */
export type AgentRunStatus =
  | "completed"
  | "completed-with-warnings"
  | "failed"
  | "blocked";

export type RecommendationAvailability =
  | "has-material-recommendations"
  | "none-material"
  | "none-blocked-by-sources";

/** Per-executive outcome — independent of overall runStatus. */
export type ExecutiveRunStatus =
  | "completed"
  | "completed-with-warnings"
  | "blocked"
  | "skipped"
  | "failed";

export type ExecutiveRunSummary = {
  executiveId: ExecutiveId;
  status: ExecutiveRunStatus;
  materialRecommendationCount: number;
  note?: string;
};

/**
 * Future automated delivery hint (no transport in V1).
 * Distinguishes normal briefs, degraded partial briefs, failure alerts, and quiet weeks.
 */
export type DeliveryGuidance =
  | "send-normal-brief"
  | "send-degraded-partial-brief"
  | "send-failure-alert"
  | "send-nothing";

/** Whether the founder brief carries usable evidence this cycle. */
export type BriefEvidenceQuality =
  | "full"
  | "partial-degraded"
  | "none-blocked"
  | "failed";

/**
 * Separates opportunity detection, ranked recommendations, and Markdown surfacing.
 * Full ranked set remains in AgentRun.recommendations / opportunities JSON.
 */
export type BriefSurfacingSummary = {
  opportunitiesDetected: number;
  recommendationsRanked: number;
  recommendationsSurfacedInBrief: number;
};

export type FounderBrief = {
  whatChanged: string;
  whyItMatters: string;
  needsAttentionToday: string[];
  highestRoiAction: string;
  canSafelyWait: string[];
  blocked: string[];
  founderDecisionNeeded: string[];
  missingOrUnreliableData: string[];
  markdown: string;
  /** Individually named priority titles in the Markdown (excl. deferred summaries). */
  surfacedPriorityTitles: string[];
  /**
   * Persistent sprint orientation for Today’s Call (daily).
   * Not inventing evidence — carry-forward of master sprint focus.
   */
  sprintOrientation?: string | null;
  /**
   * Explicit day-job line from the master sprint (preferred for Today’s Call).
   */
  dayOrientation?: string | null;
  /**
   * Actionable opportunity-to-watch line with magnitude, or null when omitted.
   */
  opportunityToWatch?: string | null;
  /**
   * Optional Client Attention lines (max 2). Omitted when empty.
   * Safe display names only — no emails, phones, or CRM IDs.
   */
  clientAttentionItems?: Array<{
    title: string;
    summary: string;
    action: string;
  }> | null;
  /**
   * Daily Watch / No Action lines (management watch band). Omitted when empty.
   * Never used as Today’s Call / Highest-ROI / Top Priorities.
   */
  watchNoActionItems?: string[] | null;
};

export type AgentRun = {
  runId: string;
  generatedAt: string;
  /** Explicit fixture vs live — never ambiguous for consumers */
  mode: "fixture" | "live";
  reportingPeriod: { start: string; end: string };
  executivesInvoked: ExecutiveId[];
  executivesNotOperational: ExecutiveId[];
  sourcesAttempted: DataSourceId[];
  sourceHealth: SourceHealth[];
  recommendations: Recommendation[];
  anomalies: Anomaly[];
  dataGaps: DataGap[];
  escalationItems: EscalationItem[];
  brief: FounderBrief;
  runStatus: AgentRunStatus;
  /**
   * Separates “healthy quiet week” from “degraded / cannot recommend”.
   * Schedulers must not treat none-blocked-by-sources like none-material.
   */
  recommendationAvailability: RecommendationAvailability;
  /** Per-executive completion — BI can be blocked while Search still completed. */
  executiveStatuses: ExecutiveRunSummary[];
  /** Usable evidence quality for the founder-facing brief. */
  briefEvidenceQuality: BriefEvidenceQuality;
  /** Hint for a future sender — not wired to email/cron in V1. */
  deliveryGuidance: DeliveryGuidance;
  /** Opportunity vs ranked vs Markdown surfacing counts. */
  briefSurfacing: BriefSurfacingSummary;
  durationMs: number;
  warnings: string[];
  agentOsVersion: typeof AGENT_OS_VERSION;
  /**
   * Optional persistence outcome when a persistence adapter was requested.
   * Brief assembly does not require a successful write unless explicitly configured.
   */
  persistence?: {
    attempted: boolean;
    ok: boolean;
    adapterId: string;
    durabilityLabel: string;
    nonDurableLive: boolean;
    error: string | null;
    errorCode: string | null;
    findingChanges?: number;
    recommendationChanges?: number;
  };
};

export type DecisionOutcomeStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "deferred"
  | "in-progress"
  | "completed"
  | "abandoned";

export type FounderDecision =
  | "approve"
  | "reject"
  | "defer"
  | "request-more-evidence";

/** Decision Journal — typed schema only; no production write persistence in V1. */
export type DecisionJournalEntry = {
  decisionId: string;
  recommendationId: string;
  originatingExecutive: ExecutiveId;
  dateProposed: string;
  evidenceSnapshot: Evidence[];
  confidenceAtDecision: number;
  founderDecision: FounderDecision;
  founderRationale: string;
  actionOwner: string;
  targetDate: string | null;
  outcomeStatus: DecisionOutcomeStatus;
  measuredOutcome: string | null;
  reviewDate: string | null;
  lessonLearned: string | null;
};

export type ProhibitedAction =
  | "publish-content"
  | "edit-gbp"
  | "post-buffer"
  | "send-customer-messages"
  | "modify-hubspot"
  | "change-ga4"
  | "change-gsc"
  | "update-supabase"
  | "alter-website-content"
  | "run-cleanup"
  | "modify-vercel"
  | "rotate-secrets"
  | "change-production-config"
  | "self-approve-recommendations"
  | "make-purchases"
  | "contact-leads"
  | "write-external-systems";

export const V1_PROHIBITED_ACTIONS: readonly ProhibitedAction[] = [
  "publish-content",
  "edit-gbp",
  "post-buffer",
  "send-customer-messages",
  "modify-hubspot",
  "change-ga4",
  "change-gsc",
  "update-supabase",
  "alter-website-content",
  "run-cleanup",
  "modify-vercel",
  "rotate-secrets",
  "change-production-config",
  "self-approve-recommendations",
  "make-purchases",
  "contact-leads",
  "write-external-systems",
] as const;
