"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  saveManualBirthday,
  type SaveManualBirthdayState,
} from "../actions";
import {
  conciergeClientPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { MONTH_NAMES } from "@/lib/continuum/client-memory/facts/types";

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function AddBirthdayForm({
  personId,
  personName,
  submissionId,
  replacing,
  initialMonth,
  initialDay,
  initialYear,
}: {
  personId: string;
  personName: string;
  submissionId: string;
  replacing: boolean;
  initialMonth: number | null;
  initialDay: number | null;
  initialYear: number | null;
}) {
  const monthId = useId();
  const dayId = useId();
  const yearId = useId();
  const [state, formAction, pending] = useActionState(
    saveManualBirthday,
    null as SaveManualBirthdayState | null,
  );
  const [month, setMonth] = useState(initialMonth == null ? "" : String(initialMonth));
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="submissionId" value={submissionId} />

      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {replacing ? "Editing birthday for" : "Adding birthday for"}
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-[#c4b7aa]">{personName}</p>

      <div className="mt-8">
        <label
          htmlFor={monthId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Month
        </label>
        <select
          id={monthId}
          name="month"
          required
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          <option value="">Select month</option>
          {MONTH_NAMES.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <label
          htmlFor={dayId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Day
        </label>
        <select
          id={dayId}
          name="day"
          defaultValue={initialDay == null ? "" : String(initialDay)}
          className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          <option value="">Unknown</option>
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <label
          htmlFor={yearId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Year
        </label>
        <input
          id={yearId}
          name="year"
          type="number"
          inputMode="numeric"
          min={1800}
          max={2100}
          defaultValue={initialYear == null ? "" : String(initialYear)}
          placeholder="Unknown"
          className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </div>

      {replacing ? (
        <p className="mt-8 text-[14px] leading-relaxed text-[#9a8e82]">
          Saving will replace the current birthday on record.
        </p>
      ) : null}

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
          disabled={pending || !month}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Birthday"}
        </button>
        <Link
          href={conciergeClientPath(personId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
