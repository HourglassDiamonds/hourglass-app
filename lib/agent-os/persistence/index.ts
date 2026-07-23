/**
 * Agent OS scheduling & persistence — public surface (server-only).
 *
 * Mutation boundary: Agent OS operational state only.
 * Does not mutate website, GA4, GSC, GBP, CRM, email, or customer data.
 * Email delivery is explicitly deferred to a later pass.
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

export { evaluateCadence, evaluateAllCadences } from "./evaluate-cadence";
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
  isPersistenceError,
} from "./store";
export type { AgentOsPersistenceStore } from "./store";

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
  resolvePersistenceAdapter,
  assertNoFixtureStateInLive,
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
} from "./timezone";

export { persistAgentOsRun } from "./persist-run";
export type {
  PersistAgentOsRunOptions,
  PersistAgentOsRunResult,
} from "./persist-run";
