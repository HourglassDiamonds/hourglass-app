"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runNextGmailIncrementalChunk } from "../gmail-incremental-actions";
import {
  createGmailIncrementalContinuation,
  shouldOfferGmailIncrementalResume,
  type GmailIncrementalContinuation,
} from "@/lib/continuum/gmail/incremental-continue";
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

function statusLabel(
  result: GmailIncrementalChunkResult,
  autoRunning: boolean,
  paused: boolean,
): string {
  if (result.safeErrorCode === "sync-disabled") return "Not activated";
  if (result.safeErrorCode === "historical-incomplete") {
    return "Waiting on historical backfill";
  }
  if (autoRunning) return "Continuing automatically";
  if (paused) return "Paused";
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
  if (shouldOfferGmailIncrementalResume(result)) return "Resume current-state sync";
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
  const router = useRouter();
  const [result, setResult] = useState(initial);
  const [chunksThisSession, setChunksThisSession] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lock, setLock] = useState(false);
  const continuationRef = useRef<GmailIncrementalContinuation | null>(null);
  const aliveRef = useRef(true);
  const startGenerationRef = useRef(0);
  const clickGuardRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    const continuation = createGmailIncrementalContinuation({
      runChunk: () => runNextGmailIncrementalChunk(),
      initial,
    });
    continuationRef.current = continuation;
    return () => {
      aliveRef.current = false;
      startGenerationRef.current += 1;
      continuation.cancel();
      if (continuationRef.current === continuation) {
        continuationRef.current = null;
      }
    };
  }, [initial]);

  const busy = lock || autoRunning;

  function applyState(state: {
    result: GmailIncrementalChunkResult;
    chunksThisSession: number;
    autoRunning: boolean;
    paused: boolean;
  }) {
    if (!aliveRef.current) return;
    setResult(state.result);
    setChunksThisSession(state.chunksThisSession);
    setAutoRunning(state.autoRunning);
    setPaused(state.paused);
  }

  async function startContinuation() {
    const continuation = continuationRef.current;
    if (
      clickGuardRef.current ||
      !continuation ||
      continuation.isActive() ||
      busy ||
      !publicState.activationEnabled
    ) {
      return;
    }
    clickGuardRef.current = true;
    const generation = startGenerationRef.current;
    setLock(true);
    setPaused(false);
    setStopping(false);
    setAutoRunning(true);
    try {
      const done = await continuation.start((state) => {
        if (startGenerationRef.current !== generation) return;
        applyState(state);
      });
      if (startGenerationRef.current !== generation || !aliveRef.current) return;
      applyState({
        result: done.result,
        chunksThisSession: done.chunksThisSession,
        autoRunning: false,
        paused: done.stopReason === "stopped" || done.stopReason === "cancelled",
      });
      setStopping(false);
      router.refresh();
    } finally {
      if (startGenerationRef.current === generation) {
        clickGuardRef.current = false;
        if (aliveRef.current) setLock(false);
      }
    }
  }

  function stopAfterCurrent() {
    const continuation = continuationRef.current;
    if (!continuation || !continuation.isActive()) return;
    continuation.requestStopAfterCurrent();
    setStopping(true);
  }

  return (
    <div className="mt-10">
      <h2 className="font-serif text-[1.25rem] font-normal tracking-[-0.03em] text-[#efe8de]">
        Current mailbox
      </h2>
      <dl className="mt-6 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
        <div className="flex justify-between gap-4">
          <dt>Status</dt>
          <dd>{statusLabel(result, autoRunning, paused)}</dd>
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
          <dt>Chunks this session</dt>
          <dd>{chunksThisSession}</dd>
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
      {autoRunning ? (
        <button type="button" onClick={stopAfterCurrent} className={buttonClass}>
          {stopping ? "Stopping…" : "Stop after current chunk"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || !publicState.activationEnabled}
          onClick={startContinuation}
          className={buttonClass}
        >
          {runLabel(result, publicState.activationEnabled)}
        </button>
      )}
    </div>
  );
}
