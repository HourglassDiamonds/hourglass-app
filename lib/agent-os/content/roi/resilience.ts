/**
 * Content ROI resilience — enhancement path; must not abort Content Executive.
 */

import { redactError, redactSecretsAndPii } from "../../redaction";
import type {
  ContentRoiDegradation,
  ContentRoiErrorCategory,
  ContentRoiFailureStage,
  ContentRoiInternalEvent,
  ContentRoiSnapshot,
  ContentRoiStatus,
} from "./types";
import { CONTENT_ROI_WEIGHTS } from "./weights";

const SAFE_MESSAGE_MAX = 200;
const PATH_FRAGMENT_RE =
  /(?:[A-Za-z]:\\|\/(?:Users|home|var|tmp|app|Dev)\/|\\\\|node_modules[\\/])/i;

export class ContentRoiStageError extends Error {
  readonly stage: ContentRoiFailureStage;
  readonly category: ContentRoiErrorCategory;

  constructor(
    stage: ContentRoiFailureStage,
    category: ContentRoiErrorCategory,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(sanitizeContentRoiSafeMessage(message));
    this.name = "ContentRoiStageError";
    this.stage = stage;
    this.category = category;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

const STAGE_CATEGORY: Record<
  Exclude<ContentRoiFailureStage, "unknown">,
  ContentRoiErrorCategory
> = {
  "fan-out-input": "fan-out-input",
  "question-scoring": "question-scoring",
  "cluster-consolidation": "cluster-consolidation",
  "package-building": "package-building",
  sequencing: "sequencing",
};

export function categoryForContentRoiStage(
  stage: ContentRoiFailureStage,
): ContentRoiErrorCategory {
  if (stage === "unknown") return "unexpected";
  return STAGE_CATEGORY[stage];
}

export function sanitizeContentRoiSafeMessage(raw: string): string {
  let cleaned = redactSecretsAndPii(String(raw ?? ""))
    .replace(/\r?\n+/g, " ")
    .trim();
  const atFrame = cleaned.search(/\s+at\s+\S+/);
  if (atFrame >= 0) cleaned = cleaned.slice(0, atFrame);
  cleaned = cleaned
    .replace(/[A-Za-z]:\\[^\s]*/g, "[path]")
    .replace(/\\\\[^\s]*/g, "[path]")
    .replace(/\/(?:Users|home|var|tmp|app|Dev)\/[^\s]*/gi, "[path]")
    .replace(/\b(?:TypeError|ReferenceError|SyntaxError|Error):\s*/gi, "")
    .replace(PATH_FRAGMENT_RE, "[path] ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) cleaned = "content ROI analysis failed";
  if (cleaned.length <= SAFE_MESSAGE_MAX) return cleaned;
  return `${cleaned.slice(0, SAFE_MESSAGE_MAX - 1)}…`;
}

export function classifyContentRoiFailure(err: unknown): {
  stage: ContentRoiFailureStage;
  category: ContentRoiErrorCategory;
  safeMessage: string;
} {
  if (err instanceof ContentRoiStageError) {
    return {
      stage: err.stage,
      category: err.category,
      safeMessage: sanitizeContentRoiSafeMessage(err.message),
    };
  }
  return {
    stage: "unknown",
    category: "unexpected",
    safeMessage: sanitizeContentRoiSafeMessage(
      redactError(err, SAFE_MESSAGE_MAX),
    ),
  };
}

export function emptyContentRoiSnapshot(
  status: ContentRoiStatus = "unavailable",
  completedAt: string | null = null,
): ContentRoiSnapshot {
  return {
    status,
    completedAt,
    degradation: null,
    internalEvents: [],
    weights: { ...CONTENT_ROI_WEIGHTS },
    questionAssessments: [],
    packages: [],
    top10Packages: [],
    top25Topics: [],
    reservedCycles: [],
    postSequenceOrder: [],
    fullSequenceOrder: [],
    faqOnly: [],
    salesSupportOnly: [],
    lowRoiUncovered: [],
    evidenceNeeded: [],
    backlogCandidates: [],
    founderFacingPackages: [],
    editorialSequenceNote: "",
    reserveBacklogTopics: [],
    facts: [],
    inferences: [],
  };
}

export function buildFailedContentRoiSnapshot(
  err: unknown,
  completedAt: string | null = null,
): ContentRoiSnapshot {
  const at = completedAt ?? new Date().toISOString();
  const classified = classifyContentRoiFailure(err);
  const degradation: ContentRoiDegradation = {
    errorCategory: classified.category,
    failedStage: classified.stage,
    safeMessage: classified.safeMessage,
    recommendationsSuppressed: true,
  };
  const event: ContentRoiInternalEvent = {
    at,
    level: "error",
    category: classified.category,
    stage: classified.stage,
    message: classified.safeMessage,
  };
  return {
    ...emptyContentRoiSnapshot("failed", at),
    degradation,
    internalEvents: [event],
    facts: [
      "Content ROI prioritization failed — editorial ranking suppressed for this run",
    ],
    inferences: [
      "Existing Content detectors remain available; ROI reordering was not applied",
    ],
  };
}

export function runContentRoiStage<T>(
  stage: ContentRoiFailureStage,
  forceFailureAt: ContentRoiFailureStage | undefined,
  fn: () => T,
): T {
  if (forceFailureAt && forceFailureAt === stage) {
    throw new ContentRoiStageError(
      stage,
      categoryForContentRoiStage(stage),
      `Forced Content ROI failure at ${stage}`,
    );
  }
  try {
    return fn();
  } catch (err) {
    if (err instanceof ContentRoiStageError) throw err;
    throw new ContentRoiStageError(
      stage,
      categoryForContentRoiStage(stage),
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  }
}

export function runContentRoiGuarded(
  runner: () => ContentRoiSnapshot,
): ContentRoiSnapshot {
  try {
    return runner();
  } catch (err) {
    return buildFailedContentRoiSnapshot(err);
  }
}

export function contentRoiDataGap(snapshot: ContentRoiSnapshot): {
  id: string;
  sourceId: string;
  description: string;
  impactOnRecommendations: string;
  suggestedRemedy: string;
} {
  return {
    id: "gap-content-roi-prioritization",
    sourceId: "repository-content-inventory",
    description:
      snapshot.degradation?.safeMessage ??
      "Content ROI prioritization unavailable",
    impactOnRecommendations:
      "Editorial ROI ranking and post-sequence backlog were suppressed; existing Content opportunities may still appear without ROI reordering",
    suggestedRemedy:
      "Inspect Content ROI internal events in the executive JSON; rerun after fixing the failing stage",
  };
}
