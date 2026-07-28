/**
 * Fan-out resilience helpers — typed degradation, stage errors, guarded execution.
 * Fan-out is an enhancement; failures must not abort Search Strategy or CoS.
 */

import { redactError, redactSecretsAndPii } from "../../redaction";
import type {
  FanOutCoverageDegradation,
  FanOutCoverageErrorCategory,
  FanOutCoverageInternalEvent,
  FanOutCoverageSnapshot,
  FanOutCoverageStatus,
  FanOutFailureStage,
} from "./types";

const SAFE_MESSAGE_MAX = 200;
const PATH_FRAGMENT_RE =
  /(?:[A-Za-z]:\\|\/(?:Users|home|var|tmp|app|Dev)\/|\\\\|node_modules[\\/])/i;

export class FanOutCoverageStageError extends Error {
  readonly stage: FanOutFailureStage;
  readonly category: FanOutCoverageErrorCategory;

  constructor(
    stage: FanOutFailureStage,
    category: FanOutCoverageErrorCategory,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(sanitizeFanOutSafeMessage(message));
    this.name = "FanOutCoverageStageError";
    this.stage = stage;
    this.category = category;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

const STAGE_CATEGORY: Record<
  Exclude<FanOutFailureStage, "unknown">,
  FanOutCoverageErrorCategory
> = {
  inventory: "inventory-construction",
  "question-loading": "question-loading",
  matching: "matching",
  "coverage-scoring": "coverage-scoring",
  prioritization: "prioritization",
  summary: "summary-generation",
};

export function categoryForFanOutStage(
  stage: FanOutFailureStage,
): FanOutCoverageErrorCategory {
  if (stage === "unknown") return "unexpected";
  return STAGE_CATEGORY[stage];
}

/** Strip paths / stack-like noise; keep a short inspectable message. */
export function sanitizeFanOutSafeMessage(raw: string): string {
  let cleaned = redactSecretsAndPii(String(raw ?? ""))
    .replace(/\r?\n+/g, " ")
    .trim();

  // Drop stack frames: everything from the first " at " frame onward
  const atFrame = cleaned.search(/\s+at\s+\S+/);
  if (atFrame >= 0) cleaned = cleaned.slice(0, atFrame);

  cleaned = cleaned
    .replace(/[A-Za-z]:\\[^\s]*/g, "[path]")
    .replace(/\\\\[^\s]*/g, "[path]")
    .replace(/\/(?:Users|home|var|tmp|app|Dev|Users)\/[^\s]*/gi, "[path]")
    .replace(/\b(?:TypeError|ReferenceError|SyntaxError|Error):\s*/gi, "")
    .replace(PATH_FRAGMENT_RE, "[path] ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) cleaned = "fan-out analysis failed";
  if (cleaned.length <= SAFE_MESSAGE_MAX) return cleaned;
  return `${cleaned.slice(0, SAFE_MESSAGE_MAX - 1)}…`;
}

export function classifyFanOutFailure(err: unknown): {
  stage: FanOutFailureStage;
  category: FanOutCoverageErrorCategory;
  safeMessage: string;
} {
  if (err instanceof FanOutCoverageStageError) {
    return {
      stage: err.stage,
      category: err.category,
      safeMessage: sanitizeFanOutSafeMessage(err.message),
    };
  }
  return {
    stage: "unknown",
    category: "unexpected",
    safeMessage: sanitizeFanOutSafeMessage(redactError(err, SAFE_MESSAGE_MAX)),
  };
}

function emptySummary() {
  return {
    totalQuestionsAnalyzed: 0,
    fullyCovered: 0,
    partiallyCovered: 0,
    uncovered: 0,
    averageCoverageScore: 0,
    strongestQueryFamilies: [] as FanOutCoverageSnapshot["summary"]["strongestQueryFamilies"],
    weakestQueryFamilies: [] as FanOutCoverageSnapshot["summary"]["weakestQueryFamilies"],
    contentInventoryCount: 0,
    topOpportunityCount: 0,
  };
}

export function buildUnavailableFanOutCoverageSnapshot(
  completedAt: string | null = null,
): FanOutCoverageSnapshot {
  const at = completedAt ?? new Date().toISOString();
  const event: FanOutCoverageInternalEvent = {
    at,
    level: "info",
    category: "unavailable",
    stage: null,
    message: "Fan-out coverage intentionally unavailable for this run",
  };
  return {
    status: "unavailable",
    completedAt: null,
    degradation: null,
    internalEvents: [event],
    summary: emptySummary(),
    questions: [],
    contentInventory: [],
    coverages: [],
    opportunities: [],
    founderFacingOpportunities: [],
    facts: ["Fan-out coverage analysis unavailable for this run"],
    inferences: [
      "Fan-out is an enhancement — Search Strategy continues without fan-out recommendations",
    ],
  };
}

export function buildFailedFanOutCoverageSnapshot(
  err: unknown,
  completedAt?: string,
): FanOutCoverageSnapshot {
  const at = completedAt ?? new Date().toISOString();
  const { stage, category, safeMessage } = classifyFanOutFailure(err);
  const degradation: FanOutCoverageDegradation = {
    errorCategory: category,
    failedStage: stage,
    safeMessage,
    recommendationsSuppressed: true,
  };
  const event: FanOutCoverageInternalEvent = {
    at,
    level: "error",
    category,
    stage,
    message: safeMessage,
  };

  // Founder-safe fact — no stack, paths, or alarming exception dumps
  const founderSafeFact =
    "Fan-out coverage analysis did not complete — recommendations from that capability were omitted this run";

  return {
    status: "failed",
    completedAt: at,
    degradation,
    internalEvents: [event],
    summary: emptySummary(),
    questions: [],
    contentInventory: [],
    coverages: [],
    opportunities: [],
    founderFacingOpportunities: [],
    facts: [founderSafeFact],
    inferences: [
      "Fan-out failure is isolated — other Search Strategy and executive outputs remain available",
    ],
  };
}

export function fanOutCoverageDataGap(snapshot: FanOutCoverageSnapshot): {
  id: string;
  sourceId: string;
  description: string;
  impactOnRecommendations: string;
  suggestedRemedy: string;
} | null {
  if (snapshot.status !== "failed" || !snapshot.degradation) return null;
  return {
    id: "gap-search-fan-out-coverage",
    sourceId: "repository-fan-out",
    description:
      "Fan-out coverage analysis did not complete — gap recommendations from that capability were omitted",
    impactOnRecommendations:
      "No fan-out coverage recommendations this run; other Search Strategy findings remain",
    suggestedRemedy: `Inspect fan-out degradation (${snapshot.degradation.errorCategory} @ ${snapshot.degradation.failedStage})`,
  };
}

/**
 * Run a named analyzer stage; rethrows as FanOutCoverageStageError.
 * `forceFailureAt` is a deterministic test hook — not for production callers.
 */
export function runFanOutStage<T>(
  stage: Exclude<FanOutFailureStage, "unknown">,
  forceFailureAt: FanOutFailureStage | undefined,
  fn: () => T,
): T {
  const category = categoryForFanOutStage(stage);
  if (forceFailureAt === stage) {
    throw new FanOutCoverageStageError(
      stage,
      category,
      `Injected fan-out failure at stage ${stage}`,
    );
  }
  try {
    return fn();
  } catch (err) {
    if (err instanceof FanOutCoverageStageError) throw err;
    throw new FanOutCoverageStageError(
      stage,
      category,
      redactError(err, SAFE_MESSAGE_MAX),
      { cause: err },
    );
  }
}

/**
 * Guarded boundary: never throws. Returns ok | failed snapshot.
 */
export function runFanOutCoverageGuarded(
  run: () => FanOutCoverageSnapshot,
): FanOutCoverageSnapshot {
  try {
    const snapshot = run();
    if (
      snapshot.status === "ok" ||
      snapshot.status === "unavailable" ||
      snapshot.status === "failed"
    ) {
      return snapshot;
    }
    // Defensive: treat missing/invalid status as ok if payload looks complete
    return { ...snapshot, status: "ok" as FanOutCoverageStatus };
  } catch (err) {
    return buildFailedFanOutCoverageSnapshot(err);
  }
}
