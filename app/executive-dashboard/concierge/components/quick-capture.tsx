"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import type { CaptureCommitInput, CaptureCommitResult, CaptureProposal, CaptureRequest } from "@/lib/continuum/capture/types";
import { conciergeAddClientPath, conciergeAddNotePickerPath, conciergeAskPath, conciergeCreateActionPath, conciergeInboxPath } from "@/lib/continuum/client-memory/read/presentation";
import { conciergeMyCardPath } from "@/lib/continuum/digital-card/paths";
import { CURRENT_PROJECTS_ADD_ACTION_LABEL } from "@/lib/continuum/client-memory/open-projects/present";
import {
  applyConfirmation, CAPTURE_KIND_LABELS, captureInputLooksLikeAdvisory, captureTimingLabel, editReviewItem, isSaved,
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
  const [slow, setSlow] = useState(false);
  const [lastDurationMs, setLastDurationMs] = useState<number>();
  const connected = Boolean(proposeAction && saveAction);
  const selected = rows.filter((row) => row.selected && !isSaved(row));
  const selectedBlocked = selected.some(reviewIssue);
  const hasBlockedRows = rows.some((row) => !isSaved(row) && Boolean(reviewIssue(row)));
  const advisoryInput = captureInputLooksLikeAdvisory(text);

  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 5_000);
    return () => window.clearTimeout(timer);
  }, [pending, operation]);

  function propose() {
    const value = text.trim();
    if (!value) return;
    if (captureInputLooksLikeAdvisory(value)) {
      window.location.assign(conciergeAskPath({ q: value }));
      return;
    }
    if (!proposeAction) return;
    const started = performance.now();
    const nextCaptureId = crypto.randomUUID();
    setError(undefined);
    setRows([]);
    setCaptureId(undefined);
    setOperation("propose");
    startTransition(async () => {
      try {
        const proposal = await proposeAction({
          captureId: nextCaptureId,
          text: value,
          provenance: "text",
          referenceTime: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
        setCaptureId(nextCaptureId);
        setRows(startReview(proposal, nextCaptureId));
      } catch {
        setError("Continuum couldn’t prepare this capture. Your words are still here—try again.");
      } finally {
        setLastDurationMs(performance.now() - started);
      }
    });
  }

  function saveSelected() {
    if (!captureId || !saveAction) return;
    const started = performance.now();
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
      } finally {
        setLastDurationMs(performance.now() - started);
      }
    });
  }

  return (
    <section aria-labelledby={`${inputId}-heading`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={`${inputId}-heading`} className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">Quick Capture</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#a99b8d]">Capture a fact, note, commitment, or action. Questions belong in Ask Concierge above.</p>
        </div>
        <button type="button" disabled aria-label="Speak your capture — voice input coming soon" title="Voice input coming soon" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#5b5045] px-4 text-[10px] uppercase tracking-[0.2em] text-[#8d8073] opacity-70">
          <span aria-hidden="true" className="text-base leading-none">◉</span> Speak
        </button>
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-[#4b4138] bg-[#211d19]/80 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.14)] focus-within:border-[#806b4e] sm:p-4">
        <label htmlFor={inputId} className="sr-only">Tell Continuum what happened</label>
        <textarea id={inputId} value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="Example: Follow up with the shop Friday about the CAD…" className="block w-full resize-y bg-transparent px-1 py-1 text-[16px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#74695f]" />
        <div className="mt-3 flex flex-col gap-3 border-t border-[#3b342e] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-[#81756b]">
            {advisoryInput
              ? "That looks like a question. Ask Concierge will answer it directly—nothing will be drafted or saved."
              : connected
                ? "Nothing is saved until you review and confirm."
                : "Capture engine connection pending. Manual actions remain available below."}
          </p>
          <button type="button" onClick={propose} disabled={(!connected && !advisoryInput) || !text.trim() || pending} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#b09265] px-5 text-[10px] uppercase tracking-[0.22em] text-[#191612] outline-none transition hover:bg-[#c0a276] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.25)] disabled:cursor-not-allowed disabled:opacity-35">
            {pending && operation === "propose" ? "Reviewing…" : advisoryInput ? "Ask Concierge" : "Review capture"}
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-[#74695f]">Unrecognized people and projects stay unlinked. Continuum will not create them here.</p>
      </div>

      {error ? <p role="alert" className="mt-3 text-[13px] leading-relaxed text-[#d7a879]">{error}</p> : null}
      {pending ? (
        <p role="status" className="mt-3 text-[12px] leading-relaxed text-[#a99b8d]" data-capture-pending="">
          {slow
            ? operation === "save"
              ? "Still saving safely. Keep this open; retry protection is active."
              : "Still reviewing. Your words are safe here."
            : operation === "save" ? "Saving…" : "Reviewing…"}
        </p>
      ) : lastDurationMs != null ? (
        <p className="mt-3 text-[11px] text-[#74695f]" data-capture-latency-ms={Math.round(lastDurationMs)}>
          Last action completed in {(lastDurationMs / 1000).toFixed(1)}s.
        </p>
      ) : null}

      {rows.length ? (
        <div className="mt-7" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-serif text-[1.45rem] text-[#efe8de]">Review before saving</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#80746a]">Nothing saved yet</span>
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
                    {rows.length > 1 ? <input aria-label={`Select ${row.item.title}`} aria-describedby={issue ? `${cardId}-issue` : undefined} type="checkbox" checked={row.selected} disabled={saved || pending} onChange={(event) => setRows((current) => current.map((item) => item.item.itemId === row.item.itemId ? { ...item, selected: event.target.checked } : item))} className="mt-1.5 size-5 shrink-0 accent-[#b09265]" /> : null}
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
              {pending && operation === "save"
                ? "Saving…"
                : hasBlockedRows
                  ? "Resolve review question to save"
                  : rows.length === 1
                    ? "Save item"
                    : `Save selected${selected.length ? ` (${selected.length})` : ""}`}
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
