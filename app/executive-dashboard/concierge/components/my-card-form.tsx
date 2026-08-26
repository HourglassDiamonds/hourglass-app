"use client";

import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import {
  MY_CARD_FIELD_ORDER,
  clientMyCardFieldErrors,
  myCardFormValuesFromFormData,
  resolveMyCardFormDisplay,
} from "@/lib/continuum/digital-card/form-state";
import type { DigitalCard, SaveDigitalCardField } from "@/lib/continuum/digital-card/types";
import { publicCardAbsoluteUrl } from "@/lib/continuum/digital-card/origin";
import { saveOwnerCard, type SaveOwnerCardState } from "../card/actions";
import { CardQr } from "./card-qr";

const FIELD_CLASS =
  "mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]";
const FIELD_INVALID_CLASS =
  "mt-3 min-h-12 w-full rounded-[18px] border border-[#c9896a]/80 bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#c9896a] focus-visible:shadow-[0_0_0_3px_rgba(201,137,106,0.28)]";

function fieldClass(invalid: boolean): string {
  return invalid ? FIELD_INVALID_CLASS : FIELD_CLASS;
}

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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-[13px] leading-relaxed text-[#d2b8a8]">
      {message}
    </p>
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
  const [clientErrors, setClientErrors] = useState(state?.fieldErrors ?? {});
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
  const link1LabelId = useId();
  const link1UrlId = useId();
  const link2LabelId = useId();
  const link2UrlId = useId();
  const websiteErrorId = useId();
  const linkedinErrorId = useId();
  const instagramErrorId = useId();
  const avatarErrorId = useId();
  const slugErrorId = useId();
  const nameErrorId = useId();
  const memorableErrorId = useId();
  const titleErrorId = useId();
  const companyErrorId = useId();
  const emailErrorId = useId();
  const phoneErrorId = useId();
  const link1LabelErrorId = useId();
  const link1UrlErrorId = useId();
  const link2LabelErrorId = useId();
  const link2UrlErrorId = useId();

  const display = resolveMyCardFormDisplay({
    card: state?.status === "saved" ? state.card : card,
    status: state?.status ?? null,
    submitted: state?.status === "error" ? state.values : null,
    fieldErrors: state?.status === "error" ? state.fieldErrors : clientErrors,
    message: state?.message ?? null,
    savedAt: state?.status === "saved" ? state.card.updatedAt : null,
  });
  const fieldErrors =
    state?.status === "error"
      ? state.fieldErrors
      : Object.keys(clientErrors).length
        ? clientErrors
        : {};
  const values = display.values;
  const shownCard = state?.status === "saved" ? state.card : card;
  const shownPublicUrl = shownCard?.published
    ? shownCard.slug === card?.slug && publicUrl
      ? publicUrl
      : publicCardAbsoluteUrl(shownCard.slug)
    : null;
  const errorSignature = `${display.formKey}:${MY_CARD_FIELD_ORDER.filter((field) => fieldErrors[field]).join(",")}`;
  const summary =
    display.summary ??
    (Object.keys(fieldErrors).length > 0 ? "Check the highlighted fields." : null);
  const firstInvalid = MY_CARD_FIELD_ORDER.find((field) => fieldErrors[field]) ?? null;

  useEffect(() => {
    const map: Record<SaveDigitalCardField, string> = {
      displayName: nameId,
      memorableTitle: memorableId,
      professionalTitle: titleId,
      company: companyId,
      email: emailId,
      phone: phoneId,
      websiteUrl: websiteId,
      linkedinUrl: linkedinId,
      instagramUrl: instagramId,
      avatarUrl: avatarId,
      slug: slugId,
      published: "published",
      emailPublic: `${emailId}-public`,
      phonePublic: `${phoneId}-public`,
      link1Label: link1LabelId,
      link1Url: link1UrlId,
      link2Label: link2LabelId,
      link2Url: link2UrlId,
    };
    if (firstInvalid) {
      const node = document.getElementById(map[firstInvalid]);
      node?.focus();
      node?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (display.summary) errorRef.current?.focus();
  }, [
    firstInvalid,
    errorSignature,
    display.summary,
    nameId,
    memorableId,
    titleId,
    companyId,
    emailId,
    phoneId,
    websiteId,
    linkedinId,
    instagramId,
    avatarId,
    slugId,
    link1LabelId,
    link1UrlId,
    link2LabelId,
    link2UrlId,
  ]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitted = myCardFormValuesFromFormData(new FormData(event.currentTarget));
    const errors = clientMyCardFieldErrors(submitted);
    if (Object.keys(errors).length > 0) {
      event.preventDefault();
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
  }

  return (
    <form
      key={display.formKey}
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col"
      noValidate
    >
      {shownPublicUrl && shownCard?.published ? (
        <div className="mb-8 flex flex-col items-center">
          <CardQr
            url={shownPublicUrl}
            label="QR code for your public Continuum card"
            previewHref={shownPublicUrl}
          />
        </div>
      ) : null}
      <div
        className={
          shownPublicUrl && shownCard?.published
            ? "border-t border-white/[0.08] pt-8"
            : undefined
        }
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">Card Details</p>
        <p className="mt-2 max-w-[22.5rem] text-[14px] leading-relaxed text-[#c4b7aa]">
          Update the information people see when they open your card.
        </p>
      </div>
      <label htmlFor={nameId} className="mt-6 text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
        Full name
      </label>
      <input
        id={nameId}
        name="displayName"
        defaultValue={values.displayName}
        autoComplete="name"
        aria-invalid={Boolean(fieldErrors.displayName)}
        aria-describedby={fieldErrors.displayName ? nameErrorId : undefined}
        className={fieldClass(Boolean(fieldErrors.displayName))}
      />
      <FieldError id={nameErrorId} message={fieldErrors.displayName} />

      <div className="mt-6">
        <label
          htmlFor={memorableId}
          className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]"
        >
          Memorable title
        </label>
        <input
          id={memorableId}
          name="memorableTitle"
          defaultValue={values.memorableTitle}
          aria-invalid={Boolean(fieldErrors.memorableTitle)}
          aria-describedby={fieldErrors.memorableTitle ? memorableErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.memorableTitle))}
        />
        <FieldError id={memorableErrorId} message={fieldErrors.memorableTitle} />
      </div>

      <div className="mt-6">
        <label
          htmlFor={titleId}
          className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]"
        >
          Professional title
        </label>
        <input
          id={titleId}
          name="professionalTitle"
          defaultValue={values.professionalTitle}
          autoComplete="organization-title"
          aria-invalid={Boolean(fieldErrors.professionalTitle)}
          aria-describedby={fieldErrors.professionalTitle ? titleErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.professionalTitle))}
        />
        <FieldError id={titleErrorId} message={fieldErrors.professionalTitle} />
      </div>

      <div className="mt-6">
        <label
          htmlFor={companyId}
          className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]"
        >
          Company
        </label>
        <input
          id={companyId}
          name="company"
          defaultValue={values.company}
          autoComplete="organization"
          aria-invalid={Boolean(fieldErrors.company)}
          aria-describedby={fieldErrors.company ? companyErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.company))}
        />
        <FieldError id={companyErrorId} message={fieldErrors.company} />
      </div>

      <div className="mt-6">
        <label htmlFor={emailId} className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          defaultValue={values.email}
          autoComplete="email"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.email))}
        />
        <FieldError id={emailErrorId} message={fieldErrors.email} />
        <CheckRow
          id={`${emailId}-public`}
          name="emailPublic"
          label="Show email on the public card"
          defaultChecked={values.emailPublic}
        />
      </div>

      <div className="mt-6">
        <label htmlFor={phoneId} className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
          Phone
        </label>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          defaultValue={values.phone}
          autoComplete="tel"
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? phoneErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.phone))}
        />
        <FieldError id={phoneErrorId} message={fieldErrors.phone} />
        <CheckRow
          id={`${phoneId}-public`}
          name="phonePublic"
          label="Show phone on the public card"
          defaultChecked={values.phonePublic}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={websiteId}
          className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]"
        >
          Website
        </label>
        <input
          id={websiteId}
          name="websiteUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={values.websiteUrl}
          autoComplete="url"
          aria-invalid={Boolean(fieldErrors.websiteUrl)}
          aria-describedby={fieldErrors.websiteUrl ? websiteErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.websiteUrl))}
        />
        <FieldError id={websiteErrorId} message={fieldErrors.websiteUrl} />
      </div>

      <div className="mt-6">
        <label
          htmlFor={linkedinId}
          className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]"
        >
          LinkedIn
        </label>
        <input
          id={linkedinId}
          name="linkedinUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={values.linkedinUrl}
          aria-invalid={Boolean(fieldErrors.linkedinUrl)}
          aria-describedby={fieldErrors.linkedinUrl ? linkedinErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.linkedinUrl))}
        />
        <FieldError id={linkedinErrorId} message={fieldErrors.linkedinUrl} />
      </div>

      <div className="mt-6">
        <label
          htmlFor={instagramId}
          className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]"
        >
          Instagram
        </label>
        <input
          id={instagramId}
          name="instagramUrl"
          inputMode="url"
          placeholder="@handle or https://"
          defaultValue={values.instagramUrl}
          aria-invalid={Boolean(fieldErrors.instagramUrl)}
          aria-describedby={fieldErrors.instagramUrl ? instagramErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.instagramUrl))}
        />
        <FieldError id={instagramErrorId} message={fieldErrors.instagramUrl} />
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
          Additional links
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            id={link1LabelId}
            name="link1Label"
            defaultValue={values.link1Label}
            placeholder="Label"
            aria-label="Additional link 1 label"
            aria-invalid={Boolean(fieldErrors.link1Label)}
            aria-describedby={fieldErrors.link1Label ? link1LabelErrorId : undefined}
            className={fieldClass(Boolean(fieldErrors.link1Label))}
          />
          <FieldError id={link1LabelErrorId} message={fieldErrors.link1Label} />
          <input
            id={link1UrlId}
            name="link1Url"
            type="url"
            inputMode="url"
            defaultValue={values.link1Url}
            placeholder="https://"
            aria-label="Additional link 1 address"
            aria-invalid={Boolean(fieldErrors.link1Url)}
            aria-describedby={fieldErrors.link1Url ? link1UrlErrorId : undefined}
            className={fieldClass(Boolean(fieldErrors.link1Url))}
          />
          <FieldError id={link1UrlErrorId} message={fieldErrors.link1Url} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            id={link2LabelId}
            name="link2Label"
            defaultValue={values.link2Label}
            placeholder="Label"
            aria-label="Additional link 2 label"
            aria-invalid={Boolean(fieldErrors.link2Label)}
            aria-describedby={fieldErrors.link2Label ? link2LabelErrorId : undefined}
            className={fieldClass(Boolean(fieldErrors.link2Label))}
          />
          <FieldError id={link2LabelErrorId} message={fieldErrors.link2Label} />
          <input
            id={link2UrlId}
            name="link2Url"
            type="url"
            inputMode="url"
            defaultValue={values.link2Url}
            placeholder="https://"
            aria-label="Additional link 2 address"
            aria-invalid={Boolean(fieldErrors.link2Url)}
            aria-describedby={fieldErrors.link2Url ? link2UrlErrorId : undefined}
            className={fieldClass(Boolean(fieldErrors.link2Url))}
          />
          <FieldError id={link2UrlErrorId} message={fieldErrors.link2Url} />
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor={avatarId} className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
          Portrait address
        </label>
        <input
          id={avatarId}
          name="avatarUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={values.avatarUrl}
          aria-invalid={Boolean(fieldErrors.avatarUrl)}
          aria-describedby={fieldErrors.avatarUrl ? avatarErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.avatarUrl))}
        />
        <FieldError id={avatarErrorId} message={fieldErrors.avatarUrl} />
      </div>

      <div className="mt-6">
        <label htmlFor={slugId} className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
          Public address
        </label>
        <input
          id={slugId}
          name="slug"
          defaultValue={values.slug}
          aria-invalid={Boolean(fieldErrors.slug)}
          aria-describedby={fieldErrors.slug ? slugErrorId : undefined}
          className={fieldClass(Boolean(fieldErrors.slug))}
        />
        <FieldError id={slugErrorId} message={fieldErrors.slug} />
        <p className="mt-2 text-[13px] leading-relaxed text-[#8d8073]">
          hourglassdiamonds.com/c/your-name
        </p>
      </div>

      <CheckRow
        id="published"
        name="published"
        label="Publish this card"
        defaultChecked={values.published}
      />

      {summary ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="status"
          className={`mt-6 text-[14px] leading-relaxed outline-none ${
            display.saved ? "text-[#c4b7aa]" : "text-[#d2b8a8]"
          }`}
        >
          {summary}
        </p>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.12em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save card"}
        </button>
        <Link
          href={CONCIERGE_HOME_PATH}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.12em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
