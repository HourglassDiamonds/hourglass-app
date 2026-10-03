"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  reviewSterlingProposalAction,
  type SterlingProposalActionState,
} from "../sterling-proposal-actions";
import type { SterlingProposal } from "@/lib/continuum/sterling/types";

const initialState: SterlingProposalActionState = null;
type ReviewMode = "idle" | "edit" | "defer";
type ReviewIntent = "approve" | "edit_and_approve" | "defer" | "reject";
const SECONDARY_BUTTON = "min-h-11 px-3 text-[11px] text-[#a99b8d] outline-none transition hover:text-[#efe8de] focus-visible:text-[#efe8de] disabled:cursor-not-allowed disabled:opacity-45";

export function SterlingProposalControls({ proposal }: { proposal: SterlingProposal }) {
  const [state, action, pending] = useActionState(reviewSterlingProposalAction, initialState);
  const [mode, setMode] = useState<ReviewMode>("idle");
  const [intent, setIntent] = useState<ReviewIntent>();
  const [slow, setSlow] = useState(false);
  const [deferPreset, setDeferPreset] = useState("tomorrow");
  const [clientDurationMs, setClientDurationMs] = useState<number>();
  const startedAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSlow(true), 5_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (!state || startedAt.current == null) return;
    setClientDurationMs(performance.now() - startedAt.current);
    startedAt.current = undefined;
  }, [state]);

  if (proposal.persistence !== "persisted") {
    return <p className="mt-3 text-[12px] leading-relaxed text-[#8d8073]">This is advice only; review actions are unavailable right now.</p>;
  }

  const editable = proposal.proposedAction.kind === "update_job" || proposal.proposedAction.kind === "create_projectless_job";
  const editLabel = proposal.proposedAction.kind === "update_job" ? "Waiting on" : "Action title";
  const editPlaceholder = proposal.proposedAction.kind === "update_job"
    ? proposal.proposedAction.waitingOnActor ?? "founder"
    : proposal.proposedAction.kind === "create_projectless_job" ? proposal.proposedAction.subject : "";
  const pendingLabel = intent === "approve" || intent === "edit_and_approve"
    ? "Approving…"
    : intent === "defer" ? "Deferring…" : "Dismissing…";

  if (state?.ok) {
    return (
      <div className="mt-4 border-t border-white/[0.06] pt-3" data-sterling-action-complete={state.status ?? "complete"}>
        <p role="status" className="text-[13px] leading-relaxed text-[#a9bd8e]">{state.message}</p>
        <p className="mt-1 text-[11px] text-[#74695f]">{formatCompletionTime(clientDurationMs, state.timing?.totalMs)}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-3" data-sterling-approval-controls="">
      <form action={action} onSubmit={() => { startedAt.current = performance.now(); setClientDurationMs(undefined); setSlow(false); }}>
        <input type="hidden" name="proposalId" value={proposal.proposalId} />
        <div className="flex flex-wrap items-center gap-1">
          <button name="reviewAction" value="approve" disabled={pending} onClick={() => setIntent("approve")} className="min-h-11 rounded-[12px] bg-[#ad9164] px-4 text-[11px] text-[#17120e] outline-none transition hover:bg-[#c0a276] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.24)] disabled:cursor-not-allowed disabled:opacity-45">Approve</button>
          {editable ? <button type="button" disabled={pending} onClick={() => setMode(mode === "edit" ? "idle" : "edit")} className={SECONDARY_BUTTON}>Edit</button> : null}
          <button type="button" disabled={pending} onClick={() => setMode(mode === "defer" ? "idle" : "defer")} className={SECONDARY_BUTTON}>Defer</button>
          {proposal.kind === "conditional_hold" ? <span className="text-[10px] text-[#74695f]">Choose a different review time</span> : null}
          <button name="reviewAction" value="reject" disabled={pending} onClick={() => setIntent("reject")} className={SECONDARY_BUTTON}>Dismiss</button>
        </div>

        {mode === "edit" && editable ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" data-sterling-edit="">
            <label className="min-w-0 flex-1 text-[10px] uppercase tracking-[0.16em] text-[#8d8073]" htmlFor={`sterling-edit-${proposal.proposalId}`}>
              {editLabel}
              <input id={`sterling-edit-${proposal.proposalId}`} name="editedValue" defaultValue={editPlaceholder} maxLength={160} required disabled={pending} className="mt-1 block min-h-11 w-full rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[13px] normal-case tracking-normal text-[#efe8de]" />
            </label>
            <button name="reviewAction" value="edit_and_approve" disabled={pending} onClick={() => setIntent("edit_and_approve")} className="min-h-11 rounded-[12px] border border-[#ad9164]/50 px-4 text-[11px] text-[#ad9164] disabled:opacity-45">Approve edit</button>
          </div>
        ) : null}

        {mode === "defer" ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row" data-sterling-defer="">
            <select name="deferPreset" value={deferPreset} onChange={(event) => setDeferPreset(event.target.value)} disabled={pending} aria-label="Defer until" className="min-h-11 rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[12px] text-[#c4b7aa]">
              <option value="later-today">Later today</option><option value="tomorrow">Tomorrow</option><option value="custom">Custom time</option>
            </select>
            {deferPreset === "custom" ? <input name="deferUntil" type="datetime-local" aria-label="Custom defer time" required disabled={pending} className="min-h-11 rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[12px] text-[#c4b7aa]" /> : null}
            <button name="reviewAction" value="defer" disabled={pending} onClick={() => setIntent("defer")} className="min-h-11 rounded-[12px] border border-white/[0.12] px-4 text-[11px] text-[#c4b7aa] disabled:opacity-45">Confirm defer</button>
          </div>
        ) : null}
      </form>

      {pending ? (
        <p role="status" aria-live="polite" className="mt-3 text-[12px] leading-relaxed text-[#c4b7aa]" data-sterling-action-pending={intent ?? "review"}>
          {slow ? `${pendingLabel} This is taking longer than usual; retry protection is active.` : pendingLabel}
        </p>
      ) : state ? (
        <p role="alert" className="mt-3 text-[12px] leading-relaxed text-[#d39a8a]">{state.message} You can retry safely.</p>
      ) : null}
    </div>
  );
}

function formatCompletionTime(clientMs?: number, serverMs?: number): string {
  if (clientMs == null && serverMs == null) return "Saved.";
  const client = clientMs == null ? null : `${(clientMs / 1000).toFixed(1)}s total`;
  const server = serverMs == null ? null : `${(serverMs / 1000).toFixed(1)}s server`;
  return [client, server].filter(Boolean).join(" · ");
}
