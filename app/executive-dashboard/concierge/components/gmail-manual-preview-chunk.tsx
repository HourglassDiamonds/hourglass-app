"use client";

import { useActionState } from "react";
import { runOnePreviewGmailIngestionChunk } from "../gmail-incremental-actions";
import {
  INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
  type ManualPreviewChunkResult,
} from "@/lib/continuum/gmail/manual-preview-chunk";

function statusText(result: ManualPreviewChunkResult): string | null {
  if (result.status === "idle") return null;
  if (result.status === "completed") return "Checkpoint completed successfully.";
  if (result.status === "progressed") {
    return result.morePagesRemain
      ? "One chunk persisted. More pages remain; run another chunk only with explicit founder approval."
      : "One chunk persisted. Refresh readiness to confirm the checkpoint.";
  }
  if (result.blockedReason === "unauthorized") {
    return "Founder authentication is required.";
  }
  if (result.blockedReason === "not-beta-recovery-preview") {
    return "Unavailable outside the isolated Beta Recovery Preview deployment.";
  }
  return `Chunk failed${result.safeErrorCode ? ` · ${result.safeErrorCode}` : ""}. No success was recorded.`;
}

export function GmailManualPreviewChunk() {
  const [result, action, pending] = useActionState(
    runOnePreviewGmailIngestionChunk,
    INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
  );
  const message = statusText(result);
  return (
    <section className="mt-8 rounded-2xl border border-[#ad9164]/25 p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">
        Preview only · one bounded chunk
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-[#a99c90]">
        This explicit founder action indexes one Gmail History page and persists
        its checkpoint. It does not enable recurring sync, continue automatically,
        create client records, or publish Sterling.
      </p>
      <form action={action} className="mt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#8d8073]"
        >
          {pending ? "Running one chunk…" : "Run one Gmail ingestion chunk"}
        </button>
      </form>
      {message ? (
        <p role="status" className="mt-4 text-[12px] text-[#c4b7aa]">
          {message}
        </p>
      ) : null}
      {result.status !== "idle" ? (
        <dl className="mt-4 space-y-1 text-[12px] text-[#a99c90]">
          <div className="flex justify-between gap-4">
            <dt>Checkpoint</dt>
            <dd>{result.checkpointStatus ?? "unchanged"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Indexed this chunk</dt>
            <dd>{result.indexedThisChunk}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>More pages</dt>
            <dd>{result.morePagesRemain ? "Yes" : "No"}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
