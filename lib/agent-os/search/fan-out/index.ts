/**
 * AI Fan-Out Coverage Analyzer — Search Strategy capability.
 *
 * Inventories Hourglass-owned content, scores coverage against a curated
 * question universe, and emits prioritized gap opportunities.
 * Deterministic V1 — no paid external AI dependency.
 */

import { buildFanOutContentInventory, summarizeInventory } from "./inventory";
import {
  matchQuestionToContent,
  scoreContentMatch,
  dedupeMatchesByCanonicalSource,
  matchLooksLikeDirectAnswer,
} from "./match";
import {
  coverageBandFromScore,
  scoreQuestionCoverage,
  resolveCoverageBand,
  FULLY_COVERED_MIN_DIRECT,
  FULLY_COVERED_MIN_COMPLETENESS,
} from "./coverage";
import {
  dedupeQuestionsByCanonicalText,
  FAN_OUT_SEED_QUESTIONS,
  getActiveFanOutQuestions,
  validateQueryFamily,
} from "./seed-questions";
import {
  buildFanOutOpportunity,
  computeFanOutPriorityScore,
  MAX_FOUNDER_FACING_FAN_OUT,
  prioritizeFanOutOpportunities,
  selectFounderFacingFanOut,
  selectTopReportOpportunities,
  consolidateOpportunityClusters,
} from "./prioritize";
import {
  buildFamilyStats,
  buildFanOutExecutiveSummary,
  formatFanOutReport,
} from "./summary";
import { summarizeCanonicalInventory, canonicalSourceIdFromUrl } from "./canonical";
import { GAP_CLUSTER_DEFINITIONS, resolveGapClusterId } from "./clusters";
import { formatFanOutAuditReport } from "./audit";
import {
  buildFailedFanOutCoverageSnapshot,
  buildUnavailableFanOutCoverageSnapshot,
  FanOutCoverageStageError,
  runFanOutCoverageGuarded,
  runFanOutStage,
  sanitizeFanOutSafeMessage,
  classifyFanOutFailure,
  fanOutCoverageDataGap,
  categoryForFanOutStage,
} from "./resilience";
import {
  buildFanOutUniverseStats,
  formatFanOutUniverseReport,
} from "./universe-stats";
import {
  classifyGscCandidate,
  normalizeGscQuery,
  clusterGscCandidates,
  collectFixtureGscCandidates,
  FIXTURE_GSC_CANDIDATE_QUERIES,
  isBrandGscQuery,
} from "./gsc-candidates";
import {
  AUDIENCE_STAGES,
  QUERY_FAMILIES,
  RECOMMENDED_ACTIONS,
  type FanOutContentRecord,
  type FanOutCoverageSnapshot,
  type FanOutFailureStage,
  type FanOutQuestion,
} from "./types";
import {
  FAN_OUT_ACTIVE_CANONICAL_MAX,
  FAN_OUT_ACTIVE_CANONICAL_MIN,
  getFanOutQuestionsByStatus,
} from "./seed-questions";

export type RunFanOutCoverageOptions = {
  questions?: FanOutQuestion[];
  inventory?: FanOutContentRecord[];
  /** Max founder-facing opportunities forwarded into Search Strategy recs */
  founderFacingLimit?: number;
  /** Deterministic test hook — throws at the named stage */
  forceFailureAt?: FanOutFailureStage;
  /** Injectable clock for completedAt */
  now?: () => string;
};

/**
 * Run the full fan-out coverage analysis against repository content.
 * May throw FanOutCoverageStageError — callers that must not abort should use
 * `runFanOutCoverageGuarded(() => runFanOutCoverageAnalyzer(...))`.
 */
export function runFanOutCoverageAnalyzer(
  options: RunFanOutCoverageOptions = {},
): FanOutCoverageSnapshot {
  const force = options.forceFailureAt;
  const completedAt = options.now?.() ?? new Date().toISOString();

  const allQuestions = runFanOutStage("question-loading", force, () =>
    dedupeQuestionsByCanonicalText(options.questions ?? FAN_OUT_SEED_QUESTIONS),
  );
  const questions = getActiveFanOutQuestions(allQuestions);

  const inventory = runFanOutStage("inventory", force, () =>
    options.inventory ?? buildFanOutContentInventory(),
  );

  const matchBundles = runFanOutStage("matching", force, () =>
    questions.map((question) => ({
      question,
      matches: matchQuestionToContent(question, inventory),
    })),
  );

  const coverages = runFanOutStage("coverage-scoring", force, () =>
    matchBundles.map(({ question, matches }) =>
      scoreQuestionCoverage(question, matches, inventory),
    ),
  );

  const { opportunities, founderFacingOpportunities } = runFanOutStage(
    "prioritization",
    force,
    () => {
      const opps = prioritizeFanOutOpportunities(questions, coverages, inventory);
      return {
        opportunities: opps,
        founderFacingOpportunities: selectFounderFacingFanOut(
          opps,
          options.founderFacingLimit ?? MAX_FOUNDER_FACING_FAN_OUT,
        ),
      };
    },
  );

  const summary = runFanOutStage("summary", force, () =>
    buildFanOutExecutiveSummary({
      questions,
      coverages,
      contentInventoryCount: inventory.length,
      opportunities,
    }),
  );

  const canonical = summarizeCanonicalInventory(inventory);
  const facts = [
    `Fan-out question universe: ${questions.length} active questions`,
    `Content inventory: ${inventory.length} normalized records → ${canonical.uniqueCanonicalAssets} unique canonical sources (${canonical.derivativeRecordCount} derivatives)`,
    `Coverage: ${summary.fullyCovered} full / ${summary.partiallyCovered} partial / ${summary.uncovered} uncovered (avg ${summary.averageCoverageScore})`,
    `Strongest family: ${summary.strongestQueryFamilies[0]?.family ?? "n/a"} (${summary.strongestQueryFamilies[0]?.averageScore ?? "n/a"})`,
    `Weakest family: ${summary.weakestQueryFamilies[0]?.family ?? "n/a"} (${summary.weakestQueryFamilies[0]?.averageScore ?? "n/a"})`,
    `Founder-facing fan-out priorities: ${founderFacingOpportunities.length} (cap ${options.founderFacingLimit ?? MAX_FOUNDER_FACING_FAN_OUT})`,
  ];

  const inferences = [
    "Fan-out coverage scores are repository authority signals — not confirmed AI-assistant citations or rankings",
    "Matching is deterministic (metadata, tags, terms) — not semantic model ranking",
    "Fully-covered requires direct-answer and completeness gates — secondary signals cannot compensate alone",
    "FAQ/approach/transcript fragments share canonicalSourceId with their parent page to prevent double-counting",
    "GBP posts, live reviews, and short-form clip ledgers are not in inventory until adapters exist",
  ];

  return {
    status: "ok",
    completedAt,
    degradation: null,
    internalEvents: [
      {
        at: completedAt,
        level: "info",
        category: "ok",
        stage: null,
        message: `Fan-out coverage completed (${questions.length} questions, ${inventory.length} inventory records)`,
      },
    ],
    summary,
    questions: allQuestions,
    contentInventory: inventory,
    coverages,
    opportunities,
    founderFacingOpportunities,
    facts,
    inferences,
  };
}

/** Intentionally unavailable snapshot (e.g. empty Search Strategy / skip synthesis). */
export function emptyFanOutCoverageSnapshot(): FanOutCoverageSnapshot {
  return buildUnavailableFanOutCoverageSnapshot();
}

export type * from "./types";
export type { FanOutUniverseStats, CountRow } from "./universe-stats";
export type { NormalizedGscCandidate, GscCandidateKind } from "./gsc-candidates";
export type { SeedDraft } from "./seed-builder";

export {
  AUDIENCE_STAGES,
  QUERY_FAMILIES,
  RECOMMENDED_ACTIONS,
  buildFanOutContentInventory,
  summarizeInventory,
  matchQuestionToContent,
  scoreContentMatch,
  dedupeMatchesByCanonicalSource,
  matchLooksLikeDirectAnswer,
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
  buildFanOutOpportunity,
  MAX_FOUNDER_FACING_FAN_OUT,
  buildFanOutExecutiveSummary,
  buildFamilyStats,
  formatFanOutReport,
  summarizeCanonicalInventory,
  canonicalSourceIdFromUrl,
  GAP_CLUSTER_DEFINITIONS,
  resolveGapClusterId,
  formatFanOutAuditReport,
  buildFailedFanOutCoverageSnapshot,
  buildUnavailableFanOutCoverageSnapshot,
  FanOutCoverageStageError,
  runFanOutCoverageGuarded,
  runFanOutStage,
  sanitizeFanOutSafeMessage,
  classifyFanOutFailure,
  fanOutCoverageDataGap,
  categoryForFanOutStage,
  buildFanOutUniverseStats,
  formatFanOutUniverseReport,
  classifyGscCandidate,
  normalizeGscQuery,
  clusterGscCandidates,
  collectFixtureGscCandidates,
  FIXTURE_GSC_CANDIDATE_QUERIES,
  isBrandGscQuery,
};
