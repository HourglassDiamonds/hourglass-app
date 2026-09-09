"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  issueSavedRepairQuote,
  overrideSavedRepairQuote,
  voidSavedRepairQuote,
  type SaveRepairQuoteState,
} from "../repair-quote-actions";
import type { RepairQuote } from "@/lib/continuum/repair-quoting/types";

export function RepairQuoteReviewActions({
  quote,
  issueMutationId,
  overrideMutationId,
  voidMutationId,
}: {
  quote: RepairQuote;
  issueMutationId: string;
  overrideMutationId: string;
  voidMutationId: string;
}) {
  if (quote.state === "voided") return null;
  if (quote.state === "issued") {
    return (
      <QuoteActionForm
        action={voidSavedRepairQuote}
        projectId={quote.projectId}
        quoteId={quote.quoteId}
        mutationId={voidMutationId}
        submitLabel="Void issued quote"
        pendingLabel="Voiding…"
      />
    );
  }
  return (
    <div className="mt-10 space-y-8">
      <QuoteActionForm
        action={issueSavedRepairQuote}
        projectId={quote.projectId}
        quoteId={quote.quoteId}
        mutationId={issueMutationId}
        submitLabel="Issue quote"
        pendingLabel="Issuing…"
      />
      <OverrideForm
        projectId={quote.projectId}
        quoteId={quote.quoteId}
        mutationId={overrideMutationId}
      />
    </div>
  );
}

function QuoteActionForm({
  action,
  projectId,
  quoteId,
  mutationId,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: SaveRepairQuoteState, formData: FormData) => Promise<SaveRepairQuoteState>;
  projectId: string;
  quoteId: string;
  mutationId: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null as SaveRepairQuoteState);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);
  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      {state?.message ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mb-4 text-[14px] text-[#d2b8a8]">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

function OverrideForm({
  projectId,
  quoteId,
  mutationId,
}: {
  projectId: string;
  quoteId: string;
  mutationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    overrideSavedRepairQuote,
    null as SaveRepairQuoteState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Manual override
        </span>
        <input
          name="overrideAmount"
          inputMode="decimal"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Override reason
        </span>
        <input
          name="overrideReason"
          maxLength={240}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        />
      </label>
      {state?.message ? (
        <p ref={errorRef} tabIndex={-1} role="alert" className="text-[14px] text-[#d2b8a8]">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save override"}
      </button>
    </form>
  );
}
