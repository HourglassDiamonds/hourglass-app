"use client";

import { useState } from "react";
import { runNextGmailIncrementalChunk } from "../gmail-incremental-actions";
import type { GmailIncrementalChunkResult } from "@/lib/continuum/gmail/incremental";

const buttonClass =
  "mt-6 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]";

export type GmailIncrementalPublicState = {
  latestInboundAt: string | null;
  latestOutboundAt: string | null;
  lastSuccessfulSyncAt: string | null;
  hasNewerIndexedActivity: boolean;
  activationEnabled: boolean;
};

function statusLabel(result: GmailIncrementalChunkResult): string {
  if (result.safeErrorCode === "sync-disabled") return "Not activated";
  if (result.safeErrorCode === "historical-incomplete") {
    return "Waiting on historical backfill";
  }
  if (result.recovery) return "Recovering";
  if (result.completed && result.historyIdPresent) return "Current";
  if (result.checkpointStatus === "failed" || result.safeErrorCode) return "Failed";
  if (result.checkpointStatus === "running" || result.morePagesRemain) {
    return "In progress";
  }
  if (result.checkpointStatus === "idle" && !result.historyIdPresent) {
    return "Not started";
  }
  return "In progress";
}

function runLabel(result: GmailIncrementalChunkResult, enabled: boolean): string {
  if (!enabled || result.safeErrorCode === "sync-disabled") {
    return "Activation required";
  }
  if (result.morePagesRemain) return "Continue current-state sync";
  if (result.historyIdPresent) return "Sync current mailbox";
  return "Initialize current-state sync";
}

export function GmailIncrementalForm({
  initial,
  publicState,
}: {
  initial: GmailIncrementalChunkResult;
  publicState: GmailIncrementalPublicState;
}) {
  const [result, setResult] = useState(initial);
  const [lock, setLock] = useState(false);

  async function runChunk() {
    if (lock) return;
    setLock(true);
    try {
      setResult(await runNextGmailIncrementalChunk());
    } finally {
      setLock(false);
    }
  }

  return (
    <div className="mt-10">
      <h2 className="font-serif text-[1.25rem] font-normal tracking-[-0.03em] text-[#efe8de]">
        Current mailbox
      </h2>
      <dl className="mt-6 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
        <div className="flex justify-between gap-4">
          <dt>Status</dt>
          <dd>{statusLabel(result)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Cursor</dt>
          <dd>{result.historyIdPresent ? "Set" : "Not set"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Indexed this job</dt>
          <dd>{result.indexedCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Latest inbound</dt>
          <dd>{publicState.latestInboundAt ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Latest outbound</dt>
          <dd>{publicState.latestOutboundAt ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Last successful sync</dt>
          <dd>{publicState.lastSuccessfulSyncAt ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Newer since previous</dt>
          <dd>{publicState.hasNewerIndexedActivity ? "Yes" : "No"}</dd>
        </div>
        {result.safeErrorCode ? (
          <div className="flex justify-between gap-4">
            <dt>Code</dt>
            <dd>{result.safeErrorCode}</dd>
          </div>
        ) : null}
      </dl>
      <button
        type="button"
        disabled={lock || !publicState.activationEnabled}
        onClick={runChunk}
        className={buttonClass}
      >
        {runLabel(result, publicState.activationEnabled)}
      </button>
    </div>
  );
}
