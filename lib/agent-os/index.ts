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
} from "./bi";
export type {
  ConversionMeasurementAudit,
  MeasurementFinding,
  OpportunityMeasurementHandoff,
  MeasurementDecisionEffect,
  MeasurementHealthType,
  ExpectedEventInventoryItem,
  MeasurementVolumeFunnel,
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

export { detectGscOpportunities } from "./search/opportunities";
export {
  inspectGuideAuthority,
  FAQ_SCHEMA_ARTICLE_SLUGS,
} from "./search/guide-authority";

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
