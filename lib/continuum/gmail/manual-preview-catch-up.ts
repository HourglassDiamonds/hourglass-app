/**
 * Founder-browser orchestration for the isolated Preview recovery action.
 * Every invocation remains one lease-protected server chunk. The durable
 * checkpoint is the only cursor, and nothing starts without a founder click.
 */

import {
  blockedManualPreviewChunk,
  type ManualPreviewChunkResult,
} from "./manual-preview-chunk";

export const MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS = 25;
export const MANUAL_PREVIEW_CATCH_UP_DELAY_MS = 1000;

export type ManualPreviewCatchUpStopReason =
  | "completed"
  | "failed"
  | "blocked"
  | "safety-stop"
  | "stopped"
  | "cancelled"
  | "limit-reached"
  | "already-in-flight";

export type ManualPreviewCatchUpState = {
  result: ManualPreviewChunkResult;
  chunksCompleted: number;
  messagesIndexedThisSession: number;
  attemptsThisSession: number;
  autoRunning: boolean;
  paused: boolean;
  stopReason: ManualPreviewCatchUpStopReason | null;
};

export type ManualPreviewCatchUp = {
  start(
    onUpdate?: (state: ManualPreviewCatchUpState) => void,
  ): Promise<ManualPreviewCatchUpState>;
  requestStopAfterCurrent(): void;
  cancel(): void;
  isActive(): boolean;
};

function isPersistedProgress(result: ManualPreviewChunkResult): boolean {
  return (
    result.status === "recovering" ||
    result.status === "progressed" ||
    result.status === "completed"
  );
}

export function shouldContinueManualPreviewCatchUp(input: {
  result: ManualPreviewChunkResult;
  stopAfterCurrent: boolean;
  cancelled: boolean;
  attemptsThisSession: number;
  maxChunks: number;
}): boolean {
  if (input.cancelled || input.stopAfterCurrent) return false;
  if (input.attemptsThisSession >= input.maxChunks) return false;
  if (
    input.result.status !== "recovering" &&
    input.result.status !== "progressed"
  ) {
    return false;
  }
  if (input.result.completed) return false;
  return (
    input.result.checkpointStatus === "running" &&
    input.result.morePagesRemain
  );
}

async function defaultSleep(
  ms: number,
  interrupted: () => boolean,
): Promise<void> {
  if (ms <= 0) return;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (interrupted()) return;
    const wait = Math.min(50, Math.max(0, end - Date.now()));
    if (wait <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
}

export function createManualPreviewCatchUp(input: {
  runChunk: () => Promise<ManualPreviewChunkResult>;
  initial: ManualPreviewChunkResult;
  maxChunks?: number;
  delayMs?: number;
  sleep?: (ms: number, interrupted: () => boolean) => Promise<void>;
}): ManualPreviewCatchUp {
  const maxChunks = Math.min(
    MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS,
    Math.max(1, Math.trunc(input.maxChunks ?? MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS)),
  );
  const delayMs = input.delayMs ?? MANUAL_PREVIEW_CATCH_UP_DELAY_MS;
  const sleep = input.sleep ?? defaultSleep;
  let active = false;
  let stopAfterCurrent = false;
  let cancelled = false;
  let last = input.initial;
  let chunksCompleted = 0;
  let messagesIndexedThisSession = 0;
  let attemptsThisSession = 0;

  function snapshot(
    autoRunning: boolean,
    stopReason: ManualPreviewCatchUpStopReason | null,
  ): ManualPreviewCatchUpState {
    return {
      result: last,
      chunksCompleted,
      messagesIndexedThisSession,
      attemptsThisSession,
      autoRunning,
      paused:
        stopReason === "stopped" ||
        stopReason === "cancelled" ||
        stopReason === "limit-reached",
      stopReason,
    };
  }

  function reasonFor(result: ManualPreviewChunkResult): ManualPreviewCatchUpStopReason {
    if (result.status === "blocked") return "blocked";
    if (result.status === "failed") return "failed";
    if (result.status === "completed" && result.completed) return "completed";
    if (cancelled) return "cancelled";
    if (stopAfterCurrent) return "stopped";
    if (attemptsThisSession >= maxChunks) return "limit-reached";
    return "safety-stop";
  }

  async function start(
    onUpdate?: (state: ManualPreviewCatchUpState) => void,
  ): Promise<ManualPreviewCatchUpState> {
    if (active) return snapshot(true, "already-in-flight");

    active = true;
    stopAfterCurrent = false;
    cancelled = false;
    chunksCompleted = 0;
    messagesIndexedThisSession = 0;
    attemptsThisSession = 0;

    try {
      while (true) {
        if (cancelled) {
          const state = snapshot(false, "cancelled");
          onUpdate?.(state);
          return state;
        }

        attemptsThisSession += 1;
        try {
          last = await input.runChunk();
        } catch {
          last = blockedManualPreviewChunk("unavailable");
        }

        if (isPersistedProgress(last)) {
          chunksCompleted += 1;
          messagesIndexedThisSession += last.indexedThisChunk;
        }

        const continueRunning = shouldContinueManualPreviewCatchUp({
          result: last,
          stopAfterCurrent,
          cancelled,
          attemptsThisSession,
          maxChunks,
        });
        const reason = continueRunning ? null : reasonFor(last);
        const state = snapshot(continueRunning, reason);
        onUpdate?.(state);
        if (!continueRunning) return state;

        await sleep(delayMs, () => cancelled || stopAfterCurrent);
        if (
          !shouldContinueManualPreviewCatchUp({
            result: last,
            stopAfterCurrent,
            cancelled,
            attemptsThisSession,
            maxChunks,
          })
        ) {
          const stopped = snapshot(false, reasonFor(last));
          onUpdate?.(stopped);
          return stopped;
        }
      }
    } finally {
      active = false;
    }
  }

  return {
    start,
    requestStopAfterCurrent() {
      stopAfterCurrent = true;
    },
    cancel() {
      cancelled = true;
      stopAfterCurrent = true;
    },
    isActive() {
      return active;
    },
  };
}
