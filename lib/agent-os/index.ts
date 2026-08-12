/**
 * Hourglass Agent OS V1 — public module surface.
 *
 * SERVER ONLY for runtime exports (run, adapters, executives that load data).
 * Do not import this barrel from Client Components.
 *
 * Pure type-only consumers should prefer:
 *   import type { AgentRun, Evidence, Recommendation } from "@/lib/agent-os/types"
 * which does not pull live adapters.
 */

export { AGENT_OS_VERSION, V1_PROHIBITED_ACTIONS } from "./types";
export type * from "./types";

export {
  EXECUTIVE_REGISTRY,
  getExecutive,
  listExecutives,
  operationalExecutives,
  scaffoldExecutives,
  isExecutiveOperational,
  assertOperationalForRecommendations,
} from "./registry";

export {
  registerConnector,
  clearRegisteredConnectors,
  listRegisteredConnectors,
  isActionProhibited,
  assertActionAllowed,
  getProhibitedActions,
  proposedActionImpliesWrite,
} from "./permissions";

export {
  createEvidence,
  classifyFreshness,
  evidenceDataQuality,
  hasUsableEvidence,
  labelStaleEvidence,
} from "./evidence";

export {
  RANKING_LOGIC_SUMMARY,
  buildRankingFactors,
  computePriorityScore,
  finalizeRecommendation,
  rankRecommendations,
  compareRecommendations,
  applyEvidenceToConfidence,
} from "./ranking";

export {
  buildRecommendation,
  consolidateDuplicates,
} from "./recommendation";

export {
  validateDecisionJournalEntry,
  InMemoryDecisionJournal,
} from "./decision-journal";

export { buildSourceHealth, summarizeSourceHealth } from "./source-health";

export { redactSecretsAndPii, redactError, deepRedactUnknown } from "./redaction";

export { runAgentOsBrief, listAgentOsExecutives } from "./run";
export type { RunAgentOsOptions } from "./run";

export {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  AgentOsPersistenceError,
  buildEvidenceFingerprint,
  confidenceBucket,
  transitionLifecycle,
  defaultCadenceDefinitions,
  getCadenceById,
  FOUNDER_CADENCE_TIMEZONE,
  evaluateCadence,
  evaluateAllCadences,
  evaluateFreshness,
  evaluateChiefOfStaffDependencyFreshness,
  FRESHNESS_WINDOWS_MS,
  evaluateFounderRecurrence,
  selectFounderPrioritiesForBrief,
  DEFAULT_FOUNDER_COOLDOWN_MS,
  CRITICAL_FOUNDER_COOLDOWN_MS,
  MAX_FOUNDER_BRIEF_PRIORITIES,
  reconcilePersistedState,
  createEmptyPersistedState,
  InMemoryPersistenceAdapter,
  FileLocalPersistenceAdapter,
  UnconfiguredProductionAdapter,
  defaultAgentOsStatePath,
  fileLocalBackupPath,
  resolvePersistenceAdapter,
  assertScheduledLiveDurability,
  extractPersistableFromRun,
  persistAgentOsRun,
  parsePersistedStateJson,
  validateAndMigrateState,
  resolveFounderSurfaceEligibility,
  projectRecurrenceRecords,
  fingerprintForRecommendation,
  PERSISTENCE_FIELD_BOUNDS,
  timeZoneOffsetMinutes,
  localCalendarStamp,
  DurableTestPersistenceAdapter,
  createSharedDurableTestBackend,
  tryCreateSupabasePersistenceAdapter,
  SupabasePersistenceAdapter,
  createFakeAgentOsSupabaseDb,
  createSupabaseAgentOsDb,
  DELIVERY_CLAIM_LEASE_MS,
  decideClaimConflict,
  isLeaseExpired,
} from "./persistence";
export type {
  AgentOsPersistenceStore,
  PersistAgentOsRunResult,
  CadenceDefinition,
  CadenceEvaluation,
  LifecycleState,
  ReconciliationSummary,
  PersistedFindingRecord,
  PersistedRecommendationRecord,
  AgentOsRunRecord,
  AgentOsDeliveryRecord,
  DeliveryStatus,
} from "./persistence";

export {
  executeAgentOsCadence,
  inspectAgentOsDeliveries,
  evaluateDeliveryEligibility,
  createFakeEmailSender,
  FOUNDER_BRIEF_CADENCE_IDS,
  resolveUncertainDelivery,
  listDueFounderCadencesInOrder,
} from "./cadence-delivery";
export type {
  CadenceExecutionResult,
  CadenceExecutionMode,
  ExecuteCadenceOptions,
} from "./cadence-delivery";

export {
  AGENT_RUN_STATUSES,
  resolveRunStatus,
  resolveRecommendationAvailability,
  criticalSourcesUnavailable,
  countMaterialRecommendations,
} from "./run-status";

export {
  resolveDeliveryGuidance,
  resolveBriefEvidenceQuality,
  resolveBiExecutiveStatus,
  resolveSearchExecutiveStatus,
  resolveContentExecutiveStatus,
  resolveOpportunityExecutiveStatus,
} from "./delivery";

export {
  buildSearchOpportunityId,
  buildSearchRecommendationId,
  searchIdLooksSafe,
} from "./search/ids";

export {
  buildContentOpportunityId,
  buildContentRecommendationId,
  contentIdLooksSafe,
} from "./content/ids";

export {
  buildOpportunityId,
  buildOpportunityRecommendationId,
  opportunityIdLooksSafe,
} from "./opportunity/ids";

export {
  REQUIRED_BRIEF_QUESTIONS,
  runChiefOfStaff,
} from "./executives/chief-of-staff";

export { runBusinessIntelligence } from "./executives/business-intelligence";
export type {
  BusinessIntelligenceOutput,
  RunBusinessIntelligenceOptions,
} from "./executives/business-intelligence";

export {
  runConversionMeasurementAudit,
  buildMeasurementFindingId,
  measurementIdLooksSafe,
  EXPECTED_EVENT_INVENTORY,
  AUTHORITATIVE_CONVERSION_EVENT,
  GA4_ADAPTER_QUERIED_EVENTS,
  FUNNEL_DEFINITIONS,
  createFixtureConversionObservations,
  MEASUREMENT_HEALTH_TYPES,
  MEASUREMENT_DECISION_EFFECTS,
  MIN_FUNNEL_SAMPLE,
  CONCIERGE_CONVERSION_ROOT_RECOMMENDATION_ID,
  isConciergeConversionClusterFinding,
  runClientJourneyAnalysis,
  emptyClientJourneyAudit,
  buildJourneyFindingId,
  journeyIdLooksSafe,
  JOURNEY_FINDING_TYPES,
  JOURNEY_PATH_MEASUREMENT_GAP_ID,
  CONVERSION_EVENT_MEASUREMENT_GAP_ID,
  TOOL_COMPLETION_MEASUREMENT_GAP_ID,
  SOURCE_TO_LEAD_ATTRIBUTION_GAP_ID,
  createFixtureJourneyObservations,
  MIN_JOURNEY_SAMPLE,
  applyJourneyFounderRankingGate,
  consolidateJourneyDuplicates,
  sequenceJourneyMeasurementPrerequisites,
} from "./bi";
export type {
  ConversionMeasurementAudit,
  MeasurementFinding,
  OpportunityMeasurementHandoff,
  MeasurementDecisionEffect,
  MeasurementHealthType,
  ExpectedEventInventoryItem,
  MeasurementVolumeFunnel,
  ClientJourneyAudit,
  JourneyFinding,
  JourneyFindingType,
  JourneyObservationBundle,
} from "./bi";

export {
  runSearchStrategy,
  emptySearchStrategyOutput,
  type SearchStrategyOutput,
  type RunSearchStrategyOptions,
} from "./executives/search-strategy";

export {
  runContentExecutive,
  emptyContentExecutiveOutput,
} from "./executives/content";
export type { ContentExecutiveOutput } from "./executives/content";

export {
  runOpportunityExecutive,
  emptyOpportunityExecutiveOutput,
} from "./executives/opportunity";
export type { OpportunityExecutiveOutput } from "./executives/opportunity";

export {
  SEARCH_OPPORTUNITY_TYPES,
  type SearchOpportunityType,
  type SearchOpportunity,
  type SearchIntentClass,
} from "./search/types";

export {
  buildGscEvidenceBundle,
  emptyGscEvidenceBundle,
  GSC_EVIDENCE_SOURCE,
  GSC_BRAND_CLASSIFIER_ID,
  type GscEvidenceBundle,
  type GscEpistemicClass,
} from "./search/gsc-evidence";

export {
  CONTENT_OPPORTUNITY_TYPES,
  type ContentOpportunityType,
  type ContentOpportunity,
  type ContentFormat,
} from "./content/types";

export {
  OPPORTUNITY_TYPES,
  OPPORTUNITY_READINESS_STATES,
  type OpportunityType,
  type OpportunityReadiness,
  type GrowthOpportunity,
  type OpportunityVolumeFunnel,
} from "./opportunity/types";

export {
  isBrandQuery,
  isLocalIntent,
  classifyQueryIntent,
  isSmallSample,
  classifyLocalGeography,
  classifyLocalIntentKind,
  isLocalAuthorityQuery,
} from "./search/classify";

export { detectGscOpportunities, detectGscEvidenceOpportunities } from "./search/opportunities";
export {
  inspectGuideAuthority,
  FAQ_SCHEMA_ARTICLE_SLUGS,
} from "./search/guide-authority";

export {
  runFanOutCoverageAnalyzer,
  emptyFanOutCoverageSnapshot,
  runFanOutCoverageGuarded,
  buildFailedFanOutCoverageSnapshot,
  buildUnavailableFanOutCoverageSnapshot,
  FanOutCoverageStageError,
  fanOutCoverageDataGap,
  sanitizeFanOutSafeMessage,
  classifyFanOutFailure,
  buildFanOutContentInventory,
  matchQuestionToContent,
  scoreContentMatch,
  scoreQuestionCoverage,
  coverageBandFromScore,
  resolveCoverageBand,
  FULLY_COVERED_MIN_DIRECT,
  FULLY_COVERED_MIN_COMPLETENESS,
  FAN_OUT_SEED_QUESTIONS,
  getActiveFanOutQuestions,
  getFanOutQuestionsByStatus,
  FAN_OUT_ACTIVE_CANONICAL_MIN,
  FAN_OUT_ACTIVE_CANONICAL_MAX,
  dedupeQuestionsByCanonicalText,
  validateQueryFamily,
  prioritizeFanOutOpportunities,
  selectFounderFacingFanOut,
  selectTopReportOpportunities,
  consolidateOpportunityClusters,
  computeFanOutPriorityScore,
  formatFanOutReport,
  formatFanOutAuditReport,
  buildFanOutExecutiveSummary,
  MAX_FOUNDER_FACING_FAN_OUT,
  QUERY_FAMILIES,
  AUDIENCE_STAGES,
  RECOMMENDED_ACTIONS,
  summarizeCanonicalInventory,
  canonicalSourceIdFromUrl,
  GAP_CLUSTER_DEFINITIONS,
  resolveGapClusterId,
  dedupeMatchesByCanonicalSource,
  matchLooksLikeDirectAnswer,
  buildFanOutUniverseStats,
  formatFanOutUniverseReport,
  classifyGscCandidate,
  normalizeGscQuery,
  clusterGscCandidates,
  collectFixtureGscCandidates,
  FIXTURE_GSC_CANDIDATE_QUERIES,
  isBrandGscQuery,
} from "./search/fan-out";
export type {
  FanOutCoverageSnapshot,
  FanOutCoverageStatus,
  FanOutCoverageErrorCategory,
  FanOutFailureStage,
  FanOutCoverageDegradation,
  FanOutCoverageInternalEvent,
  FanOutQuestion,
  FanOutContentRecord,
  FanOutOpportunity,
  FanOutExecutiveSummary,
  QuestionCoverage,
  QueryFamily,
  AudienceStage,
  CoverageBand,
  RecommendedContentAction,
  RunFanOutCoverageOptions,
  QuestionStatus,
  QuestionSource,
  FanOutUniverseStats,
} from "./search/fan-out";

export {
  runLocalAuthorityIntelligence,
  inspectLocalEntityInventory,
  observeGbpIntelligence,
  gbpReviewMetricsUnknown,
  detectLocalAuthorityFindings,
  buildLocalAuthorityFindingId,
  localAuthorityIdLooksSafe,
  LOCAL_AUTHORITY_FINDING_TYPES,
  LOCAL_GEOGRAPHIES,
  LOCAL_INTENT_KINDS,
  GBP_ROOT_SOURCE_GAP_ID,
  GBP_DIMENSION_KEYS,
  buildLocalSemanticDedupeKey,
  consolidateLegacyWithLocalAuthority,
  applyLocalAuthorityFounderRankingGate,
  isRepositoryBackedLocalAuthorityRec,
  countFounderRankableRepositoryLocal,
  recommendationIsFounderRankableLocal,
} from "./search/local";
export type {
  LocalAuthorityAudit,
  LocalAuthorityFinding,
  LocalAuthorityFindingType,
  LocalGeography,
  LocalIntentKind,
  LocalEvidenceClass,
  GbpIntelligenceSnapshot,
  LocalEntityInventory,
  LocalAuthorityVolumeFunnel,
} from "./search/local";

export { inspectContentInventory, CONTENT_PUBLICATION_INVENTORY_GAP_ID } from "./content/inventory";
export type {
  ContentMaterialState,
  ContentPublicationState,
  ContentInventoryCompleteness,
} from "./content/inventory";
export { detectContentOpportunities } from "./content/opportunities";
export { assessBrandFit } from "./content/brand-fit";

export {
  runContentRoiPrioritizer,
  runContentRoiGuarded,
  formatContentRoiReport,
  CONTENT_ROI_WEIGHTS,
  MAX_FOUNDER_FACING_CONTENT_ROI,
  RESERVED_CONVERSATION_CYCLES,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
  EDITORIAL_SEQUENCE_SOURCE_NOTE,
  contentRoiDataGap,
  emptyContentRoiSnapshot,
  assertWeightsSumToOne,
  type RunContentRoiOptions,
} from "./content/roi";
export type {
  ContentRoiSnapshot,
  ContentRoiEditorialPackage,
  ContentRoiQuestionAssessment,
  ContentRoiWeights,
  ContentRoiBacklogCandidate,
} from "./content/roi";

export { collectOpportunitySignals } from "./opportunity/signals";
export { detectGrowthOpportunities } from "./opportunity/opportunities";
export { inspectRepositoryStrategy } from "./opportunity/strategy";
export {
  qualifyOpportunity,
  opportunityIsSurfaceEligible,
  opportunityRankingAdjustments,
  actionabilityForReadiness,
  withConfidenceContract,
} from "./opportunity/qualify";

export {
  getSearchStrategyContract,
  getContentContract,
  getOpportunityContract,
  assertScaffoldCannotRecommend,
} from "./executives/scaffolds";

export {
  deterministicSynthesisProvider,
  createPassthroughLlmStub,
} from "./provider";

/** Live/fixture adapters — server-only; do not import from client bundles. */
export { loadAllSources, loadGa4, loadGsc, loadWeeklyIntelligence } from "./adapters/load";
