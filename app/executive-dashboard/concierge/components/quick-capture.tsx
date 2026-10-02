"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { CaptureCommitInput, CaptureCommitResult, CaptureProposal, CaptureRequest } from "@/lib/continuum/capture/types";
import { conciergeAddClientPath, conciergeAddNotePickerPath, conciergeCreateActionPath, conciergeInboxPath } from "@/lib/continuum/client-memory/read/presentation";
import { conciergeMyCardPath } from "@/lib/continuum/digital-card/paths";
import { CURRENT_PROJECTS_ADD_ACTION_LABEL } from "@/lib/continuum/client-memory/open-projects/present";
import {
  applyConfirmation, CAPTURE_KIND_LABELS, captureTimingLabel, editReviewItem, isSaved,
  prepareConfirmation, reviewIssue, startReview,
  type CaptureEntityLabels, type CaptureReviewItem,
} from "./quick-capture-state";

export type QuickCaptureProps = {
  /** Proposal-only engine action. It must return the locked non-canonical contract. */
  proposeAction?: (request: CaptureRequest) => Promise<CaptureProposal>;
  /** Canonical writer action. The UI calls it only after explicit confirmation. */
  saveAction?: (confirmation: CaptureCommitInput) => Promise<CaptureCommitResult>;
  entityLabels?: CaptureEntityLabels;
};

type VoicePhase = "idle" | "recording" | "transcribing" | "ready" | "error";

const VOICE_CAPTURE_MAX_MS = 90_000;
const VOICE_TRANSCRIBE_PATH =
  "/executive-dashboard/concierge/capture/transcribe";

function preferredRecordingType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  );
}

function recordingFileName(type: string): string {
  if (type.startsWith("audio/mp4")) return "quick-capture.m4a";
  if (type.startsWith("audio/ogg")) return "quick-capture.ogg";
  return "quick-capture.webm";
}

const MANUAL_ACTIONS = [
  ["Inbox", conciergeInboxPath()],
  [CURRENT_PROJECTS_ADD_ACTION_LABEL, conciergeCreateActionPath()],
  ["Add Note", conciergeAddNotePickerPath()],
  ["Add Client", conciergeAddClientPath()],
  ["My Card", conciergeMyCardPath()],
] as const;

function EntitySummary({ row, labels }: { row: CaptureReviewItem; labels?: CaptureEntityLabels }) {
  const resolution = row.item.entityResolution;
  if (!resolution) return null;
  if (resolution.status === "unresolved") {
    return <p className="mt-2 text-[12px] leading-relaxed text-[#d7a879]">Unresolved identity · “{resolution.mention}”</p>;
  }
  if (resolution.status === "ambiguous") {
    return (
      <div className="mt-2 text-[12px] leading-relaxed text-[#d7a879]">
        <p>Ambiguous identity · review required</p>
        <ul className="mt-1 list-inside list-disc text-[#a99989]">
          {resolution.candidates.map((candidate) => (
            <li key={`${candidate.kind}-${candidate.id}`}>
              {candidate.kind === "person" ? "Person" : "Project"} · {candidate.evidence}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const chips = [
    resolution.personId ? `Person · ${labels?.people?.[resolution.personId] ?? "Existing person"}` : null,
    resolution.projectId ? `Project · ${labels?.projects?.[resolution.projectId] ?? "Existing project"}` : null,
  ].filter(Boolean);
  return chips.length ? <p className="mt-2 text-[12px] text-[#a99989]">{chips.join(" · ")}</p> : null;
}

export function QuickCapture({ proposeAction, saveAction, entityLabels }: QuickCaptureProps = {}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [captureId, setCaptureId] = useState<string>();
  const [rows, setRows] = useState<CaptureReviewItem[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<"propose" | "save">();
  const [provenance, setProvenance] = useState<"text" | "voice">("text");
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceMessage, setVoiceMessage] = useState<string>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRevisionRef = useRef(0);
  const connected = Boolean(proposeAction && saveAction);
  const selected = rows.filter((row) => row.selected && !isSaved(row));
  const selectedBlocked = selected.some(reviewIssue);

  function releaseVoiceResources() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  function replaceCaptureInput(value: string, source: "text" | "voice") {
    inputRevisionRef.current += 1;
    setText(value);
    setProvenance(source);
    setRows([]);
    setCaptureId(undefined);
    setError(undefined);
  }

  useEffect(() => () => {
    cancelRef.current = true;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    releaseVoiceResources();
  }, []);

  async function transcribeRecording(blob: Blob) {
    setVoicePhase("transcribing");
    setVoiceMessage("Turning your recording into text…");
    const type = blob.type || "audio/webm";
    const form = new FormData();
    form.set("audio", blob, recordingFileName(type));
    try {
      const response = await fetch(VOICE_TRANSCRIBE_PATH, {
        method: "POST",
        body: form,
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        text?: unknown;
      };
      if (!response.ok || !result.ok || typeof result.text !== "string" || !result.text.trim()) {
        throw new Error("transcription-unavailable");
      }
      replaceCaptureInput(result.text.trim(), "voice");
      setVoicePhase("ready");
      setVoiceMessage("Transcription ready. Review or edit it, then prepare the capture.");
    } catch {
      setVoicePhase("error");
      setVoiceMessage("Continuum couldn’t transcribe that recording. Try again or type your capture.");
    }
  }

  async function startRecording() {
    setVoiceMessage(undefined);
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setVoicePhase("error");
      setVoiceMessage("Voice capture isn’t supported in this browser. You can still type your capture.");
      return;
    }
    replaceCaptureInput("", "voice");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelRef.current = false;
      const type = preferredRecordingType();
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const cancelled = cancelRef.current;
        const chunks = chunksRef.current;
        const mimeType = recorder.mimeType || chunks[0]?.type || "audio/webm";
        chunksRef.current = [];
        releaseVoiceResources();
        if (cancelled) {
          setVoicePhase("idle");
          setVoiceMessage("Recording cancelled. Nothing was uploaded or saved.");
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) {
          setVoicePhase("error");
          setVoiceMessage("No audio was captured. Try again or type your capture.");
          return;
        }
        void transcribeRecording(blob);
      };
      recorder.start(250);
      setVoicePhase("recording");
      setVoiceMessage("Listening… Speak naturally, then stop when you’re finished.");
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, VOICE_CAPTURE_MAX_MS);
    } catch (cause) {
      releaseVoiceResources();
      setVoicePhase("error");
      setVoiceMessage(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was denied. Allow access in your browser settings or type your capture."
          : "Continuum couldn’t start the microphone. Try again or type your capture.",
      );
    }
  }

  function stopRecording(cancelled: boolean) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    cancelRef.current = cancelled;
    recorder.stop();
  }

  function propose() {
    const value = text.trim();
    if (!value || !proposeAction) return;
    const nextCaptureId = crypto.randomUUID();
    const requestRevision = inputRevisionRef.current;
    setError(undefined);
    setRows([]);
    setCaptureId(undefined);
    setOperation("propose");
    startTransition(async () => {
      try {
        const proposal = await proposeAction({
          captureId: nextCaptureId,
          text: value,
          provenance,
          referenceTime: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
        if (inputRevisionRef.current !== requestRevision) return;
        setCaptureId(nextCaptureId);
        setRows(startReview(proposal, nextCaptureId));
      } catch {
        if (inputRevisionRef.current !== requestRevision) return;
        setError("Continuum couldn’t prepare this capture. Your words are still here—try again.");
      }
    });
  }

  function saveSelected() {
    if (!captureId || !saveAction) return;
    setError(undefined);
    setOperation("save");
    startTransition(async () => {
      try {
        const prepared = prepareConfirmation(captureId, rows, () => crypto.randomUUID());
        setRows(prepared.rows);
        const result = await saveAction(prepared.input);
        setRows(applyConfirmation(prepared.rows, prepared.input, result));
      } catch {
        setError("Nothing was marked saved. Review the selected items and try again.");
      }
    });
  }

  return (
    <section aria-labelledby={`${inputId}-heading`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={`${inputId}-heading`} className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">Quick Capture</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#a99b8d]">Tell Continuum once. Review everything before it becomes part of your record.</p>
        </div>
        {voicePhase === "recording" ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => stopRecording(false)} className="inline-flex min-h-11 items-center rounded-full bg-[#b09265] px-4 text-[10px] uppercase tracking-[0.2em] text-[#191612]">
              Stop
            </button>
            <button type="button" onClick={() => stopRecording(true)} className="inline-flex min-h-11 items-center rounded-full border border-[#5b5045] px-4 text-[10px] uppercase tracking-[0.2em] text-[#c4b7aa]">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={startRecording} disabled={voicePhase === "transcribing" || pending} aria-label="Speak your capture" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#5b5045] px-4 text-[10px] uppercase tracking-[0.2em] text-[#c4b7aa] disabled:cursor-not-allowed disabled:opacity-45">
            <span aria-hidden="true" className="text-base leading-none">●</span>
            {voicePhase === "transcribing" ? "Transcribing…" : voicePhase === "ready" ? "Speak again" : "Speak"}
          </button>
        )}
      </div>

      {voiceMessage ? (
        <p role={voicePhase === "error" ? "alert" : "status"} aria-live="polite" className={`mt-3 text-[12px] leading-relaxed ${voicePhase === "error" ? "text-[#d7a879]" : "text-[#a99b8d]"}`}>
          {voiceMessage}
        </p>
      ) : null}

      <div className="mt-5 rounded-[1.35rem] border border-[#4b4138] bg-[#211d19]/80 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.14)] focus-within:border-[#806b4e] sm:p-4">
        <label htmlFor={inputId} className="sr-only">Tell Continuum what happened</label>
        <textarea id={inputId} value={text} onChange={(event) => replaceCaptureInput(event.target.value, "text")} disabled={voicePhase === "recording" || voicePhase === "transcribing"} rows={4} placeholder="Tell Continuum what happened…" className="block w-full resize-y bg-transparent px-1 py-1 text-[16px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#74695f] disabled:opacity-60" />
        <div className="mt-3 flex flex-col gap-3 border-t border-[#3b342e] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-[#81756b]">
            {connected ? "Nothing is saved until you review and confirm." : "Capture engine connection pending. Manual actions remain available below."}
          </p>
          <button type="button" onClick={propose} disabled={!connected || !text.trim() || pending || voicePhase === "recording" || voicePhase === "transcribing"} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#b09265] px-5 text-[10px] uppercase tracking-[0.22em] text-[#191612] outline-none transition hover:bg-[#c0a276] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.25)] disabled:cursor-not-allowed disabled:opacity-35">
            {pending && operation === "propose" ? "Reviewing…" : "Review capture"}
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-[#74695f]">Unrecognized people and projects stay unlinked. Continuum will not create them here.</p>
      </div>

      {error ? <p role="alert" className="mt-3 text-[13px] leading-relaxed text-[#d7a879]">{error}</p> : null}

      {rows.length ? (
        <div className="mt-7" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-serif text-[1.45rem] text-[#efe8de]">Review proposed items</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#80746a]">Draft only</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#8d8073]">Each selected item is saved only after you confirm below. Timing is shown for review; this screen does not schedule notifications.</p>

          <div className="mt-4 space-y-3">
            {rows.map((row, index) => {
              const issue = reviewIssue(row);
              const saved = isSaved(row);
              const cardId = `${inputId}-item-${index}`;
              return (
                <article key={row.item.itemId} className={`rounded-[1.2rem] border p-4 ${issue ? "border-[#8e6849] bg-[#2a211a]" : "border-[#443b34] bg-[#211d19]"}`}>
                  <div className="flex items-start gap-3">
                    <input aria-label={`Select ${row.item.title}`} aria-describedby={issue ? `${cardId}-issue` : undefined} type="checkbox" checked={row.selected} disabled={saved || pending} onChange={(event) => setRows((current) => current.map((item) => item.item.itemId === row.item.itemId ? { ...item, selected: event.target.checked } : item))} className="mt-1.5 size-5 shrink-0 accent-[#b09265]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-[#b09265]">{CAPTURE_KIND_LABELS[row.item.kind]}</span>
                        <span className="text-[11px] text-[#81756b]">{captureTimingLabel(row.item.timing)}</span>
                        {saved ? <span className="text-[10px] uppercase tracking-[0.18em] text-[#9fb093]">Saved</span> : null}
                      </div>
                      <EntitySummary row={row} labels={entityLabels} />
                      <label htmlFor={`${cardId}-title`} className="sr-only">Proposed title</label>
                      <input id={`${cardId}-title`} value={row.item.title} disabled={saved || pending} maxLength={160} onChange={(event) => setRows((current) => current.map((item) => item.item.itemId === row.item.itemId ? editReviewItem(item, { title: event.target.value }) : item))} className="mt-3 block w-full border-b border-[#4a4037] bg-transparent pb-2 font-serif text-[1.15rem] text-[#efe8de] outline-none focus:border-[#a18760] disabled:opacity-65" />
                      <label htmlFor={`${cardId}-content`} className="sr-only">Proposed content</label>
                      <textarea id={`${cardId}-content`} value={row.item.content} disabled={saved || pending} rows={2} onChange={(event) => setRows((current) => current.map((item) => item.item.itemId === row.item.itemId ? editReviewItem(item, { content: event.target.value }) : item))} className="mt-3 block w-full resize-y bg-transparent text-[14px] leading-relaxed text-[#c9bdb1] outline-none placeholder:text-[#6e635a] disabled:opacity-65" />
                      {issue ? <p id={`${cardId}-issue`} role="alert" className="mt-3 border-l border-[#a8784e] pl-3 text-[12px] leading-relaxed text-[#d7a879]">Review required · {issue}</p> : null}
                      {row.result?.status === "failed" ? <p role="alert" className="mt-3 text-[12px] text-[#d7a879]">Not saved · {row.result.message}</p> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="sticky bottom-3 mt-4 rounded-full border border-[#54493e] bg-[#191612]/95 p-2 shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur">
            <button type="button" onClick={saveSelected} disabled={!selected.length || selectedBlocked || pending} className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#b09265] px-5 text-[10px] uppercase tracking-[0.22em] text-[#191612] outline-none transition hover:bg-[#c0a276] focus-visible:shadow-[0_0_0_3px_rgba(239,232,222,0.2)] disabled:cursor-not-allowed disabled:opacity-35">
              {pending && operation === "save" ? "Saving…" : `Save selected${selected.length ? ` (${selected.length})` : ""}`}
            </button>
          </div>
        </div>
      ) : null}

      <details className="mt-6 border-t border-[#38312b] pt-2">
        <summary className="min-h-12 cursor-pointer list-none py-4 text-[10px] uppercase tracking-[0.24em] text-[#8d8073] outline-none marker:hidden hover:text-[#c4b7aa] focus-visible:text-[#efe8de]">
          Add manually <span aria-hidden="true">＋</span>
        </summary>
        <nav aria-label="Manual quick capture actions" className="grid grid-cols-2 gap-x-5 border-t border-[#302a25] py-3 sm:grid-cols-3">
          {MANUAL_ACTIONS.map(([label, href]) => (
            <Link key={href} href={href} className="inline-flex min-h-12 items-center text-[10px] uppercase tracking-[0.2em] text-[#a99b8d] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]">
              {label}
            </Link>
          ))}
        </nav>
      </details>
    </section>
  );
}
