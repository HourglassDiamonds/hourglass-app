"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ConditionalHoldRecord } from "@/lib/continuum/sterling/holds/types";
import { manageConditionalHoldAction } from "../conditional-hold-actions";

function HoldSubmit({
  action,
  label,
  pendingLabel,
  emphasis = false,
}: {
  action: "resume" | "keep" | "cancel";
  label: string;
  pendingLabel: string;
  emphasis?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      name="holdAction"
      value={action}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex min-h-11 items-center rounded-full px-3 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[#ad9164]/60 disabled:opacity-50 ${
        emphasis
          ? "bg-[#ad9164] text-[#17120e]"
          : "text-[#a99b8d] hover:text-[#efe8de]"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function HoldActionForm({
  holdId,
  action,
  label,
  pendingLabel,
  emphasis,
}: {
  holdId: string;
  action: "resume" | "keep" | "cancel";
  label: string;
  pendingLabel: string;
  emphasis?: boolean;
}) {
  return (
    <form action={manageConditionalHoldAction}>
      <input type="hidden" name="holdId" value={holdId} />
      <HoldSubmit
        action={action}
        label={label}
        pendingLabel={pendingLabel}
        emphasis={emphasis}
      />
    </form>
  );
}

export function ConditionalHoldControls({
  hold,
  conditionMet,
}: {
  hold: ConditionalHoldRecord;
  conditionMet: boolean;
}) {
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
      <HoldActionForm
        holdId={hold.holdId}
        action="resume"
        label={conditionMet ? "Resume" : "Resume now"}
        pendingLabel="Resuming…"
        emphasis={conditionMet}
      />
      {conditionMet ? (
        <HoldActionForm
          holdId={hold.holdId}
          action="keep"
          label="Keep holding"
          pendingLabel="Holding…"
        />
      ) : null}
      <Link
        href={`/executive-dashboard/concierge/ask?q=${encodeURIComponent(`Edit the hold on job ${hold.entityId}`)}`}
        className="inline-flex min-h-11 items-center px-3 text-[11px] text-[#a99b8d] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        Edit
      </Link>
      <HoldActionForm
        holdId={hold.holdId}
        action="cancel"
        label="Dismiss"
        pendingLabel="Dismissing…"
      />
    </div>
  );
}
