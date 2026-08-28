/**
 * Founder-browser sequential continuation around the one-page history runner.
 * The browser only asks for the next approved chunk. Checkpoint remains
 * the only resume cursor. One chunk in flight at a time.
 */

import type { GmailHistoryChunkResult } from "./history";

export const GMAIL_HISTORY_CONTINUE_DELAY_MS = 1000;

export type GmailHistoryContinuationStopReason =
  | "completed"
  | "failed"
  | "stopped"
  | "cancelled"
  | "already-in-flight";

export type GmailHistoryContinuationState = {
  result: GmailHistoryChunkResult;
  chunksThisSession: number;
  autoRunning: boolean;
  paused: boolean;
  stopReason: GmailHistoryContinuationStopReason | null;
};

export type GmailHistoryChunkRunner = () => Promise<GmailHistoryChunkResult>;

export type GmailHistoryContinuation = {
  start(
    onUpdate?: (state: GmailHistoryContinuationState) => void,
  ): Promise<GmailHistoryContinuationState>;
  runOnce(
    onUpdate?: (state: GmailHistoryContinuationState) => void,
  ): Promise<GmailHistoryContinuationState>;
  requestStopAfterCurrent(): void;
  cancel(): void;
  isActive(): boolean;
};

export function shouldRunNextGmailHistoryChunk(input: {
  result: GmailHistoryChunkResult;
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
  result: GmailHistoryChunkResult;
  chunksThisSession: number;
  autoRunning: boolean;
  paused: boolean;
  stopReason: GmailHistoryContinuationStopReason | null;
}): GmailHistoryContinuationState {
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

export function createGmailHistoryContinuation(input: {
  runChunk: GmailHistoryChunkRunner;
  initial: GmailHistoryChunkResult;
  delayMs?: number;
  sleep?: (ms: number, cancelled: () => boolean) => Promise<void>;
}): GmailHistoryContinuation {
  const delayMs = input.delayMs ?? GMAIL_HISTORY_CONTINUE_DELAY_MS;
  const sleep = input.sleep ?? defaultSleep;
  let active = false;
  let stopAfterCurrent = false;
  let cancelled = false;
  let chunksThisSession = 0;
  let last = input.initial;

  function emit(
    onUpdate: ((state: GmailHistoryContinuationState) => void) | undefined,
    state: GmailHistoryContinuationState,
  ): GmailHistoryContinuationState {
    onUpdate?.(state);
    return state;
  }

  async function runOneChunk(): Promise<GmailHistoryChunkResult> {
    return input.runChunk();
  }

  function stopReasonFor(
    result: GmailHistoryChunkResult,
    autoContinue: boolean,
  ): GmailHistoryContinuationStopReason | null {
    if (!result.chunkSucceeded || result.safeErrorCode) return "failed";
    if (result.completed || !result.morePagesRemain) return "completed";
    if (cancelled) return "cancelled";
    if (stopAfterCurrent) return "stopped";
    if (!autoContinue) return null;
    return null;
  }

  async function runLoop(
    autoContinue: boolean,
    onUpdate?: (state: GmailHistoryContinuationState) => void,
  ): Promise<GmailHistoryContinuationState> {
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
        const result = await runOneChunk();
        last = result;
        if (result.chunkSucceeded) chunksThisSession += 1;
        const more = shouldRunNextGmailHistoryChunk({
          result,
          autoContinue,
          stopAfterCurrent,
          cancelled,
        });
        const reason = more ? null : stopReasonFor(result, autoContinue);
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
          !shouldRunNextGmailHistoryChunk({
            result,
            autoContinue,
            stopAfterCurrent,
            cancelled,
          })
        ) {
          const afterDelay = stopReasonFor(result, autoContinue) ?? "stopped";
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
    start: (onUpdate) => runLoop(true, onUpdate),
    runOnce: (onUpdate) => runLoop(false, onUpdate),
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
