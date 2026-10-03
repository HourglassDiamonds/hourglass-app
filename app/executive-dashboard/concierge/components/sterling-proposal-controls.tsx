"use client";

import { useActionState } from "react";
import {
  reviewSterlingProposalAction,
  type SterlingProposalActionState,
} from "../sterling-proposal-actions";
import type { SterlingProposal } from "@/lib/continuum/sterling/types";

const initialState: SterlingProposalActionState = null;

export function SterlingProposalControls({ proposal }: { proposal: SterlingProposal }) {
  const [state, action, pending] = useActionState(reviewSterlingProposalAction, initialState);
  if (proposal.persistence !== "persisted") {
    return (
      <p className="mt-3 text-[12px] leading-relaxed text-[#8d8073]">
        Approval controls are unavailable until the Sterling ledger migration is active.
      </p>
    );
  }
  const editable = proposal.proposedAction.kind === "update_job" || proposal.proposedAction.kind === "create_projectless_job";
  const editLabel = proposal.proposedAction.kind === "update_job" ? "Final waiting owner" : "Final action title";
  const editPlaceholder = proposal.proposedAction.kind === "update_job"
    ? proposal.proposedAction.waitingOnActor ?? "founder"
    : proposal.proposedAction.kind === "create_projectless_job" ? proposal.proposedAction.subject : "";
  return (
    <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-3" data-sterling-approval-controls="">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="proposalId" value={proposal.proposalId} />
        <button name="reviewAction" value="approve" disabled={pending} className="rounded-full bg-[#ad9164] px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#17120e] disabled:opacity-50">Approve</button>
        <button name="reviewAction" value="reject" disabled={pending} className="rounded-full border border-white/[0.12] px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#c4b7aa] disabled:opacity-50">Reject</button>
      </form>
      {editable ? (
        <form action={action} className="grid gap-2">
          <input type="hidden" name="proposalId" value={proposal.proposalId} />
          <input type="hidden" name="reviewAction" value="edit_and_approve" />
          <label className="text-[10px] uppercase tracking-[0.16em] text-[#8d8073]" htmlFor={`sterling-edit-${proposal.proposalId}`}>{editLabel}</label>
          <div className="flex gap-2">
            <input id={`sterling-edit-${proposal.proposalId}`} name="editedValue" defaultValue={editPlaceholder} maxLength={160} required className="min-h-10 flex-1 rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[13px] text-[#efe8de]" />
            <button disabled={pending} className="rounded-full border border-[#ad9164]/50 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-[#ad9164] disabled:opacity-50">Edit &amp; Approve</button>
          </div>
        </form>
      ) : null}
      <form action={action} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
        <input type="hidden" name="proposalId" value={proposal.proposalId} />
        <input type="hidden" name="reviewAction" value="defer" />
        <select name="deferPreset" defaultValue="tomorrow" className="min-h-10 rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[12px] text-[#c4b7aa]">
          <option value="later-today">Later today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="custom">Custom time</option>
        </select>
        <input name="deferUntil" type="datetime-local" aria-label="Custom defer time" className="min-h-10 rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[12px] text-[#c4b7aa]" />
        <button disabled={pending} className="rounded-full border border-white/[0.12] px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#c4b7aa] disabled:opacity-50">Defer</button>
      </form>
      <form action={action} className="grid gap-2">
        <input type="hidden" name="proposalId" value={proposal.proposalId} />
        <input type="hidden" name="reviewAction" value="reject" />
        <label className="text-[10px] uppercase tracking-[0.16em] text-[#8d8073]" htmlFor={`sterling-note-${proposal.proposalId}`}>Optional decision note</label>
        <div className="flex gap-2">
          <input id={`sterling-note-${proposal.proposalId}`} name="note" maxLength={1000} placeholder="Why, if useful" className="min-h-10 flex-1 rounded-[12px] border border-white/[0.1] bg-[#171411] px-3 text-[13px] text-[#efe8de]" />
          <button disabled={pending} className="rounded-full border border-white/[0.12] px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#c4b7aa] disabled:opacity-50">Reject with note</button>
        </div>
      </form>
      {state ? <p role="status" className={`text-[12px] ${state.ok ? "text-[#a9bd8e]" : "text-[#d39a8a]"}`}>{state.message}</p> : null}
    </div>
  );
}
