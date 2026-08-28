"use client";

import { useActionState } from "react";
import {
  testGmailConnection,
} from "../gmail-actions";
import type { GmailConnectionTestResult } from "@/lib/continuum/gmail/connection-test";

function statusLine(connected: boolean): string {
  return connected ? "Connected" : "Not connected";
}

function ResultLines({ result }: { result: GmailConnectionTestResult }) {
  return (
    <dl className="mt-6 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
      <div className="flex justify-between gap-4">
        <dt>Connection</dt>
        <dd>{result.connectionVerified ? "Verified" : "Not verified"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Mailbox</dt>
        <dd>{result.mailboxVerified ? "Verified" : "Not verified"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Query</dt>
        <dd>{result.querySucceeded ? "Succeeded" : "Did not run"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Estimate</dt>
        <dd>
          {result.resultSizeEstimate == null ? "—" : result.resultSizeEstimate}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Returned</dt>
        <dd>{result.returnedIdCount}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Labels in list</dt>
        <dd>{result.labelsAvailableFromListResponse ? "Yes" : "No"}</dd>
      </div>
      {result.safeErrorCode ? (
        <div className="flex justify-between gap-4">
          <dt>Code</dt>
          <dd>{result.safeErrorCode}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function GmailConnectionTestForm({ connected }: { connected: boolean }) {
  const [state, formAction, pending] = useActionState(
    testGmailConnection,
    null as GmailConnectionTestResult | null,
  );

  return (
    <form action={formAction} className="mt-8">
      <p className="text-[15px] text-[#efe8de]">{statusLine(connected)}</p>
      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
      >
        {pending ? "Testing…" : "Test connection"}
      </button>
      {state ? <ResultLines result={state} /> : null}
    </form>
  );
}
