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
  REQUIRED_BRIEF_QUESTIONS,
  runChiefOfStaff,
} from "./executives/chief-of-staff";

export { runBusinessIntelligence } from "./executives/business-intelligence";

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
