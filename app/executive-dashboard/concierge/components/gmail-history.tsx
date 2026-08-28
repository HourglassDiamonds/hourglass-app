"use client";

import { useEffect, useRef, useState } from "react";
import { runNextGmailHistoryChunk } from "../gmail-history-actions";
import {
  createGmailHistoryContinuation,
  type GmailHistoryContinuation,
} from "@/lib/continuum/gmail/history-continue";
import type { GmailHistoryChunkResult } from "@/lib/continuum/gmail/history";

const buttonClass =
  "mt-6 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]";

function statusLabel(
  result: GmailHistoryChunkResult,
  autoRunning: boolean,
  paused: boolean,
): string {
  if (result.completed) return "Complete";
  if (result.checkpointStatus === "failed" || result.safeErrorCode) return "Failed";
  if (autoRunning) return "Backfill running";
  if (paused) return "Paused";
  if (result.checkpointStatus === "running" || result.morePagesRemain) {
    return "In progress";
  }
  if (result.checkpointStatus === "idle" && result.indexedCount === 0) {
    return "Not started";
  }
  return "In progress";
}

function singleChunkLabel(result: GmailHistoryChunkResult): string {
  if (result.completed) return "Backfill complete";
  if (result.checkpointStatus === "idle" && result.indexedCount === 0) {
    return "Start backfill";
  }
  return "Run next chunk";
}

function ResultLines({
  result,
  autoRunning,
  paused,
  chunksThisSession,
}: {
  result: GmailHistoryChunkResult;
  autoRunning: boolean;
  paused: boolean;
  chunksThisSession: number;
}) {
  return (
    <dl className="mt-6 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
      <div className="flex justify-between gap-4">
        <dt>Status</dt>
        <dd>{statusLabel(result, autoRunning, paused)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Indexed</dt>
        <dd>{result.indexedCount}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Current chunk</dt>
        <dd>{result.indexedThisChunk}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>More pages</dt>
        <dd>{result.morePagesRemain ? "Yes" : "No"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Chunks this session</dt>
        <dd>{chunksThisSession}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Window</dt>
        <dd>
          {result.windowStart && result.windowEnd
            ? `${result.windowStart} → ${result.windowEnd}`
            : "—"}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Chunk</dt>
        <dd>
          {result.chunkSucceeded ? "Succeeded" : result.safeErrorCode ? "Failed" : "—"}
        </dd>
      </div>
      {result.safeErrorCode ? (
        <div className="flex justify-between gap-4">
          <dt>Code</dt>
          <dd>{result.safeErrorCode}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function GmailHistoryForm({
  initial,
}: {
  initial: GmailHistoryChunkResult;
}) {
  const [result, setResult] = useState(initial);
  const [chunksThisSession, setChunksThisSession] = useState(0);
  const [autoRunning, setAutoRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lock, setLock] = useState(false);
  const continuationRef = useRef<GmailHistoryContinuation | null>(null);

  useEffect(() => {
    const continuation = createGmailHistoryContinuation({
      runChunk: () => runNextGmailHistoryChunk(),
      initial,
    });
    continuationRef.current = continuation;
    return () => {
      continuation.cancel();
    };
  }, [initial]);

  const busy = lock || autoRunning;
  const finished = result.completed;

  async function runSingle() {
    const continuation = continuationRef.current;
    if (!continuation || continuation.isActive() || finished || lock) return;
    setLock(true);
    setPaused(false);
    setStopping(false);
    try {
      const done = await continuation.runOnce((state) => {
        setResult(state.result);
        setChunksThisSession(state.chunksThisSession);
      });
      setResult(done.result);
      setChunksThisSession(done.chunksThisSession);
    } finally {
      setLock(false);
    }
  }

  async function finishBackfill() {
    const continuation = continuationRef.current;
    if (!continuation || continuation.isActive() || finished || lock) return;
    setLock(true);
    setPaused(false);
    setStopping(false);
    setAutoRunning(true);
    try {
      const done = await continuation.start((state) => {
        setResult(state.result);
        setChunksThisSession(state.chunksThisSession);
        setAutoRunning(state.autoRunning);
        setPaused(state.paused);
      });
      setResult(done.result);
      setChunksThisSession(done.chunksThisSession);
      setAutoRunning(false);
      setPaused(done.stopReason === "stopped" || done.stopReason === "cancelled");
      setStopping(false);
    } finally {
      setLock(false);
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
        Gmail History
      </h2>
      <ResultLines
        result={result}
        autoRunning={autoRunning}
        paused={paused}
        chunksThisSession={chunksThisSession}
      />
      {autoRunning ? (
        <button
          type="button"
          onClick={stopAfterCurrent}
          className={buttonClass}
        >
          {stopping ? "Stopping…" : "Stop after current chunk"}
        </button>
      ) : (
        <div className="flex flex-col items-start">
          <button
            type="button"
            disabled={busy || finished}
            onClick={runSingle}
            className={buttonClass}
          >
            {singleChunkLabel(result)}
          </button>
          {finished ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={finishBackfill}
              className={buttonClass}
            >
              Finish backfill
            </button>
          )}
        </div>
      )}
    </div>
  );
}
