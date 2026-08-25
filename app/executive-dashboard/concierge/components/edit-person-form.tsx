"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import {
  savePersonProfile,
  type SavePersonProfileState,
} from "../actions";
import { conciergeClientPath } from "@/lib/continuum/client-memory/read/presentation";

const FIELD_CLASS =
  "mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]";

export function EditPersonForm({
  personId,
  submissionId,
  initialGivenName,
  initialFamilyName,
  initialEmail,
  initialPhone,
  initialOrganization,
}: {
  personId: string;
  submissionId: string;
  initialGivenName: string;
  initialFamilyName: string;
  initialEmail: string;
  initialPhone: string;
  initialOrganization: string;
}) {
  const givenId = useId();
  const familyId = useId();
  const emailId = useId();
  const phoneId = useId();
  const organizationId = useId();
  const [state, formAction, pending] = useActionState(
    savePersonProfile,
    null as SavePersonProfileState | null,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="submissionId" value={submissionId} />

      <div>
        <label
          htmlFor={givenId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          First name
        </label>
        <input
          id={givenId}
          name="givenName"
          autoComplete="given-name"
          enterKeyHint="next"
          defaultValue={initialGivenName}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={familyId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Last name
        </label>
        <input
          id={familyId}
          name="familyName"
          autoComplete="family-name"
          enterKeyHint="next"
          defaultValue={initialFamilyName}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={emailId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          defaultValue={initialEmail}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={phoneId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Phone
        </label>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="next"
          defaultValue={initialPhone}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={organizationId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Organization
        </label>
        <input
          id={organizationId}
          name="organization"
          autoComplete="organization"
          enterKeyHint="done"
          defaultValue={initialOrganization}
          className={FIELD_CLASS}
        />
      </div>

      {state?.message ? (
        <div className="mt-6">
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
          >
            {state.message}
          </p>
          {state.conflictingPersonIds && state.conflictingPersonIds.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {state.conflictingPersonIds.map((id) => (
                <li key={id}>
                  <Link
                    href={conciergeClientPath(id)}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                  >
                    View person
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Changes"}
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
