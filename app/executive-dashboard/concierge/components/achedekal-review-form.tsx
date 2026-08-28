"use client";

import { useActionState } from "react";
import { reviewAchedekalGmailEvidence } from "../achedekal-review-actions";
import type { AchedekalReviewState } from "@/lib/continuum/gmail/achedekal-review";
import { ClientMemorySection } from "./client-memory-section";

const ERROR_COPY: Record<
  Exclude<AchedekalReviewState, { ok: true }>["safeErrorCode"],
  string
> = {
  unauthorized: "This surface could not be opened.",
  "project-not-found": "This project could not be found.",
  "blank-pointer": "Gmail thread unavailable.",
  "invalid-pointer": "Gmail thread unavailable.",
  "connection-unavailable": "Gmail connection unavailable.",
  "token-refresh-failure": "Gmail token refresh failed.",
  "gmail-thread-unavailable": "Gmail thread unavailable.",
  "thread-fetch-failed": "Gmail thread fetch failed.",
};

function SpecList({
  rows,
}: {
  rows: readonly { label: string; value: string }[];
}) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`}>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
            {row.label}
          </dt>
          <dd className="mt-1 text-[15px] text-[#d8cfc4]">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewResult({ state }: { state: Extract<AchedekalReviewState, { ok: true }> }) {
  return (
    <div className="mt-10 space-y-10">
      <ClientMemorySection title="Current project data">
        <SpecList
          rows={state.currentSpecs.map((row) => ({
            label: row.label,
            value: row.value,
          }))}
        />
      </ClientMemorySection>

      <ClientMemorySection title="Candidate evidence">
        {state.candidates.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No candidate evidence besides the thread summary.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.candidates.map((row, index) => (
              <li key={`${row.field}:${row.candidateValue}:${index}`}>
                <p className="text-[13px] uppercase tracking-[0.16em] text-[#8d8073]">
                  {row.label}
                </p>
                <p className="mt-1 text-[15px] text-[#efe8de]">{row.candidateValue}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
                  {row.excerpt}
                </p>
                <p className="mt-2 text-[12px] text-[#8d8073]">
                  {[row.messageDate, row.direction, row.sourceRole]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ClientMemorySection>

      <ClientMemorySection title="Proposed corrections">
        {state.ringSizeStatus === "none" ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No explicit ring-size evidence found.
          </p>
        ) : null}
        {state.ringSizeStatus === "ambiguous" ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            Ambiguous size evidence — not a clean proposed correction.
          </p>
        ) : null}
        {state.proposedCorrections.map((row) => (
          <div key={row.field} className="text-[15px] leading-relaxed text-[#d8cfc4]">
            <p className="text-[#efe8de]">{row.label}</p>
            <p className="mt-2">Current: {row.currentValue ?? "—"}</p>
            <p>Candidate: {row.candidateValue}</p>
            <p>Requires founder approval</p>
            <p>Automatic apply: false</p>
          </div>
        ))}
      </ClientMemorySection>

      {state.ambiguousSizeEvidence.length > 0 ? (
        <ClientMemorySection title="Ambiguous size evidence">
          <ul className="space-y-5">
            {state.ambiguousSizeEvidence.map((row, index) => (
              <li key={`ambiguous:${row.candidateValue}:${index}`}>
                <p className="mt-1 text-[15px] text-[#efe8de]">{row.candidateValue}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
                  {row.excerpt}
                </p>
                <p className="mt-2 text-[12px] text-[#8d8073]">
                  {[row.messageDate, row.direction, row.sourceRole]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </ClientMemorySection>
      ) : null}

      <ClientMemorySection title="Attachment inventory">
        {state.attachments.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">None.</p>
        ) : (
          <ul className="space-y-3">
            {state.attachments.map((row, index) => (
              <li key={`${row.filename ?? "file"}:${index}`} className="text-[15px] text-[#d8cfc4]">
                <p>{row.filename ?? "Untitled"}</p>
                <p className="text-[12px] text-[#8d8073]">
                  {[row.mimeType, row.sizeBytes == null ? null : `${row.sizeBytes} bytes`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ClientMemorySection>

      <ClientMemorySection title="Thread summary">
        <dl className="space-y-2 text-[15px] text-[#d8cfc4]">
          <div className="flex justify-between gap-4">
            <dt>Messages</dt>
            <dd>{state.threadSummary.messageCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Date range</dt>
            <dd>
              {state.threadSummary.earliestDate || state.threadSummary.latestDate
                ? `${state.threadSummary.earliestDate ?? "—"} → ${state.threadSummary.latestDate ?? "—"}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Attachments</dt>
            <dd>{state.threadSummary.attachmentCount}</dd>
          </div>
        </dl>
      </ClientMemorySection>
    </div>
  );
}

export function AchedekalReviewForm({
  specs,
}: {
  specs: readonly { label: string; value: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    reviewAchedekalGmailEvidence,
    null as AchedekalReviewState | null,
  );

  return (
    <div className="mt-8">
      {state?.ok ? null : (
        <ClientMemorySection title="Current project data">
          <SpecList rows={specs} />
        </ClientMemorySection>
      )}
      <form action={formAction} className="mt-8">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
        >
          {pending ? "Reviewing…" : "Review Gmail evidence"}
        </button>
      </form>
      {state && !state.ok ? (
        <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
          {ERROR_COPY[state.safeErrorCode]}
        </p>
      ) : null}
      {state?.ok ? <ReviewResult state={state} /> : null}
    </div>
  );
}
