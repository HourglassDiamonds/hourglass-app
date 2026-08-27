"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import {
  saveProjectSpecCorrection,
  type SaveProjectSpecCorrectionState,
} from "../actions";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";

export function CorrectProjectSpecForm({
  projectId,
  projectTitle,
  fieldName,
  fieldLabel,
  currentValue,
  currentSourceLabel,
  mutationId,
}: {
  projectId: string;
  projectTitle: string;
  fieldName: string;
  fieldLabel: string;
  currentValue: string;
  currentSourceLabel: string | null;
  mutationId: string;
}) {
  const valueFieldId = useId();
  const [state, formAction, pending] = useActionState(
    saveProjectSpecCorrection,
    null as SaveProjectSpecCorrectionState | null,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const multiline = fieldName === "diamond_supply_notes";

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="fieldName" value={fieldName} />
      <input type="hidden" name="mutationId" value={mutationId} />

      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {fieldLabel}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[#e7ddd2]">
        Current: {currentValue || "—"}
      </p>
      {currentSourceLabel ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[#8d8073]">
          {currentSourceLabel}
        </p>
      ) : null}

      <div className="mt-8 flex-1">
        <label
          htmlFor={valueFieldId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          New value
        </label>
        {multiline ? (
          <textarea
            id={valueFieldId}
            name="newValue"
            required
            maxLength={2000}
            rows={6}
            className="mt-3 min-h-[8rem] w-full resize-y rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 py-3 text-[16px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          />
        ) : (
          <input
            id={valueFieldId}
            name="newValue"
            required
            maxLength={
              fieldName === "finger_size"
                ? 8
                : fieldName === "metal" || fieldName === "center_stone"
                  ? 120
                  : 64
            }
            inputMode={fieldName === "finger_size" ? "decimal" : "text"}
            autoComplete="off"
            className="mt-3 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 py-3 text-[16px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          />
        )}
      </div>

      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save correction"}
        </button>
        <Link
          href={conciergeProjectPath(projectId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
