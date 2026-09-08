/**
 * Founder-facing outcome of an existing #16B incremental refresh.
 * Does not start a second sync or expose history ids.
 */

import type { GmailIncrementalContinuationStopReason } from "./incremental-continue";
import type { GmailIncrementalChunkResult } from "./incremental";

export type GmailIntakeRefreshPhase =
  | "idle"
  | "refreshing"
  | "current"
  | "failed"
  | "already-in-progress"
  | "disabled";

export type GmailIntakeRefreshOutcome = {
  phase: GmailIntakeRefreshPhase;
  message: string | null;
  clearPending: boolean;
};

export function gmailIntakeRefreshButtonLabel(refreshing: boolean): string {
  return refreshing ? "Refreshing mail index…" : "Refresh mail index";
}

export function formatGmailIntakeRefreshProgress(chunksThisSession: number): string | null {
  if (!Number.isInteger(chunksThisSession) || chunksThisSession < 1) return null;
  return `Refreshing Gmail index… Processed ${chunksThisSession} incremental chunk${
    chunksThisSession === 1 ? "" : "s"
  }.`;
}

export function outcomeAfterGmailIntakeRefresh(input: {
  enabled: boolean;
  stopReason: GmailIncrementalContinuationStopReason | null;
  result: Pick<GmailIncrementalChunkResult, "safeErrorCode" | "completed">;
}): GmailIntakeRefreshOutcome {
  if (!input.enabled) {
    return {
      phase: "disabled",
      message: "Gmail index refresh is not activated.",
      clearPending: true,
    };
  }
  if (input.stopReason === "cancelled") {
    return { phase: "idle", message: null, clearPending: true };
  }
  if (input.stopReason === "already-in-flight") {
    return {
      phase: "already-in-progress",
      message: "Refresh already in progress",
      clearPending: false,
    };
  }
  const code = input.result.safeErrorCode;
  if (code === "sync-disabled") {
    return {
      phase: "disabled",
      message: "Gmail index refresh is not activated.",
      clearPending: true,
    };
  }
  if (code === "gmail-sync-already-running") {
    return {
      phase: "already-in-progress",
      message: "Refresh already in progress",
      clearPending: true,
    };
  }
  if (code) {
    return {
      phase: "failed",
      message: "Refresh failed — retry",
      clearPending: true,
    };
  }
  if (input.stopReason === "failed") {
    return {
      phase: "failed",
      message: "Refresh failed — retry",
      clearPending: true,
    };
  }
  return { phase: "current", message: null, clearPending: true };
}

export function gmailIntakeFreshnessHeadline(input: {
  current: boolean;
  updatedLabel: string | null;
}): string {
  if (input.current) {
    return input.updatedLabel
      ? `INDEX CURRENT · Last updated ${input.updatedLabel}`
      : "INDEX CURRENT";
  }
  return input.updatedLabel
    ? `Gmail index last updated: ${input.updatedLabel}`
    : "Gmail index has not completed a current-state sync.";
}
