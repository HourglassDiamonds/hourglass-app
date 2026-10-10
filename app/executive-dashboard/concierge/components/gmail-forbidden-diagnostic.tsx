"use client";

import { useRef, useState, useTransition } from "react";
import { runGmailForbiddenDiagnosticAction } from "../gmail-forbidden-diagnostic-actions";
import type { GmailForbiddenDiagnosticResult } from "@/lib/continuum/gmail/forbidden-diagnostic";

export function GmailForbiddenDiagnostic() {
  const submitted = useRef(false);
  const [attempted, setAttempted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GmailForbiddenDiagnosticResult | null>(
    null,
  );

  const run = () => {
    if (submitted.current) return;
    submitted.current = true;
    setAttempted(true);
    startTransition(async () => {
      setResult(await runGmailForbiddenDiagnosticAction());
    });
  };

  return (
    <section
      className="mt-8 border border-amber-300/20 bg-amber-200/[0.03] p-5"
      aria-labelledby="gmail-forbidden-diagnostic-title"
      data-temporary-gmail-forbidden-diagnostic=""
    >
      <h2
        id="gmail-forbidden-diagnostic-title"
        className="text-[12px] uppercase tracking-[0.18em] text-amber-200/80"
      >
        Temporary Gmail 403 diagnostic
      </h2>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[#9a8e82]">
        Founder-only, fixed-thread, read-only diagnostic. One attempt per page
        load; no message content is returned.
      </p>
      <button
        type="button"
        disabled={pending || attempted}
        onClick={run}
        className="mt-4 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-amber-200 outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] disabled:text-[#6f675f]"
      >
        {pending ? "Checking…" : attempted ? "Diagnostic attempted" : "Run one diagnostic"}
      </button>
      {result ? (
        <dl className="mt-5 space-y-2 text-[13px] text-[#c4b7aa]">
          <div className="flex justify-between gap-4">
            <dt>Result</dt>
            <dd>{result.success ? "Success" : "Failed"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>HTTP status</dt>
            <dd>{result.httpStatus ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Category</dt>
            <dd>{result.normalizedCategory ?? "None"}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
