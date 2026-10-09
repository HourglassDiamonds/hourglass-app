"use client";

import { useRef, useState, useTransition } from "react";
import { runPrivateGmailEvidenceAuditAction } from "../gmail-evidence-audit-actions";
import type {
  GmailEvidenceAuditCaseKey,
  GmailEvidenceAuditCaseResult,
  GmailEvidenceAuditResult,
} from "@/lib/continuum/gmail/evidence-completeness-audit";

const CASE_LABELS: Readonly<Record<GmailEvidenceAuditCaseKey, string>> = {
  sarah: "Sarah",
  nathan: "Nathan",
};

function CaseMetrics({
  caseKey,
  result,
}: {
  caseKey: GmailEvidenceAuditCaseKey;
  result: GmailEvidenceAuditCaseResult;
}) {
  return (
    <div className="border-t border-[#3a332c] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-[13px] font-medium text-[#efe8de]">
          {CASE_LABELS[caseKey]}
        </h3>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
          {result.completeness}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[12px] text-[#c4b7aa]">
        <dt>Scoped / indexed</dt>
        <dd className="text-right">
          {result.scopedMessageCount} / {result.indexedMessageCount}
        </dd>
        <dt>Live retrieved</dt>
        <dd className="text-right">
          {result.successfullyLiveRetrievedMessageCount}
        </dd>
        <dt>Unavailable</dt>
        <dd className="text-right">{result.unavailableMessageCount}</dd>
        <dt>Substantive</dt>
        <dd className="text-right">
          {result.substantiveAuthorOwnedContentCount}
        </dd>
        <dt>With attachments</dt>
        <dd className="text-right">
          {result.attachmentPresenceMessageCount}
        </dd>
      </dl>
      {result.safeErrorCategories.length > 0 ? (
        <p className="mt-3 text-[12px] text-[#bda78b]">
          Safe status: {result.safeErrorCategories.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

export function PrivateGmailEvidenceAudit() {
  const submitted = useRef(false);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<GmailEvidenceAuditResult | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function runAudit() {
    if (submitted.current || pending) return;
    submitted.current = true;
    setAttempted(true);
    setRequestFailed(false);
    startTransition(async () => {
      try {
        setResult(await runPrivateGmailEvidenceAuditAction());
      } catch {
        setRequestFailed(true);
      }
    });
  }

  return (
    <section
      aria-labelledby="private-gmail-evidence-audit-title"
      className="mt-10 border border-[#4a4036] bg-[#181512] p-5"
      data-temporary-private-gmail-audit=""
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#bda78b]">
        Temporary founder diagnostic · read only
      </p>
      <h2
        id="private-gmail-evidence-audit-title"
        className="mt-2 font-serif text-[1.2rem] text-[#efe8de]"
      >
        Sarah / Nathan evidence completeness
      </h2>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[#a99c8f]">
        Explicitly retrieves only the four fixed, indexed Gmail threads for this
        audit and returns counts. It does not return message text or change
        Gmail, Continuum, or Today.
      </p>
      <button
        type="button"
        onClick={runAudit}
        disabled={pending || attempted}
        className="mt-5 inline-flex min-h-11 items-center border border-[#6f5c46] px-4 text-[11px] uppercase tracking-[0.16em] text-[#efe8de] outline-none hover:border-[#ad9164] hover:text-[#ad9164] focus-visible:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:cursor-not-allowed disabled:border-[#3a332c] disabled:text-[#6f655b]"
      >
        {pending
          ? "Running aggregate audit…"
          : attempted
            ? "Audit attempt completed"
            : "Run Sarah / Nathan aggregate audit"}
      </button>
      {attempted ? (
        <p className="mt-3 text-[11px] leading-relaxed text-[#8d8073]">
          This control permits one attempt per page load. Reloading can enable a
          repeat; no permanent single-use enforcement is claimed.
        </p>
      ) : null}
      <div className="mt-6 space-y-4" aria-live="polite">
        {requestFailed ? (
          <p className="text-[12px] text-[#bda78b]">
            The aggregate audit could not complete. No private error detail was
            returned.
          </p>
        ) : null}
        {result ? (
          <>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8d8073]">
              Overall: {result.completeness}
            </p>
            <CaseMetrics caseKey="sarah" result={result.cases.sarah} />
            <CaseMetrics caseKey="nathan" result={result.cases.nathan} />
          </>
        ) : null}
      </div>
    </section>
  );
}
