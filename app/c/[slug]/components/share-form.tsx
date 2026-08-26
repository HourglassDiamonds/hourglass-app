"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  shareDigitalCardContact,
  type ShareDigitalCardState,
} from "../actions";

const FIELD_CLASS =
  "mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]";

export function ShareYourInfoForm({
  slug,
  submissionId,
  contextToken,
}: {
  slug: string;
  submissionId: string;
  contextToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const companyId = useId();
  const titleId = useId();
  const consentId = useId();
  const [state, formAction, pending] = useActionState(
    shareDigitalCardContact,
    null as ShareDigitalCardState | null,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  if (state?.ok) {
    return (
      <p
        role="status"
        className="rounded-[18px] border border-white/[0.08] px-4 py-4 text-center text-[15px] leading-relaxed text-[#c4b7aa]"
      >
        Thank you. Your details were received.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-[18px] border border-white/[0.1] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164]/60 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
      >
        Share Your Info
      </button>
    );
  }

  return (
    <form action={formAction} className="text-left" noValidate>
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="slug" value={slug} />
      {contextToken ? (
        <input type="hidden" name="contextToken" value={contextToken} />
      ) : null}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${nameId}-website`}>Company website</label>
        <input
          id={`${nameId}-website`}
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-[1.35rem] tracking-[-0.03em] text-[#efe8de] outline-none"
      >
        Share your info
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#c4b7aa]">
        A short exchange ??? name, and a number or email if you like.
      </p>

      <div className="mt-6">
        <label htmlFor={nameId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Name
        </label>
        <input
          id={nameId}
          name="name"
          autoComplete="name"
          required
          enterKeyHint="next"
          className={FIELD_CLASS}
        />
      </div>
      <div className="mt-5">
        <label htmlFor={phoneId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Mobile
        </label>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          enterKeyHint="next"
          className={FIELD_CLASS}
        />
      </div>
      <div className="mt-5">
        <label htmlFor={emailId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          className={FIELD_CLASS}
        />
      </div>
      <div className="mt-5">
        <label
          htmlFor={companyId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Company
        </label>
        <input
          id={companyId}
          name="company"
          autoComplete="organization"
          enterKeyHint="next"
          className={FIELD_CLASS}
        />
      </div>
      <div className="mt-5">
        <label htmlFor={titleId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Job title
        </label>
        <input
          id={titleId}
          name="jobTitle"
          autoComplete="organization-title"
          enterKeyHint="done"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <input
          id={consentId}
          name="consent"
          type="checkbox"
          value="true"
          className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-[#1d1916] accent-[#ad9164]"
        />
        <label htmlFor={consentId} className="text-[13px] leading-relaxed text-[#c4b7aa]">
          I agree to share my professional contact details privately with this
          person through Continuum. They will be kept as a relationship record,
          not published.
        </label>
      </div>

      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Sending???" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
