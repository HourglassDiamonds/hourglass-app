/**
 * Content ROI Prioritization — Content Executive capability.
 * Scores fan-out questions for editorial return; sequences after reserved cycles.
 */

import {
  runFanOutCoverageAnalyzer,
  getActiveFanOutQuestions,
  type RunFanOutCoverageOptions,
} from "../../search/fan-out";
import type { FanOutCoverageSnapshot } from "../../search/fan-out/types";
import {
  buildBacklogCandidates,
  buildEditorialPackages,
  buildPostSequenceOrder,
  classifySpecialBuckets,
  selectFounderFacingPackages,
  selectTopPackages,
} from "./packages";
import {
  EDITORIAL_SEQUENCE_SOURCE_NOTE,
  RESERVED_CONVERSATION_CYCLES,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
} from "./reserved-sequence";
import {
  runContentRoiStage,
} from "./resilience";
import { assessQuestionRoi } from "./score";
import type {
  ContentRoiFailureStage,
  ContentRoiSnapshot,
  ContentRoiWeights,
} from "./types";
import {
  assertWeightsSumToOne,
  CONTENT_ROI_WEIGHTS,
  MAX_FOUNDER_FACING_CONTENT_ROI,
} from "./weights";

export type RunContentRoiOptions = {
  /** Prefer passing Search Strategy fan-out snapshot when available */
  fanOutCoverage?: FanOutCoverageSnapshot | null;
  fanOutRunOptions?: RunFanOutCoverageOptions;
  weights?: ContentRoiWeights;
  founderFacingLimit?: number;
  forceFailureAt?: ContentRoiFailureStage;
  now?: () => string;
};

export function runContentRoiPrioritizer(
  options: RunContentRoiOptions = {},
): ContentRoiSnapshot {
  const force = options.forceFailureAt;
  const completedAt = options.now?.() ?? new Date().toISOString();
  const weights = options.weights ?? CONTENT_ROI_WEIGHTS;

  if (!assertWeightsSumToOne(weights)) {
    throw new Error("Content ROI weights must sum to 1.0");
  }

  const fanOut = runContentRoiStage("fan-out-input", force, () => {
    if (options.fanOutCoverage && options.fanOutCoverage.status === "ok") {
      return options.fanOutCoverage;
    }
    if (options.fanOutCoverage && options.fanOutCoverage.status === "failed") {
      throw new Error("Upstream fan-out coverage failed — cannot score ROI");
    }
    return runFanOutCoverageAnalyzer(options.fanOutRunOptions);
  });

  const assessments = runContentRoiStage("question-scoring", force, () => {
    const activeQuestions = getActiveFanOutQuestions(fanOut.questions);
    const oppByQ = new Map(
      fanOut.opportunities.map((o) => [o.questionId, o] as const),
    );
    const covByQ = new Map(fanOut.coverages.map((c) => [c.questionId, c]));
    return activeQuestions.map((q) =>
      assessQuestionRoi(q, covByQ.get(q.id), oppByQ.get(q.id), weights),
    );
  });

  const packages = runContentRoiStage("package-building", force, () =>
    buildEditorialPackages(assessments, fanOut.opportunities),
  );

  const fullSequenceOrder = runContentRoiStage("sequencing", force, () =>
    buildPostSequenceOrder(packages),
  );

  const buckets = classifySpecialBuckets(assessments, packages);
  const evidenceIds = new Set(buckets.evidenceNeeded.map((a) => a.questionId));
  const top10 = selectTopPackages(packages, 10);
  const top25 = selectTopPackages(packages, 25);
  const founderFacing = selectFounderFacingPackages(
    packages,
    options.founderFacingLimit ?? MAX_FOUNDER_FACING_CONTENT_ROI,
  );
  const backlogCandidates = buildBacklogCandidates(packages, evidenceIds);
  const postSequenceOrder = fullSequenceOrder.filter((s) => !s.reserved);

  const facts = [
    `Content ROI scored ${assessments.length} active canonical questions`,
    `Editorial packages: ${packages.length} (reserved cycles: ${RESERVED_CONVERSATION_CYCLES.length})`,
    `Founder-facing Content ROI packages: ${founderFacing.length} (cap ${options.founderFacingLimit ?? MAX_FOUNDER_FACING_CONTENT_ROI})`,
    `Post-sequence backlog starts after reserved Conversation cycles`,
    `Reserve-backlog Conversation topics preserved: ${RESERVE_BACKLOG_CONVERSATION_TOPICS.length}`,
  ];

  const inferences = [
    "ROI weights favor sales influence and brand differentiation over raw search demand",
    "A Matter of Taste is assigned only when taste potential clears the threshold",
    "Decision-anxiety questions consolidate into one Conversation package",
    EDITORIAL_SEQUENCE_SOURCE_NOTE,
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
        message: "Content ROI prioritization completed",
      },
    ],
    weights: { ...weights },
    questionAssessments: assessments,
    packages,
    top10Packages: top10,
    top25Topics: top25,
    reservedCycles: RESERVED_CONVERSATION_CYCLES,
    postSequenceOrder,
    fullSequenceOrder,
    faqOnly: buckets.faqOnly,
    salesSupportOnly: buckets.salesSupportOnly,
    lowRoiUncovered: buckets.lowRoiUncovered,
    evidenceNeeded: buckets.evidenceNeeded,
    backlogCandidates,
    founderFacingPackages: founderFacing,
    editorialSequenceNote: EDITORIAL_SEQUENCE_SOURCE_NOTE,
    reserveBacklogTopics: RESERVE_BACKLOG_CONVERSATION_TOPICS,
    facts,
    inferences,
  };
}

export {
  runContentRoiGuarded,
  buildFailedContentRoiSnapshot,
  emptyContentRoiSnapshot,
  contentRoiDataGap,
  ContentRoiStageError,
  sanitizeContentRoiSafeMessage,
} from "./resilience";

export {
  CONTENT_ROI_WEIGHTS,
  assertWeightsSumToOne,
  MAX_FOUNDER_FACING_CONTENT_ROI,
  MAX_BACKLOG_ELIGIBLE_PACKAGES,
  MIN_CONVERSATION_DEPTH,
  MIN_TASTE_ASSIGNMENT,
  LOW_ROI_UNCOVERED_THRESHOLD,
} from "./weights";

export {
  RESERVED_CONVERSATION_CYCLES,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
  EDITORIAL_SEQUENCE_SOURCE_NOTE,
  PLANNED_CONVERSATION_TOPICS,
  getCanonicalReservedSequenceTitles,
  getCanonicalReservedTasteTitles,
} from "./reserved-sequence";

export {
  assessQuestionRoi,
  scoreContentRoiDimensions,
  recommendFormatsForQuestion,
} from "./score";

export {
  buildEditorialPackages,
  buildPostSequenceOrder,
  selectFounderFacingPackages,
  selectTopPackages,
  assertFlagshipBeforeSupporting,
  conversationRequiresDepth,
} from "./packages";

export { formatContentRoiReport } from "./report";

export type * from "./types";
