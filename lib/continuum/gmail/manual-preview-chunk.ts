import type { GmailIncrementalChunkResult } from "./incremental";

export const BETA_RECOVERY_PREVIEW_BRANCH =
  "codex/continuum-beta-recovery" as const;

export type ManualPreviewChunkStatus =
  | "idle"
  | "blocked"
  | "recovering"
  | "progressed"
  | "completed"
  | "failed";

export type ManualPreviewChunkResult = {
  status: ManualPreviewChunkStatus;
  blockedReason: "unauthorized" | "not-beta-recovery-preview" | "unavailable" | null;
  checkpointStatus: GmailIncrementalChunkResult["checkpointStatus"] | null;
  indexedThisChunk: number;
  indexedCount: number;
  morePagesRemain: boolean;
  recovery: boolean;
  completed: boolean;
  historyIdPresent: boolean;
  safeErrorCode: string | null;
};

export const INITIAL_MANUAL_PREVIEW_CHUNK_RESULT: ManualPreviewChunkResult = {
  status: "idle",
  blockedReason: null,
  checkpointStatus: null,
  indexedThisChunk: 0,
  indexedCount: 0,
  morePagesRemain: false,
  recovery: false,
  completed: false,
  historyIdPresent: false,
  safeErrorCode: null,
};

export function manualPreviewSnapshotFromIncremental(
  chunk: GmailIncrementalChunkResult,
): ManualPreviewChunkResult {
  const recoveryInProgress =
    chunk.recovery &&
    chunk.checkpointStatus === "running" &&
    chunk.morePagesRemain &&
    (chunk.safeErrorCode === "history-too-old" ||
      chunk.safeErrorCode === "historical-incomplete");
  const completed =
    !chunk.safeErrorCode &&
    chunk.completed &&
    chunk.checkpointStatus === "completed" &&
    chunk.historyIdPresent;
  return {
    status: completed
      ? "completed"
      : recoveryInProgress
        ? "recovering"
        : chunk.checkpointStatus === "failed" || chunk.safeErrorCode
          ? "failed"
          : chunk.checkpointStatus === "running" && chunk.morePagesRemain
            ? "progressed"
            : "idle",
    blockedReason: null,
    checkpointStatus: chunk.checkpointStatus,
    indexedThisChunk: 0,
    indexedCount: chunk.indexedCount,
    morePagesRemain: chunk.morePagesRemain,
    recovery: chunk.recovery,
    completed,
    historyIdPresent: chunk.historyIdPresent,
    safeErrorCode: chunk.safeErrorCode,
  };
}

export function isBetaRecoveryPreviewRuntime(input: {
  vercel: string | undefined;
  vercelEnv: string | undefined;
  continuumEnv: string | undefined;
  gitBranch: string | undefined;
  isolationState: string;
}): boolean {
  return (
    input.vercel?.trim() === "1" &&
    input.vercelEnv?.trim().toLowerCase() === "preview" &&
    input.continuumEnv?.trim().toLowerCase() === "preview" &&
    input.gitBranch?.trim() === BETA_RECOVERY_PREVIEW_BRANCH &&
    input.isolationState === "preview-isolated"
  );
}

export function blockedManualPreviewChunk(
  reason: NonNullable<ManualPreviewChunkResult["blockedReason"]>,
): ManualPreviewChunkResult {
  return {
    ...INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
    status: "blocked",
    blockedReason: reason,
  };
}

function publicResult(chunk: GmailIncrementalChunkResult): ManualPreviewChunkResult {
  const recoveryInProgress =
    chunk.recovery &&
    chunk.indexedThisChunk > 0 &&
    chunk.checkpointStatus === "running" &&
    chunk.morePagesRemain &&
    (chunk.safeErrorCode === "history-too-old" ||
      chunk.safeErrorCode === "historical-incomplete");
  const completed =
    chunk.chunkSucceeded &&
    !chunk.safeErrorCode &&
    chunk.completed &&
    chunk.checkpointStatus === "completed" &&
    chunk.historyIdPresent;
  const progressed = chunk.chunkSucceeded && !chunk.safeErrorCode;
  return {
    status: completed
      ? "completed"
      : recoveryInProgress
        ? "recovering"
        : progressed
          ? "progressed"
          : "failed",
    blockedReason: null,
    checkpointStatus: chunk.checkpointStatus,
    indexedThisChunk: chunk.indexedThisChunk,
    indexedCount: chunk.indexedCount,
    morePagesRemain: chunk.morePagesRemain,
    recovery: chunk.recovery,
    completed,
    historyIdPresent: chunk.historyIdPresent,
    safeErrorCode: chunk.safeErrorCode,
  };
}

export async function executeOneManualPreviewChunk(input: {
  founderAuthenticated: boolean;
  betaRecoveryPreviewVerified: boolean;
  runChunk: () => Promise<GmailIncrementalChunkResult>;
}): Promise<ManualPreviewChunkResult> {
  if (!input.founderAuthenticated) {
    return blockedManualPreviewChunk("unauthorized");
  }
  if (!input.betaRecoveryPreviewVerified) {
    return blockedManualPreviewChunk("not-beta-recovery-preview");
  }
  try {
    return publicResult(await input.runChunk());
  } catch {
    return blockedManualPreviewChunk("unavailable");
  }
}
