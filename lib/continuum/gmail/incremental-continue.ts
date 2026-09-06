/**
 * Founder-browser sequential continuation around the one-page incremental runner.
 * The browser only asks for the next approved chunk. Checkpoint remains
 * the only resume cursor. One chunk in flight at a time.
 * Does not start on construction. The server checkpoint remains the only resume cursor.
 */

import type { GmailIncrementalChunkResult } from "./incremental";

export const GMAIL_INCREMENTAL_CONTINUE_DELAY_MS = 1000;

export type GmailIncrementalContinuationStopReason =
  | "completed"
  | "failed"
  | "stopped"
  | "cancelled"
  | "already-in-flight";

export type GmailIncrementalContinuationState = {
  result: GmailIncrementalChunkResult;
  chunksThisSession: number;
  autoRunning: boolean;
  paused: boolean;
  stopReason: GmailIncrementalContinuationStopReason | null;
};

export type GmailIncrementalChunkRunner = () => Promise<GmailIncrementalChunkResult>;

export type GmailIncrementalContinuation = {
  start(
    onUpdate?: (state: GmailIncrementalContinuationState) => void,
  ): Promise<GmailIncrementalContinuationState>;
  requestStopAfterCurrent(): void;
  cancel(): void;
  isActive(): boolean;
};

export function shouldOfferGmailIncrementalResume(
  result: GmailIncrementalChunkResult,
): boolean {
  if (result.completed && !result.morePagesRemain) return false;
  return (
    result.morePagesRemain ||
    result.checkpointStatus === "running" ||
    result.recovery
  );
}

export function shouldRunNextGmailIncrementalChunk(input: {
  result: GmailIncrementalChunkResult;
  autoContinue: boolean;
  stopAfterCurrent: boolean;
  cancelled: boolean;
}): boolean {
  if (!input.autoContinue) return false;
  if (input.cancelled) return false;
  if (input.stopAfterCurrent) return false;
  if (!input.result.chunkSucceeded) return false;
  if (input.result.safeErrorCode) return false;
  if (input.result.completed) return false;
  return input.result.morePagesRemain;
}

function snapshot(input: {
  result: GmailIncrementalChunkResult;
  chunksThisSession: number;
  autoRunning: boolean;
  paused: boolean;
  stopReason: GmailIncrementalContinuationStopReason | null;
}): GmailIncrementalContinuationState {
  return {
    result: input.result,
    chunksThisSession: input.chunksThisSession,
    autoRunning: input.autoRunning,
    paused: input.paused,
    stopReason: input.stopReason,
  };
}

async function defaultSleep(ms: number, cancelled: () => boolean): Promise<void> {
  if (ms <= 0) return;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cancelled()) return;
    const wait = Math.min(50, Math.max(0, end - Date.now()));
    if (wait <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
}

export function createGmailIncrementalContinuation(input: {
  runChunk: GmailIncrementalChunkRunner;
  initial: GmailIncrementalChunkResult;
  delayMs?: number;
  sleep?: (ms: number, cancelled: () => boolean) => Promise<void>;
}): GmailIncrementalContinuation {
  const delayMs = input.delayMs ?? GMAIL_INCREMENTAL_CONTINUE_DELAY_MS;
  const sleep = input.sleep ?? defaultSleep;
  let active = false;
  let stopAfterCurrent = false;
  let cancelled = false;
  let chunksThisSession = 0;
  let last = input.initial;

  function emit(
    onUpdate: ((state: GmailIncrementalContinuationState) => void) | undefined,
    state: GmailIncrementalContinuationState,
  ): GmailIncrementalContinuationState {
    onUpdate?.(state);
    return state;
  }

  function stopReasonFor(
    result: GmailIncrementalChunkResult,
  ): GmailIncrementalContinuationStopReason | null {
    if (!result.chunkSucceeded || result.safeErrorCode) return "failed";
    if (result.completed || !result.morePagesRemain) return "completed";
    if (cancelled) return "cancelled";
    if (stopAfterCurrent) return "stopped";
    return null;
  }

  async function runLoop(
    onUpdate?: (state: GmailIncrementalContinuationState) => void,
  ): Promise<GmailIncrementalContinuationState> {
    if (active) {
      return snapshot({
        result: last,
        chunksThisSession,
        autoRunning: true,
        paused: false,
        stopReason: "already-in-flight",
      });
    }
    active = true;
    stopAfterCurrent = false;
    cancelled = false;
    try {
      while (true) {
        if (cancelled) {
          return emit(
            onUpdate,
            snapshot({
              result: last,
              chunksThisSession,
              autoRunning: false,
              paused: last.morePagesRemain && !last.completed,
              stopReason: "cancelled",
            }),
          );
        }
        const result = await input.runChunk();
        last = result;
        if (result.chunkSucceeded) chunksThisSession += 1;
        const more = shouldRunNextGmailIncrementalChunk({
          result,
          autoContinue: true,
          stopAfterCurrent,
          cancelled,
        });
        const reason = more ? null : stopReasonFor(result);
        emit(
          onUpdate,
          snapshot({
            result,
            chunksThisSession,
            autoRunning: more,
            paused: reason === "stopped" || reason === "cancelled",
            stopReason: reason,
          }),
        );
        if (!more) {
          return snapshot({
            result,
            chunksThisSession,
            autoRunning: false,
            paused: reason === "stopped" || reason === "cancelled",
            stopReason: reason,
          });
        }
        await sleep(delayMs, () => cancelled || stopAfterCurrent);
        if (
          !shouldRunNextGmailIncrementalChunk({
            result,
            autoContinue: true,
            stopAfterCurrent,
            cancelled,
          })
        ) {
          const afterDelay = stopReasonFor(result) ?? "stopped";
          return emit(
            onUpdate,
            snapshot({
              result,
              chunksThisSession,
              autoRunning: false,
              paused: afterDelay === "stopped" || afterDelay === "cancelled",
              stopReason: afterDelay,
            }),
          );
        }
      }
    } finally {
      active = false;
    }
  }

  return {
    start: (onUpdate) => runLoop(onUpdate),
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
