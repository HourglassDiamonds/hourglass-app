"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import type { DigitalCard } from "@/lib/continuum/digital-card/types";
import { saveOwnerCard, type SaveOwnerCardState } from "../card/actions";
import { CardQr } from "./card-qr";

const FIELD_CLASS =
  "mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]";

function CheckRow({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="mt-4 flex min-h-11 items-center gap-3 text-[13px] text-[#c4b7aa]">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        value="true"
        className="h-4 w-4 accent-[#ad9164]"
      />
      {label}
    </label>
  );
}

export function MyCardForm({
  card,
  publicUrl = null,
}: {
  card: DigitalCard | null;
  publicUrl?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveOwnerCard,
    null as SaveOwnerCardState | null,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const nameId = useId();
  const memorableId = useId();
  const titleId = useId();
  const companyId = useId();
  const emailId = useId();
  const phoneId = useId();
  const websiteId = useId();
  const linkedinId = useId();
  const instagramId = useId();
  const avatarId = useId();
  const slugId = useId();

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  const extra = card?.additionalLinks ?? [];

  return (
    <form action={formAction} className="flex flex-col" noValidate>
      {publicUrl && card?.published ? (
        <div className="mb-10 flex flex-col items-center">
          <CardQr url={publicUrl} label="QR code for your public Continuum card" />
          <p className="mt-4 break-all text-center text-[13px] text-[#8d8073]">{publicUrl}</p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Preview public card
          </a>
        </div>
      ) : null}
      <label htmlFor={nameId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Full name
      </label>
      <input
        id={nameId}
        name="displayName"
        defaultValue={card?.displayName ?? ""}
        autoComplete="name"
        className={FIELD_CLASS}
      />

      <div className="mt-6">
        <label
          htmlFor={memorableId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Memorable title
        </label>
        <input
          id={memorableId}
          name="memorableTitle"
          defaultValue={card?.memorableTitle ?? ""}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={titleId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Professional title
        </label>
        <input
          id={titleId}
          name="professionalTitle"
          defaultValue={card?.professionalTitle ?? ""}
          autoComplete="organization-title"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={companyId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Company
        </label>
        <input
          id={companyId}
          name="company"
          defaultValue={card?.company ?? ""}
          autoComplete="organization"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label htmlFor={emailId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          defaultValue={card?.email ?? ""}
          autoComplete="email"
          className={FIELD_CLASS}
        />
        <CheckRow
          id={`${emailId}-public`}
          name="emailPublic"
          label="Show email on the public card"
          defaultChecked={card?.emailPublic ?? true}
        />
      </div>

      <div className="mt-6">
        <label htmlFor={phoneId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Phone
        </label>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          defaultValue={card?.phone ?? ""}
          autoComplete="tel"
          className={FIELD_CLASS}
        />
        <CheckRow
          id={`${phoneId}-public`}
          name="phonePublic"
          label="Show phone on the public card"
          defaultChecked={card?.phonePublic ?? true}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={websiteId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Website
        </label>
        <input
          id={websiteId}
          name="websiteUrl"
          type="url"
          defaultValue={card?.websiteUrl ?? ""}
          autoComplete="url"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={linkedinId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          LinkedIn
        </label>
        <input
          id={linkedinId}
          name="linkedinUrl"
          type="url"
          defaultValue={card?.linkedinUrl ?? ""}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={instagramId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Instagram
        </label>
        <input
          id={instagramId}
          name="instagramUrl"
          defaultValue={card?.instagramUrl ?? ""}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Additional links
        </p>
        {[0, 1].map((index) => (
          <div key={index} className="mt-4 grid grid-cols-1 gap-3">
            <input
              name={`link${index + 1}Label`}
              defaultValue={extra[index]?.label ?? ""}
              placeholder="Label"
              aria-label={`Additional link ${index + 1} label`}
              className={FIELD_CLASS}
            />
            <input
              name={`link${index + 1}Url`}
              defaultValue={extra[index]?.url ?? ""}
              placeholder="https://"
              aria-label={`Additional link ${index + 1} address`}
              className={FIELD_CLASS}
            />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <label htmlFor={avatarId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Portrait address
        </label>
        <input
          id={avatarId}
          name="avatarUrl"
          type="url"
          defaultValue={card?.avatarUrl ?? ""}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-6">
        <label htmlFor={slugId} className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Public address
        </label>
        <input
          id={slugId}
          name="slug"
          defaultValue={card?.slug ?? ""}
          className={FIELD_CLASS}
        />
        <p className="mt-2 text-[13px] leading-relaxed text-[#8d8073]">
          hourglassdiamonds.com/c/your-name
        </p>
      </div>

      <CheckRow
        id="published"
        name="published"
        label="Publish this card"
        defaultChecked={card?.published ?? false}
      />

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
          {pending ? "Saving???" : "Save card"}
        </button>
        <Link
          href={CONCIERGE_HOME_PATH}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
