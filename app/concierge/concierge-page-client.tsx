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
    "inline-flex min-h-[44px] items-center rounded-full border border-[#2b2723] bg-[#2b2723] px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(43,39,35,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbbda9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8de]";
  const pill =
    "inline-flex min-h-[44px] items-center rounded-full border border-[#ddd1c2] bg-white/82 px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] text-[#6f665d] transition duration-200 hover:border-[#ccbda9] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbbda9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8de]";

  const directionNote = useMemo(() => {
    if (direction === "Modern Minimal") {
      return "Clean lines, quieter detail, and a more restrained point of view.";
    }
    if (direction === "Classic Timeless") {
      return "Balanced proportion and a sense of permanence that never feels overstated.";
    }
    if (direction === "Bold Presence") {
      return "A stronger visual statement with more sculptural presence.";
    }
    if (direction === "Still Discovering") {
      return "An open starting point we can shape together in the first conversation.";
    }
    if (direction === "Quiet Elegance") {
      return "A softer direction built around balance, proportion, and calm elegance.";
    }
    return "An open starting point we can shape together in the first conversation.";
  }, [direction]);

  const briefLine = useMemo(() => {
    const project =
      projectType === "Still Exploring" ? "piece" : projectType.toLowerCase();

    const shapeLine =
      shape === "Not Sure Yet"
        ? "a shape still to be refined"
        : `${shape.toLowerCase()} lines`;

    const directionLine =
      direction === "Still Discovering"
        ? "an open design direction"
        : `a ${direction.toLowerCase()} direction`;

    const presenceLine =
      presence === "Still Exploring"
        ? "with room to shape the final presence together"
        : `with a ${presence.toLowerCase()} presence`;

    return `A ${project} guided by ${shapeLine}, ${directionLine}, and ${presenceLine}.`;
  }, [projectType, shape, direction, presence]);

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

      formData.set("projectType", projectType);
      formData.set("shapeInterest", shape);
      formData.set("designDirection", direction);
      formData.set("ringPresence", presence);
      formData.set("timeline", timeline);
      formData.set("budgetRange", budget);
      formData.set(
        "preferredContactMethod",
        normalizePreferredContact(preferredContact),
      );
      formData.set("submissionId", submissionId);
      formData.set("fullName", fullName.trim());
      formData.set("email", email.trim());
      formData.set("phone", phone.trim());
      formData.set("inspirationNotes", inspirationNotes);

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
  }: {
    legend: string;
    options: string[];
    value: string;
    setValue: (value: string) => void;
    groupName: string;
  }) => (
    <fieldset className="mt-4 border-0 p-0">
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
    "text-[10px] uppercase tracking-[0.32em] text-[#8a8177]";
  const fieldLabel =
    "text-[11px] uppercase tracking-[0.28em] text-[#857b70]";
  const inputClass =
    "mt-3 w-full rounded-[18px] border border-[#ddd4c9] bg-white/78 px-4 py-3.5 text-sm text-[#3c3834] outline-none placeholder:text-[#8a8177] focus-visible:border-[#cbbda9] focus-visible:ring-2 focus-visible:ring-[#cbbda9]/70";
  const inputInvalidClass =
    "mt-3 w-full rounded-[18px] border border-[#c9897c] bg-white/78 px-4 py-3.5 text-sm text-[#3c3834] outline-none placeholder:text-[#8a8177] focus-visible:ring-2 focus-visible:ring-[#c9897c]/50";

  if (submitState === "success") {
    return (
      <div
        className="mx-auto mt-8 max-w-[980px] rounded-[28px] border border-[#e4dbcf] bg-white/52 p-6 shadow-[0_18px_46px_rgba(45,35,26,0.03)] md:mt-10 md:p-10"
        role="status"
        aria-live="polite"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#8a8177]">
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
        <p className="mt-4 max-w-[36rem] text-[14px] leading-7 text-[#7b7268]">
          There is nothing more you need to do for now. When you are ready,
          continue exploring the Diamond Guide.
        </p>
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            href="/diamond-guide"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#2b2723] bg-[#2b2723] px-7 py-3 text-sm tracking-wide text-white transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbbda9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8de]"
          >
            Return to the Diamond Guide
          </Link>
          <button
            type="button"
            onClick={resetForAnotherInquiry}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#d6ccc0] bg-transparent px-5 py-3 text-[13px] tracking-wide text-[#6f665d] transition hover:border-[#cbbda9] hover:text-[#1f1d1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbbda9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8de]"
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
  const phoneRequired =
    preferredContact === "Phone" || preferredContact === "Text";

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

      <div>
        <div className={sectionLabel}>The Foundation</div>
        <h2 className="mt-2 text-[1.05rem] tracking-[-0.02em] text-[#1f1d1a]">
          The essentials that help shape the conversation.
        </h2>

        <div className="mt-6 space-y-6">
          <div>
            <div className={fieldLabel} id={`${formId}-project-label`}>
              Project Type
            </div>
            <PillRow
              legend="Project Type"
              groupName="projectTypeDisplay"
              options={[
                "Engagement Ring",
                "Custom Jewelry",
                "Wedding Band",
                "Still Exploring",
              ]}
              value={projectType}
              setValue={setProjectType}
            />
          </div>

          <div>
            <div className={fieldLabel}>Shape Interest</div>
            <PillRow
              legend="Shape Interest"
              groupName="shapeInterestDisplay"
              options={[
                "Round",
                "Oval",
                "Radiant",
                "Cushion",
                "Emerald",
                "Pear",
                "Marquise",
                "Not Sure Yet",
              ]}
              value={shape}
              setValue={setShape}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-[#e8dfd4] pt-8">
        <div className={sectionLabel}>Design Direction</div>
        <h2 className="mt-2 text-[1.05rem] tracking-[-0.02em] text-[#1f1d1a]">
          The tone and direction that feel most natural.
        </h2>

        <div className="mt-6 space-y-6">
          <div>
            <div className={fieldLabel}>Design Direction</div>
            <PillRow
              legend="Design Direction"
              groupName="designDirectionDisplay"
              options={[
                "Quiet Elegance",
                "Modern Minimal",
                "Classic Timeless",
                "Bold Presence",
                "Still Discovering",
              ]}
              value={direction}
              setValue={setDirection}
            />
          </div>

          <div>
            <div className={fieldLabel}>Ring Presence</div>
            <PillRow
              legend="Ring Presence"
              groupName="ringPresenceDisplay"
              options={[
                "Understated",
                "Balanced",
                "Statement",
                "Still Exploring",
              ]}
              value={presence}
              setValue={setPresence}
            />
          </div>

          <div className="rounded-[20px] border border-[#e7ddd1] bg-[linear-gradient(160deg,#f4eee6_0%,#fbf8f3_100%)] p-5">
            <div className="text-[10px] uppercase tracking-[0.26em] text-[#8a8177]">
              Current Direction
            </div>
            <div className="mt-3 text-[1.02rem] tracking-[-0.02em] text-[#201d1a]">
              {shape} · {direction}
            </div>
            <p className="mt-3 max-w-[34rem] text-[14px] leading-7 text-[#6a635c]">
              {directionNote}
            </p>
            <p className="mt-4 text-[14px] leading-7 text-[#615a53]">
              {briefLine}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-[#e8dfd4] pt-8">
        <div className={sectionLabel}>A Few Final Details</div>
        <h2 className="mt-2 text-[1.05rem] tracking-[-0.02em] text-[#1f1d1a]">
          A few details that help us respond clearly.
        </h2>

        <div className="mt-6 space-y-6">
          <div>
            <div className={fieldLabel}>Timeline</div>
            <PillRow
              legend="Timeline"
              groupName="timelineDisplay"
              options={["0–2 months", "3–4 months", "6+ months", "Flexible"]}
              value={timeline}
              setValue={setTimeline}
            />
          </div>

          <div>
            <div className={fieldLabel}>Budget Range</div>
            <PillRow
              legend="Budget Range"
              groupName="budgetRangeDisplay"
              options={[
                "Under 10k",
                "10–20k",
                "20–30k",
                "30–50k",
                "50k+",
                "Prefer to Discuss",
              ]}
              value={budget}
              setValue={setBudget}
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor={`${formId}-notes`}>
              Inspiration or Notes
            </label>
            <textarea
              id={`${formId}-notes`}
              name="inspirationNotes"
              rows={6}
              value={inspirationNotes}
              onChange={(event) => {
                markFormStarted();
                setInspirationNotes(event.target.value);
              }}
              placeholder="Anything you'd like us to know. References, ideas, timing, or even a rough direction."
              className={`${inputClass} resize-none leading-7`}
            />
          </div>

          <div>
            <div className={fieldLabel}>Reference Images</div>
            <p className="mt-3 max-w-[36rem] text-[14px] leading-7 text-[#6a635c]">
              Reference images can be shared securely after the initial
              conversation.
            </p>
          </div>

          <div>
            <div className={fieldLabel}>Contact</div>
            <p className="mt-2 text-[14px] leading-7 text-[#6f665d]">
              How you’d prefer we reach out.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className={fieldLabel} htmlFor={`${formId}-name`}>
                  Name
                </label>
                <input
                  id={`${formId}-name`}
                  name="fullName"
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
                <label className={fieldLabel} htmlFor={`${formId}-email`}>
                  Email
                </label>
                <input
                  id={`${formId}-email`}
                  name="email"
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
                <label className={fieldLabel} htmlFor={`${formId}-phone`}>
                  Phone Number
                  {phoneRequired ? " (required)" : " (optional)"}
                </label>
                <input
                  id={`${formId}-phone`}
                  name="phone"
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
            <div className={fieldLabel}>Preferred Contact</div>
            <PillRow
              legend="Preferred Contact"
              groupName="preferredContactDisplay"
              options={["Email", "Phone", "Text", "Any Is Fine"]}
              value={preferredContact}
              setValue={setPreferredContact}
            />
            {preferredContact === "Text" ? (
              <p className="mt-4 max-w-[36rem] text-[13px] leading-6 text-[#7b7268]">
                By selecting Text, you agree that Hourglass Diamonds may reply
                to this inquiry by text. Message and data rates may apply.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-[#e8dfd4] pt-8 text-center">
        <p className="mx-auto max-w-[34rem] text-[13px] leading-7 text-[#7b7268]">
          You don’t need to have everything figured out. This is simply a
          starting point.
        </p>

        <CTAGlimmer>
          <button
            type="submit"
            disabled={submitState === "submitting"}
            className="mt-7 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-wide text-white shadow-[0_14px_28px_rgba(43,39,35,0.12)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbbda9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8de] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitState === "submitting"
              ? "Sending..."
              : "Begin the Conversation"}
          </button>
        </CTAGlimmer>

        <div
          id={statusId}
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="mx-auto mt-5 min-h-[1.5rem] max-w-[34rem] outline-none"
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
