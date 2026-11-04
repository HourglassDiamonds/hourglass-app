"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runOnePreviewGmailIngestionChunk } from "../gmail-incremental-actions";
import {
  createManualPreviewCatchUp,
  MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS,
  type ManualPreviewCatchUp,
  type ManualPreviewCatchUpState,
} from "@/lib/continuum/gmail/manual-preview-catch-up";
import {
  INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
  type ManualPreviewChunkResult,
} from "@/lib/continuum/gmail/manual-preview-chunk";

const buttonClass =
  "inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#8d8073]";

function statusText(state: ManualPreviewCatchUpState): string {
  if (state.autoRunning) {
    return state.result.recovery
      ? "Recovery in progress. The next bounded chunk will start automatically."
      : "Catch-up in progress. The next bounded chunk will start automatically.";
  }
  switch (state.stopReason) {
    case "completed":
      return "Checkpoint completed successfully. Automatic continuation stopped.";
    case "limit-reached":
      return `Session limit reached after ${MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS} chunks. A new founder click is required to continue.`;
    case "stopped":
      return "Stopped after the current chunk. Durable checkpoint progress is preserved.";
    case "cancelled":
      return "Browser continuation stopped. Durable checkpoint progress is preserved.";
    case "blocked":
      if (state.result.blockedReason === "unauthorized") {
        return "Founder authentication is required. Catch-up stopped.";
      }
      if (state.result.blockedReason === "not-beta-recovery-preview") {
        return "Unavailable outside the isolated Beta Recovery Preview deployment.";
      }
      return "Catch-up could not continue safely. Refresh the page before trying again.";
    case "failed":
      return `Catch-up stopped on an error${state.result.safeErrorCode ? ` · ${state.result.safeErrorCode}` : ""}. No automatic retry was attempted.`;
    case "safety-stop":
      return "Catch-up stopped because the checkpoint did not report a safe continuation state.";
    case "already-in-flight":
      return "A catch-up session is already running in this browser.";
    default:
      if (state.result.status === "recovering") {
        return "Recovery is ready to continue from the durable checkpoint.";
      }
      if (state.result.status === "completed") {
        return "Checkpoint completed successfully.";
      }
      return "Ready for a founder-initiated catch-up session.";
  }
}

export function GmailManualPreviewChunk({
  initial,
}: {
  initial: ManualPreviewChunkResult;
}) {
  const router = useRouter();
  const [state, setState] = useState<ManualPreviewCatchUpState>({
    result: initial,
    chunksCompleted: 0,
    messagesIndexedThisSession: 0,
    attemptsThisSession: 0,
    autoRunning: false,
    paused: false,
    stopReason: null,
  });
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const continuationRef = useRef<ManualPreviewCatchUp | null>(null);
  const aliveRef = useRef(true);
  const generationRef = useRef(0);
  const clickGuardRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    const continuation = createManualPreviewCatchUp({
      initial,
      runChunk: () =>
        runOnePreviewGmailIngestionChunk(
          INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
          new FormData(),
        ),
    });
    continuationRef.current = continuation;
    return () => {
      aliveRef.current = false;
      generationRef.current += 1;
      continuation.cancel();
      if (continuationRef.current === continuation) {
        continuationRef.current = null;
      }
    };
  }, [initial]);

  async function startCatchUp() {
    const continuation = continuationRef.current;
    if (
      clickGuardRef.current ||
      !continuation ||
      continuation.isActive() ||
      state.autoRunning
    ) {
      return;
    }
    clickGuardRef.current = true;
    const generation = generationRef.current;
    setStarting(true);
    setStopping(false);
    setState((current) => ({
      ...current,
      chunksCompleted: 0,
      messagesIndexedThisSession: 0,
      attemptsThisSession: 0,
      autoRunning: true,
      paused: false,
      stopReason: null,
    }));
    try {
      const done = await continuation.start((next) => {
        if (aliveRef.current && generationRef.current === generation) {
          setState(next);
        }
      });
      if (!aliveRef.current || generationRef.current !== generation) return;
      setState(done);
      setStopping(false);
      router.refresh();
    } finally {
      if (generationRef.current === generation) {
        clickGuardRef.current = false;
        if (aliveRef.current) setStarting(false);
      }
    }
  }

  function stopAfterCurrent() {
    const continuation = continuationRef.current;
    if (!continuation || !continuation.isActive()) return;
    continuation.requestStopAfterCurrent();
    setStopping(true);
  }

  const running = starting || state.autoRunning;
  const error =
    state.result.status === "failed" || state.result.status === "blocked"
      ? state.result.safeErrorCode ?? state.result.blockedReason
      : null;

  return (
    <section className="mt-8 rounded-2xl border border-[#ad9164]/25 p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">
        Preview only · founder-controlled catch-up
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-[#a99c90]">
        One founder click runs up to {MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS} sequential,
        lease-protected chunks from this browser. Each server request remains one
        page. Nothing starts on page load, and another click is required after the
        session limit.
      </p>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
        <button
          type="button"
          disabled={running}
          onClick={startCatchUp}
          className={buttonClass}
        >
          {running ? "Gmail catch-up running…" : "Start Gmail Catch-Up"}
        </button>
        <button
          type="button"
          disabled={!running || stopping}
          onClick={stopAfterCurrent}
          className={buttonClass}
        >
          {stopping ? "Stopping after current chunk…" : "Stop after current chunk"}
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-4 text-[12px] text-[#c4b7aa]">
        {statusText(state)}
      </p>
      <dl className="mt-4 space-y-1 text-[12px] text-[#a99c90]">
        <div className="flex justify-between gap-4">
          <dt>Chunks completed</dt>
          <dd>{state.chunksCompleted} / {MANUAL_PREVIEW_CATCH_UP_MAX_CHUNKS}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Messages indexed this session</dt>
          <dd>{state.messagesIndexedThisSession}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Checkpoint indexed count</dt>
          <dd>{state.result.indexedCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Checkpoint status</dt>
          <dd>{state.result.checkpointStatus ?? "idle"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Recovery progress</dt>
          <dd>{state.result.recovery ? "Catch-up active" : "Standard incremental"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Remaining pages</dt>
          <dd>{state.result.morePagesRemain ? "Yes" : "No"}</dd>
        </div>
        {error ? (
          <div className="flex justify-between gap-4">
            <dt>Error</dt>
            <dd>{error}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
