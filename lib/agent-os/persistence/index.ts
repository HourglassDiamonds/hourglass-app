/**
 * Agent OS scheduling & persistence — public surface (server-only).
 *
 * Mutation boundary: Agent OS operational state only.
 * Does not mutate website, GA4, GSC, GBP, CRM, or customer data.
 * Founder-brief email delivery lives in lib/agent-os/cadence-delivery/ (email-only writes).
 */

export {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  AgentOsPersistenceError,
} from "./types";
export type * from "./types";

export {
  buildEvidenceFingerprint,
  confidenceBucket,
  extractMetricTokens,
  normalizeFingerprintTokens,
} from "./fingerprint";

export {
  transitionLifecycle,
  deferralStillActive,
  isTerminalLifecycle,
  lifecycleAfterFirstSeen,
} from "./lifecycle";

export {
  defaultCadenceDefinitions,
  getCadenceById,
  FOUNDER_CADENCE_TIMEZONE,
} from "./cadence";

export {
  evaluateCadence,
  evaluateAllCadences,
  resolveLocalEligibleAt,
  resolveLocalEligibleWeekdays,
} from "./evaluate-cadence";
export type { CadenceEvaluateInput } from "./evaluate-cadence";

export {
  evaluateFreshness,
  evaluateChiefOfStaffDependencyFreshness,
  FRESHNESS_WINDOWS_MS,
} from "./freshness";

export {
  evaluateFounderRecurrence,
  selectFounderPrioritiesForBrief,
  DEFAULT_FOUNDER_COOLDOWN_MS,
  CRITICAL_FOUNDER_COOLDOWN_MS,
  MAX_FOUNDER_BRIEF_PRIORITIES,
} from "./recurrence";

export { reconcilePersistedState } from "./reconcile";

export {
  createEmptyPersistedState,
  MAX_RETAINED_RUNS,
  MAX_RETAINED_DELIVERIES,
  DELIVERY_CLAIM_LEASE_MS,
  isPersistenceError,
} from "./store";
export type {
  AgentOsPersistenceStore,
  AtomicClaimDeliveryInput,
  AtomicClaimDeliveryResult,
  SavePersistenceOptions,
} from "./store";

export {
  validateAndMigrateState,
  parsePersistedStateJson,
  serializePersistedState,
  deepCloneState,
} from "./migrate";

export { InMemoryPersistenceAdapter } from "./adapters/memory";
export {
  FileLocalPersistenceAdapter,
  defaultAgentOsStatePath,
  fileLocalBackupPath,
  FILE_LOCAL_LKG_SUFFIX,
} from "./adapters/file";
export type {
  FileLocalAdapterOptions,
  FileLocalSaveTestHooks,
} from "./adapters/file";
export { UnconfiguredProductionAdapter } from "./adapters/unconfigured";
export {
  DurableTestPersistenceAdapter,
  createSharedDurableTestBackend,
} from "./adapters/durable-test";
export type { SharedDurableTestBackend } from "./adapters/durable-test";
export {
  SupabasePersistenceAdapter,
  tryCreateSupabasePersistenceAdapter,
  createFakeAgentOsSupabaseDb,
  createSupabaseAgentOsDb,
} from "./adapters/supabase";
export type { AgentOsSupabaseDb } from "./adapters/supabase";
export {
  decideClaimConflict,
  isLeaseExpired,
} from "./adapters/claim-lease-policy";

export {
  resolvePersistenceAdapter,
  assertNoFixtureStateInLive,
  assertScheduledLiveDurability,
} from "./resolve";
export type {
  ResolvePersistenceOptions,
  ResolvedPersistence,
} from "./resolve";

export {
  extractPersistableFromRun,
  inferRootProblemId,
  recommendationIsFounderRankable,
  fingerprintForRecommendation,
  PERSISTENCE_FIELD_BOUNDS,
} from "./extract";

export {
  resolveFounderSurfaceEligibility,
  projectRecurrenceRecords,
} from "./surface-eligibility";
export type { FounderSurfaceEligibility } from "./surface-eligibility";

export {
  timeZoneOffsetMinutes,
  localCalendarStamp,
  localMinutesSinceMidnight,
  isAtOrAfterLocalTime,
  utcIsoForLocalWallTime,
  founderLocalIsoWeekday,
} from "./timezone";
export type { LocalCalendarStamp } from "./timezone";

export { persistAgentOsRun } from "./persist-run";
export type {
  PersistAgentOsRunOptions,
  PersistAgentOsRunResult,
} from "./persist-run";

export {
  applyRecommendationTerminalState,
  markRecommendationTerminal,
  applyRecommendationReopen,
  reopenRecommendation,
} from "./mark-terminal";
export type {
  TerminalRecommendationStatus,
  TerminalCompletionSource,
  MarkRecommendationTerminalInput,
  MarkRecommendationTerminalResult,
  ReopenRecommendationInput,
  ReopenRecommendationResult,
} from "./mark-terminal";

export {
  bootstrapHistoricalTerminalsFromStaticBacklog,
} from "./bootstrap-historical";
export type {
  BootstrapHistoricalTerminalsResult,
  BootstrapSkip,
  BootstrapSkipReason,
} from "./bootstrap-historical";

export {
  logRecommendationLifecycleEvent,
} from "./lifecycle-log";
export type { RecommendationLifecycleEvent } from "./lifecycle-log";
