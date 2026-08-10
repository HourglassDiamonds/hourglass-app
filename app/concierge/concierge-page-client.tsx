"use client";

import Link from "next/link";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  attributionToFormFields,
  captureAttributionFromLocation,
  getAttributionSnapshot,
  recordOriginatingTool,
} from "@/lib/attribution";
import {
  leadEventParamsFromForm,
  trackConciergeFormError,
  trackConciergeFormStarted,
  trackConciergeFormSubmitted,
  trackGenerateLead,
} from "@/lib/concierge/analytics";
import {
  CONCIERGE_CTA_LABEL,
  CONCIERGE_FORM_FIELD_NAMES,
  CONCIERGE_OPTION_VALUES,
  CONCIERGE_VISIBLE_COPY,
  buildConciergeSummary,
  contextualReassuranceForSelection,
  type ConciergeContextualField,
} from "@/lib/concierge/conversational-copy";
import { diamondIntelligencePrefillFromSearchParams } from "@/lib/concierge/diamond-intelligence-context";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";

const SUCCESS_STORAGE_KEY = "hg_concierge_success_v1";
const STARTED_STORAGE_KEY = "hg_concierge_started_v1";

type SubmitState = "idle" | "submitting" | "success" | "error";

const DEFAULTS = {
  projectType: "Still Exploring",
  shape: "Not Sure Yet",
  direction: "Still Discovering",
  presence: "Still Exploring",
  timeline: "Flexible",
  budget: "Prefer to Discuss",
  preferredContact: "Email",
} as const;

const copy = CONCIERGE_VISIBLE_COPY;

function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasSessionFlag(key: string): boolean {
  try {
    return Boolean(sessionStorage.getItem(key));
  } catch {
    return false;
  }
}

function setSessionFlag(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function clearSessionFlag(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export default function ConciergeFormClient() {
  const searchParams = useSearchParams();
  const formId = useId();
  const notesPrefilled = useRef(false);
  const formStarted = useRef(false);
  const leadTracked = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const [submissionId, setSubmissionId] = useState(createSubmissionId);

  const [inspirationNotes, setInspirationNotes] = useState("");
  const [projectType, setProjectType] = useState<string>(DEFAULTS.projectType);
  const [shape, setShape] = useState<string>(DEFAULTS.shape);
  const [direction, setDirection] = useState<string>(DEFAULTS.direction);
  const [presence, setPresence] = useState<string>(DEFAULTS.presence);
  const [timeline, setTimeline] = useState<string>(DEFAULTS.timeline);
  const [budget, setBudget] = useState<string>(DEFAULTS.budget);
  const [preferredContact, setPreferredContact] = useState<string>(
    DEFAULTS.preferredContact,
  );
  const [contextualNotes, setContextualNotes] = useState<
    Partial<Record<ConciergeContextualField, string>>
  >({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [formMessage, setFormMessage] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    captureAttributionFromLocation(
      typeof window !== "undefined" ? window.location.pathname : "/concierge",
      searchParams.toString(),
    );

    const source = searchParams.get("source");
    if (source) {
      recordOriginatingTool(source);
    }

    try {
      if (hasSessionFlag(SUCCESS_STORAGE_KEY)) {
        setSubmitState("success");
        leadTracked.current = true;
      }
      if (hasSessionFlag(STARTED_STORAGE_KEY)) {
        formStarted.current = true;
      }
    } catch {
      /* private mode */
    }
  }, [searchParams]);

  useEffect(() => {
    if (submitState !== "success") return;
    successHeadingRef.current?.focus();
  }, [submitState]);

  useEffect(() => {
    if (notesPrefilled.current) return;
    const prefill = diamondIntelligencePrefillFromSearchParams(searchParams);
    if (!prefill) return;
    setInspirationNotes((current) => (current.trim() ? current : prefill));
    notesPrefilled.current = true;
  }, [searchParams]);

  const activePill =
    "inline-flex min-h-[44px] items-center rounded-full border border-[#2b2723] bg-[#2b2723] px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(43,39,35,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory";
  const pill =
    "inline-flex min-h-[44px] items-center rounded-full border border-[#ddd1c2] bg-white/82 px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] text-[#6f665d] transition duration-200 hover:border-[#ccbda9] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory";

  const summary = useMemo(
    () =>
      buildConciergeSummary({
        projectType,
        shape,
        direction,
        presence,
      }),
    [projectType, shape, direction, presence],
  );

  function normalizePreferredContact(value: string) {
    if (value === "Any Is Fine") return "any";
    return value.toLowerCase();
  }

  function markFormStarted() {
    if (formStarted.current || hasSessionFlag(STARTED_STORAGE_KEY)) {
      formStarted.current = true;
      return;
    }
    formStarted.current = true;
    setSessionFlag(STARTED_STORAGE_KEY, "1");
    trackConciergeFormStarted();
  }

  function updateContextualNote(
    field: ConciergeContextualField,
    value: string,
  ) {
    const note = contextualReassuranceForSelection(field, value);
    setContextualNotes((current) => {
      if (!note) {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      }
      if (current[field] === note) return current;
      return { ...current, [field]: note };
    });
  }

  function resetForAnotherInquiry() {
    clearSessionFlag(SUCCESS_STORAGE_KEY);
    leadTracked.current = false;
    setSubmissionId(createSubmissionId());
    setSubmitState("idle");
    setFormMessage("");
    setFieldErrors({});
    setFullName("");
    setEmail("");
    setPhone("");
    setInspirationNotes("");
    setProjectType(DEFAULTS.projectType);
    setShape(DEFAULTS.shape);
    setDirection(DEFAULTS.direction);
    setPresence(DEFAULTS.presence);
    setTimeline(DEFAULTS.timeline);
    setBudget(DEFAULTS.budget);
    setPreferredContact(DEFAULTS.preferredContact);
    setContextualNotes({});
  }

  function validateClient(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) {
      errors.fullName = "Please enter your name.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    const method = normalizePreferredContact(preferredContact);
    if ((method === "phone" || method === "text") && phone.trim().length < 7) {
      errors.phone =
        "Please enter a phone number so we can reach you that way.";
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState === "submitting" || submitState === "success") return;

    const errors = validateClient();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0] || "Please check the form.";
      setSubmitState("error");
      setFormMessage(first);
      trackConciergeFormError("validation");
      queueMicrotask(() => statusRef.current?.focus());
      return;
    }

    setSubmitState("submitting");
    setFormMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const attribution = getAttributionSnapshot();
      const attributionFields = attributionToFormFields(attribution);
      for (const [key, value] of Object.entries(attributionFields)) {
        formData.set(key, value);
      }

      formData.set(CONCIERGE_FORM_FIELD_NAMES.projectType, projectType);
      formData.set(CONCIERGE_FORM_FIELD_NAMES.shapeInterest, shape);
      formData.set(CONCIERGE_FORM_FIELD_NAMES.designDirection, direction);
      formData.set(CONCIERGE_FORM_FIELD_NAMES.ringPresence, presence);
      formData.set(CONCIERGE_FORM_FIELD_NAMES.timeline, timeline);
      formData.set(CONCIERGE_FORM_FIELD_NAMES.budgetRange, budget);
      formData.set(
        CONCIERGE_FORM_FIELD_NAMES.preferredContactMethod,
        normalizePreferredContact(preferredContact),
      );
      formData.set(CONCIERGE_FORM_FIELD_NAMES.submissionId, submissionId);
      formData.set(CONCIERGE_FORM_FIELD_NAMES.fullName, fullName.trim());
      formData.set(CONCIERGE_FORM_FIELD_NAMES.email, email.trim());
      formData.set(CONCIERGE_FORM_FIELD_NAMES.phone, phone.trim());
      formData.set(CONCIERGE_FORM_FIELD_NAMES.inspirationNotes, inspirationNotes);

      const response = await fetch("/api/concierge", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        ok: boolean;
        accepted?: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ||
            "We couldn’t send your note just now. Please try again, or contact us directly.",
        );
      }

      // Soft accepts (honeypot) look successful to bots but must not fire lead events.
      // Omitted `accepted` is treated as not accepted — never as a conversion.
      const accepted = data.accepted === true;

      if (accepted && !leadTracked.current) {
        const source =
          attribution.originating_tool ||
          attribution.utm_source ||
          "concierge_page";
        const leadParams = leadEventParamsFromForm({
          projectType,
          budget,
          timeline,
          attribution,
          source,
        });
        leadTracked.current = true;
        trackConciergeFormSubmitted(leadParams);
        trackGenerateLead(leadParams);
        setSessionFlag(SUCCESS_STORAGE_KEY, submissionId);
      }

      setSubmitState("success");
      setFormMessage("");
      setFieldErrors({});
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn’t send your note just now. Please try again, or contact us directly.";
      setSubmitState("error");
      setFormMessage(message);
      trackConciergeFormError("submit");
      queueMicrotask(() => statusRef.current?.focus());
    }
  }

  const PillRow = ({
    legend,
    options,
    value,
    setValue,
    groupName,
    contextualField,
  }: {
    legend: string;
    options: readonly string[];
    value: string;
    setValue: (value: string) => void;
    groupName: string;
    contextualField?: ConciergeContextualField;
  }) => (
    <fieldset className="mt-2.5 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2.5" role="group" aria-label={legend}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                markFormStarted();
                setValue(option);
                if (contextualField) {
                  updateContextualNote(contextualField, option);
                }
              }}
              className={selected ? activePill : pill}
            >
              {option}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={groupName} value={value} readOnly />
    </fieldset>
  );

  const sectionLabel =
    "text-[10px] uppercase tracking-[0.32em] text-[#6d655e]";
  const fieldLabel =
    "text-[11px] tracking-[0.02em] text-[#6d655e] md:text-[12px] md:leading-snug";
  const fieldLabelUpper =
    "text-[11px] uppercase tracking-[0.28em] text-[#6d655e]";
  const helperText = "mt-2 max-w-[36rem] text-[12px] leading-5 text-[#6d655e]";
  const contextualText =
    "mt-2 max-w-[32rem] text-[12px] leading-5 text-[#6d655e]";
  const inputClass =
    "mt-2.5 w-full rounded-[18px] border border-[#ddd4c9] bg-white/78 px-4 py-3.5 text-sm text-[#3c3834] outline-none placeholder:text-[#6d655e] focus-visible:border-hg-focus focus-visible:ring-2 focus-visible:ring-hg-focus";
  const inputInvalidClass =
    "mt-2.5 w-full rounded-[18px] border border-[#c9897c] bg-white/78 px-4 py-3.5 text-sm text-[#3c3834] outline-none placeholder:text-[#6d655e] focus-visible:ring-2 focus-visible:ring-[#c9897c]/50";

  if (submitState === "success") {
    return (
      <div
        className="mx-auto mt-8 max-w-[980px] rounded-[28px] border border-[#e4dbcf] bg-white/52 p-6 shadow-[0_18px_46px_rgba(45,35,26,0.03)] md:mt-10 md:p-10"
        role="status"
        aria-live="polite"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#6d655e]">
          Received
        </p>
        <h2
          ref={successHeadingRef}
          tabIndex={-1}
          className="mt-3 text-[1.35rem] tracking-[-0.02em] text-[#1f1d1a] outline-none"
        >
          Your inquiry was received.
        </h2>
        <p className="mt-4 max-w-[36rem] text-[15px] leading-7 text-[#6a635c]">
          Justin personally reviews every Concierge request. You can expect a
          thoughtful reply within 24 hours.
        </p>
        <p className="mt-4 max-w-[36rem] text-[14px] leading-7 text-[#6d655e]">
          There is nothing more you need to do for now. When you are ready,
          continue exploring the Diamond Guide.
        </p>
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            href="/diamond-guide"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#2b2723] bg-[#2b2723] px-7 py-3 text-sm tracking-wide text-white transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory"
          >
            Return to the Diamond Guide
          </Link>
          <button
            type="button"
            onClick={resetForAnotherInquiry}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#d6ccc0] bg-transparent px-5 py-3 text-[13px] tracking-wide text-[#6f665d] transition hover:border-[#cbbda9] hover:text-[#1f1d1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory"
          >
            Start another inquiry
          </button>
        </div>
      </div>
    );
  }

  const nameErrorId = `${formId}-name-error`;
  const emailErrorId = `${formId}-email-error`;
  const phoneErrorId = `${formId}-phone-error`;
  const statusId = `${formId}-status`;
  const summaryId = `${formId}-summary`;
  const phoneRequired =
    preferredContact === "Phone" || preferredContact === "Text";
  const showEngagementTimelineHelper = projectType === "Engagement Ring";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto mt-8 max-w-[980px] rounded-[28px] border border-[#e4dbcf] bg-white/52 p-6 shadow-[0_18px_46px_rgba(45,35,26,0.03)] md:mt-10 md:p-8"
    >
      {/* Honeypot — excluded from a11y tree and keyboard order; bots may still fill it. */}
      <input
        name="company_website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        hidden
        aria-hidden="true"
      />

      <div className="border-b border-[#e8dfd4] pb-7 md:pb-8">
        <div className={sectionLabel}>{copy.whatHappensNext.heading}</div>
        <p className="mt-2.5 max-w-[34rem] text-[13px] leading-6 text-[#6d655e] md:text-[14px] md:leading-7">
          {copy.whatHappensNext.body}
        </p>
      </div>

      <div className="mt-7">
        <div className={sectionLabel}>{copy.opening.sectionLabel}</div>
        <h2 className="mt-1.5 text-[1.05rem] tracking-[-0.02em] text-[#1f1d1a]">
          {copy.opening.sectionTitle}
        </h2>

        <div className="mt-5 space-y-5">
          <div>
            <div className={fieldLabel} id={`${formId}-project-label`}>
              {copy.opening.projectType}
            </div>
            <PillRow
              legend={copy.opening.projectType}
              groupName="projectTypeDisplay"
              options={CONCIERGE_OPTION_VALUES.projectTypes}
              value={projectType}
              setValue={setProjectType}
              contextualField="projectType"
            />
            {contextualNotes.projectType ? (
              <p className={contextualText} aria-live="polite">
                {contextualNotes.projectType}
              </p>
            ) : null}
          </div>

          <div>
            <div className={fieldLabel}>{copy.opening.shapeInterest}</div>
            <PillRow
              legend={copy.opening.shapeInterest}
              groupName="shapeInterestDisplay"
              options={CONCIERGE_OPTION_VALUES.shapes}
              value={shape}
              setValue={setShape}
              contextualField="shape"
            />
            {contextualNotes.shape ? (
              <p className={contextualText} aria-live="polite">
                {contextualNotes.shape}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-7 border-t border-[#e8dfd4] pt-7">
        <div className={sectionLabel}>{copy.design.sectionLabel}</div>
        <h2 className="mt-1.5 text-[1.05rem] tracking-[-0.02em] text-[#1f1d1a]">
          {copy.design.sectionTitle}
        </h2>

        <div className="mt-5 space-y-5">
          <div>
            <div className={fieldLabel}>{copy.design.designDirection}</div>
            <PillRow
              legend={copy.design.designDirection}
              groupName="designDirectionDisplay"
              options={CONCIERGE_OPTION_VALUES.directions}
              value={direction}
              setValue={setDirection}
            />
          </div>

          <div>
            <div className={fieldLabel}>{copy.design.ringPresence}</div>
            <PillRow
              legend={copy.design.ringPresence}
              groupName="ringPresenceDisplay"
              options={CONCIERGE_OPTION_VALUES.presences}
              value={presence}
              setValue={setPresence}
            />
          </div>

          <div
            className="rounded-[20px] border border-[#e7ddd1] bg-[linear-gradient(160deg,#f4eee6_0%,#fbf8f3_100%)] p-4 md:p-[1.15rem]"
            aria-live="polite"
            aria-atomic="true"
            id={summaryId}
          >
            <div className="text-[10px] uppercase tracking-[0.26em] text-[#6d655e]">
              {copy.design.summaryLabel}
            </div>
            <div className="mt-2.5 text-[1.02rem] tracking-[-0.02em] text-[#201d1a]">
              {summary.heading}
            </div>
            <p className="mt-2 max-w-[34rem] text-[13px] leading-6 text-[#6a635c] md:text-[14px] md:leading-7">
              {summary.body}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7 border-t border-[#e8dfd4] pt-7">
        <div className={sectionLabel}>{copy.practical.sectionLabel}</div>
        <h2 className="mt-1.5 text-[1.05rem] tracking-[-0.02em] text-[#1f1d1a]">
          {copy.practical.sectionTitle}
        </h2>

        <div className="mt-5 space-y-5">
          <div>
            <div className={fieldLabel}>{copy.practical.timeline}</div>
            <PillRow
              legend={copy.practical.timeline}
              groupName="timelineDisplay"
              options={CONCIERGE_OPTION_VALUES.timelines}
              value={timeline}
              setValue={setTimeline}
            />
            {showEngagementTimelineHelper ? (
              <p className={helperText}>{copy.practical.timelineHelperEngagement}</p>
            ) : null}
          </div>

          <div>
            <div className={fieldLabel}>{copy.practical.budget}</div>
            <PillRow
              legend={copy.practical.budget}
              groupName="budgetRangeDisplay"
              options={CONCIERGE_OPTION_VALUES.budgets}
              value={budget}
              setValue={setBudget}
              contextualField="budget"
            />
            <p className={helperText}>{copy.practical.budgetHelper}</p>
            {contextualNotes.budget ? (
              <p className={contextualText} aria-live="polite">
                {contextualNotes.budget}
              </p>
            ) : null}
          </div>

          <div>
            <label className={fieldLabel} htmlFor={`${formId}-notes`}>
              {copy.practical.notes}
            </label>
            <textarea
              id={`${formId}-notes`}
              name={CONCIERGE_FORM_FIELD_NAMES.inspirationNotes}
              rows={5}
              value={inspirationNotes}
              onChange={(event) => {
                markFormStarted();
                setInspirationNotes(event.target.value);
              }}
              placeholder={copy.practical.notesPlaceholder}
              className={`${inputClass} resize-none leading-7`}
            />
          </div>

          <div>
            <div className={fieldLabelUpper}>Reference Images</div>
            <p className="mt-2 max-w-[36rem] text-[13px] leading-6 text-[#6a635c]">
              {copy.practical.referenceImages}
            </p>
          </div>

          <div className="pt-1">
            <div className={fieldLabel}>{copy.practical.contact}</div>
            <p className="mt-1.5 text-[13px] leading-6 text-[#6f665d]">
              {copy.practical.contactSupport}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={fieldLabelUpper} htmlFor={`${formId}-name`}>
                  Name
                </label>
                <input
                  id={`${formId}-name`}
                  name={CONCIERGE_FORM_FIELD_NAMES.fullName}
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  required
                  value={fullName}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={
                    fieldErrors.fullName ? nameErrorId : undefined
                  }
                  onChange={(event) => {
                    markFormStarted();
                    setFullName(event.target.value);
                  }}
                  className={
                    fieldErrors.fullName ? inputInvalidClass : inputClass
                  }
                />
                {fieldErrors.fullName ? (
                  <p
                    id={nameErrorId}
                    className="mt-2 text-[13px] leading-6 text-[#9b5f54]"
                  >
                    {fieldErrors.fullName}
                  </p>
                ) : null}
              </div>

              <div>
                <label className={fieldLabelUpper} htmlFor={`${formId}-email`}>
                  Email
                </label>
                <input
                  id={`${formId}-email`}
                  name={CONCIERGE_FORM_FIELD_NAMES.email}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Your email"
                  required
                  value={email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? emailErrorId : undefined
                  }
                  onChange={(event) => {
                    markFormStarted();
                    setEmail(event.target.value);
                  }}
                  className={
                    fieldErrors.email ? inputInvalidClass : inputClass
                  }
                />
                {fieldErrors.email ? (
                  <p
                    id={emailErrorId}
                    className="mt-2 text-[13px] leading-6 text-[#9b5f54]"
                  >
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className={fieldLabelUpper} htmlFor={`${formId}-phone`}>
                  Phone Number
                  {phoneRequired ? " (required)" : " (optional)"}
                </label>
                <input
                  id={`${formId}-phone`}
                  name={CONCIERGE_FORM_FIELD_NAMES.phone}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="Your phone number"
                  required={phoneRequired}
                  value={phone}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={
                    fieldErrors.phone ? phoneErrorId : undefined
                  }
                  onChange={(event) => {
                    markFormStarted();
                    setPhone(event.target.value);
                  }}
                  className={
                    fieldErrors.phone ? inputInvalidClass : inputClass
                  }
                />
                {fieldErrors.phone ? (
                  <p
                    id={phoneErrorId}
                    className="mt-2 text-[13px] leading-6 text-[#9b5f54]"
                  >
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <div className={fieldLabelUpper}>{copy.practical.preferredContact}</div>
            <PillRow
              legend={copy.practical.preferredContact}
              groupName="preferredContactDisplay"
              options={CONCIERGE_OPTION_VALUES.preferredContacts}
              value={preferredContact}
              setValue={setPreferredContact}
            />
            {preferredContact === "Text" ? (
              <p className="mt-4 max-w-[36rem] text-[13px] leading-6 text-[#6d655e]">
                By selecting Text, you agree that Hourglass Diamonds may reply
                to this inquiry by text. Message and data rates may apply.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-[#e8dfd4] pt-6 text-center">
        <p className="mx-auto max-w-[34rem] text-[13px] leading-7 text-[#6d655e]">
          {copy.closing.primary}
        </p>

        <CTAGlimmer>
          <button
            type="submit"
            disabled={submitState === "submitting"}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-wide text-white shadow-[0_14px_28px_rgba(43,39,35,0.12)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitState === "submitting" ? "Sending..." : CONCIERGE_CTA_LABEL}
          </button>
        </CTAGlimmer>

        <div
          id={statusId}
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="mx-auto mt-4 min-h-[1.5rem] max-w-[34rem] outline-none"
        >
          {formMessage ? (
            <p
              className={`text-[13px] leading-7 ${
                submitState === "error" ? "text-[#9b5f54]" : "text-[#6a635c]"
              }`}
            >
              {formMessage}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
