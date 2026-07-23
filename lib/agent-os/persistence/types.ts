/**
 * Agent OS scheduling & persistence contracts.
 * SERVER ONLY — internal operational state; no customer data, no raw analytics payloads.
 */

import type {
  AgentRunStatus,
  BriefEvidenceQuality,
  DataSourceId,
  DeliveryGuidance,
  ExecutiveId,
  ExecutiveRunStatus,
  RecommendationAvailability,
  SourceHealth,
  Urgency,
} from "../types";

/** Persistence schema version — bump only with tested migration. */
export const AGENT_OS_PERSISTENCE_SCHEMA_VERSION = 1 as const;

export type PersistenceSchemaVersion = typeof AGENT_OS_PERSISTENCE_SCHEMA_VERSION;

export type PersistenceAdapterId =
  | "memory"
  | "file-local"
  | "unconfigured-production";

export type PersistenceDurability =
  | "ephemeral"
  | "local-durable"
  | "none";

export type RunTrigger =
  | "scheduled"
  | "manual"
  | "on-demand"
  | "test";

export type PersistedRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed-degraded"
  | "failed"
  | "partially-failed";

export type LifecycleState =
  | "new"
  | "active"
  | "unchanged"
  | "improved"
  | "worsened"
  | "deferred"
  | "completed"
  | "resolved"
  | "superseded"
  | "stale"
  | "blocked"
  | "unknown";

export type ChangeClassification =
  | "first-seen"
  | "unchanged"
  | "improved"
  | "worsened"
  | "resolved"
  | "deferred"
  | "completed"
  | "superseded"
  | "stale"
  | "reopened"
  | "blocked"
  | "source-gap"
  | "unknown";

export type FrequencyClass = "daily" | "weekly" | "on-demand";

export type DegradedRunPolicy =
  | "skip"
  | "allow-source-health-only"
  | "allow-partial-reconcile"
  | "allow-full-degraded";

export type CadenceSkipBehavior =
  | "skip-quietly"
  | "record-skip"
  | "surface-dependency-gap";

export type CadenceCatchUpBehavior =
  | "none"
  | "run-once"
  | "run-if-stale";

export type CadenceEvaluationReason =
  | "due"
  | "not-due"
  | "minimum-interval"
  | "source-unavailable"
  | "degraded-allowed"
  | "dependency-stale"
  | "dependency-missing"
  | "already-running"
  | "disabled"
  | "manual-override"
  | "catch-up"
  | "timezone-window";

export type RecurrenceEligibilityReason =
  | "newly-surfaced"
  | "materially-changed"
  | "worsened"
  | "deferred-date-reached"
  | "prerequisite-resolved"
  | "cooldown-elapsed"
  | "critical-unresolved"
  | "on-demand-requested"
  | "cooldown-active"
  | "deferred-not-due"
  | "completed-hidden"
  | "superseded-hidden"
  | "not-founder-rankable"
  | "lower-priority-slot-full";

export type PersistenceErrorCode =
  | "unconfigured"
  | "unsupported-schema"
  | "corrupted-state"
  | "write-failed"
  | "read-failed"
  | "mode-mismatch"
  | "fixture-leak"
  | "atomic-replace-failed"
  | "migration-refused";

export class AgentOsPersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly details?: string;

  constructor(code: PersistenceErrorCode, message: string, details?: string) {
    super(message);
    this.name = "AgentOsPersistenceError";
    this.code = code;
    this.details = details;
  }
}

export type PersistedItemChange = {
  kind: "finding" | "recommendation";
  stableId: string;
  previousLifecycle: LifecycleState | null;
  nextLifecycle: LifecycleState;
  changeClassification: ChangeClassification;
  fingerprintChanged: boolean;
  occurrenceCount: number;
};

export type AgentOsRunRecord = {
  schemaVersion: PersistenceSchemaVersion;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  mode: "fixture" | "live";
  trigger: RunTrigger;
  overallStatus: PersistedRunStatus;
  /** Maps to AgentRun.runStatus for correlation */
  agentRunStatus: AgentRunStatus | null;
  executiveStatuses: PersistedExecutiveRunRecord[];
  sourceHealthSummary: SourceHealth[];
  degradedStateSummary: string | null;
  findingCount: number;
  recommendationCount: number;
  founderPriorityCount: number;
  persistedItemChanges: PersistedItemChange[];
  errorSummary: string | null;
  recommendationAvailability: RecommendationAvailability | null;
  briefEvidenceQuality: BriefEvidenceQuality | null;
  deliveryGuidance: DeliveryGuidance | null;
  persistenceWriteOk: boolean;
  adapterId: PersistenceAdapterId;
  durability: PersistenceDurability;
};

export type PersistedExecutiveRunRecord = {
  schemaVersion: PersistenceSchemaVersion;
  executiveId: ExecutiveId;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: ExecutiveRunStatus | "pending" | "running";
  sourceStatus: string;
  findingIds: string[];
  recommendationIds: string[];
  errors: string[];
  warnings: string[];
  durationMs: number | null;
  outputVersion: string;
};

export type PersistedFindingRecord = {
  schemaVersion: PersistenceSchemaVersion;
  findingId: string;
  owningExecutive: ExecutiveId;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  currentEvidenceClass: string;
  currentConfidence: number;
  currentSeverity: Urgency | "unknown";
  currentSourceHealth: string;
  currentLifecycle: LifecycleState;
  previousLifecycle: LifecycleState | null;
  changeClassification: ChangeClassification;
  currentSummary: string;
  evidenceFingerprint: string;
  relatedRecommendationIds: string[];
  rootProblemId: string | null;
  supersededBy: string | null;
  resolvedAt: string | null;
  deferredUntil: string | null;
  lastSurfacedInFounderBriefAt: string | null;
  timesSurfacedInFounderBrief: number;
  lastHealthyObservationAt: string | null;
  comparableSourcesHealthyOnLastTouch: boolean;
  modeOrigin: "fixture" | "live";
};

export type PersistedRecommendationRecord = {
  schemaVersion: PersistenceSchemaVersion;
  recommendationId: string;
  owningExecutive: ExecutiveId;
  handoffTarget: ExecutiveId | string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  lifecycleState: LifecycleState;
  previousLifecycle: LifecycleState | null;
  changeClassification: ChangeClassification;
  priorityScore: number;
  confidence: number;
  founderRankable: boolean;
  currentAction: string;
  rootProblemId: string | null;
  dependencies: string[];
  blockers: string[];
  evidenceFingerprint: string;
  firstSurfacedAt: string | null;
  lastSurfacedAt: string | null;
  timesSurfaced: number;
  completedAt: string | null;
  deferredUntil: string | null;
  supersededBy: string | null;
  urgency: Urgency | "unknown";
  modeOrigin: "fixture" | "live";
};

export type CadenceDefinition = {
  schemaVersion: PersistenceSchemaVersion;
  cadenceId: string;
  scope: ExecutiveId | "system" | "agent-os";
  frequencyClass: FrequencyClass;
  intendedTrigger: RunTrigger;
  enabled: boolean;
  minimumIntervalMs: number;
  freshnessWindowMs: number;
  sourceRequirements: DataSourceId[];
  degradedRunPolicy: DegradedRunPolicy;
  skipBehavior: CadenceSkipBehavior;
  catchUpBehavior: CadenceCatchUpBehavior;
  timezone: string;
  nextEligibleAt: string | null;
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  description: string;
};

export type CadenceEvaluation = {
  cadenceId: string;
  due: boolean;
  shouldProceed: boolean;
  proceedDegraded: boolean;
  shouldSkip: boolean;
  reasonCodes: CadenceEvaluationReason[];
  detail: string;
  evaluatedAt: string;
  nextEligibleAt: string | null;
};

export type FreshnessEvaluation = {
  scope: ExecutiveId | "source-health" | "founder-brief";
  fresh: boolean;
  stale: boolean;
  ageMs: number | null;
  freshnessWindowMs: number;
  reason: string;
  compatibleWithSynthesis: boolean;
};

export type RecurrenceDecision = {
  recommendationId: string;
  eligible: boolean;
  reason: RecurrenceEligibilityReason;
  cooldownActive: boolean;
  detail: string;
};

export type ReconciliationSummary = {
  runId: string;
  mode: "fixture" | "live";
  findingsCreated: number;
  findingsUpdated: number;
  findingsUnchanged: number;
  findingsImproved: number;
  findingsWorsened: number;
  findingsResolved: number;
  findingsStale: number;
  findingsSuperseded: number;
  recommendationsCreated: number;
  recommendationsUpdated: number;
  recommendationsUnchanged: number;
  skippedDueToFailedRun: boolean;
  skippedDueToWriteGuard: boolean;
  changes: PersistedItemChange[];
  errors: string[];
};

export type AgentOsPersistedState = {
  schemaVersion: PersistenceSchemaVersion;
  adapterId: PersistenceAdapterId;
  durability: PersistenceDurability;
  modeScope: "fixture" | "live" | "test";
  updatedAt: string;
  runs: AgentOsRunRecord[];
  findings: Record<string, PersistedFindingRecord>;
  recommendations: Record<string, PersistedRecommendationRecord>;
  cadences: Record<string, CadenceDefinition>;
  /** Soft in-progress markers — not distributed locks. */
  inProgressByScope: Record<string, { runId: string; startedAt: string }>;
};

export type PersistableFindingInput = {
  findingId: string;
  owningExecutive: ExecutiveId;
  summary: string;
  evidenceClass: string;
  confidence: number;
  severity: Urgency | "unknown";
  sourceHealth: string;
  relatedRecommendationIds: string[];
  rootProblemId: string | null;
  evidenceFingerprint: string;
  comparableSourcesHealthy: boolean;
  supersededBy?: string | null;
  deferredUntil?: string | null;
  founderSurfaced?: boolean;
};

export type PersistableRecommendationInput = {
  recommendationId: string;
  owningExecutive: ExecutiveId;
  handoffTarget: ExecutiveId | string | null;
  priorityScore: number;
  confidence: number;
  founderRankable: boolean;
  currentAction: string;
  rootProblemId: string | null;
  dependencies: string[];
  blockers: string[];
  evidenceFingerprint: string;
  urgency: Urgency | "unknown";
  deferredUntil?: string | null;
  completed?: boolean;
  supersededBy?: string | null;
  founderSurfaced?: boolean;
  lifecycleHint?: LifecycleState;
};

export type RunPersistenceInput = {
  runId: string;
  startedAt: string;
  completedAt: string;
  mode: "fixture" | "live";
  trigger: RunTrigger;
  agentRunStatus: AgentRunStatus;
  executiveStatuses: PersistedExecutiveRunRecord[];
  sourceHealth: SourceHealth[];
  degradedStateSummary: string | null;
  findings: PersistableFindingInput[];
  recommendations: PersistableRecommendationInput[];
  founderPriorityIds: string[];
  recommendationAvailability: RecommendationAvailability;
  briefEvidenceQuality: BriefEvidenceQuality;
  deliveryGuidance: DeliveryGuidance;
  errorSummary: string | null;
  now?: string;
};
