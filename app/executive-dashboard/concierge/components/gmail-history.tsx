"use client";

import { useActionState } from "react";
import { runGmailHistoryChunkAction } from "../gmail-history-actions";
import type { GmailHistoryChunkResult } from "@/lib/continuum/gmail/history";

function statusLabel(result: GmailHistoryChunkResult): string {
  if (result.completed) return "Complete";
  if (result.checkpointStatus === "failed") return "Failed";
  if (result.checkpointStatus === "running" || result.morePagesRemain) {
    return "In progress";
  }
  if (result.checkpointStatus === "idle" && result.indexedCount === 0) {
    return "Not started";
  }
  return "In progress";
}

function buttonLabel(result: GmailHistoryChunkResult, pending: boolean): string {
  if (pending) return "Running…";
  if (result.completed) return "Backfill complete";
  if (result.checkpointStatus === "idle" && result.indexedCount === 0) {
    return "Start backfill";
  }
  return "Run next chunk";
}

function ResultLines({ result }: { result: GmailHistoryChunkResult }) {
  return (
    <dl className="mt-6 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
      <div className="flex justify-between gap-4">
        <dt>Status</dt>
        <dd>{statusLabel(result)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Indexed</dt>
        <dd>{result.indexedCount}</dd>
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
        <dd>{result.chunkSucceeded ? "Succeeded" : result.safeErrorCode ? "Failed" : "—"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>This chunk</dt>
        <dd>{result.indexedThisChunk}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>More pages</dt>
        <dd>{result.morePagesRemain ? "Yes" : "No"}</dd>
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
  const [state, formAction, pending] = useActionState(
    runGmailHistoryChunkAction,
    initial,
  );
  const result = state ?? initial;
  const disabled = pending || result.completed;

  return (
    <form action={formAction} className="mt-10">
      <h2 className="font-serif text-[1.25rem] font-normal tracking-[-0.03em] text-[#efe8de]">
        Gmail History
      </h2>
      <ResultLines result={result} />
      <button
        type="submit"
        disabled={disabled}
        className="mt-6 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
      >
        {buttonLabel(result, pending)}
      </button>
    </form>
  );
}
