"use client";

import { useActionState } from "react";
import {
  disconnectCalendarConnectionForm,
  testCalendarConnection,
} from "../calendar-actions";
import type { CalendarConnectionTestResult } from "@/lib/continuum/calendar/connection-test";

function statusLine(input: {
  connected: boolean;
  status:
    | "ready"
    | "activation-required"
    | "consent-required"
    | "unavailable"
    | "paused"
    | "read-failed";
}): string {
  if (input.status === "activation-required") return "Activation required";
  if (input.status === "consent-required") return "Calendar consent required";
  if (input.status === "unavailable") return "Calendar storage not applied";
  if (input.status === "paused") return "Paused";
  if (input.status === "read-failed") return "Unable to read calendar";
  return input.connected ? "Connected" : "Not connected";
}

function ResultLines({ result }: { result: CalendarConnectionTestResult }) {
  return (
    <dl className="mt-6 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
      <div className="flex justify-between gap-4">
        <dt>Connection</dt>
        <dd>{result.connectionVerified ? "Verified" : "Not verified"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Calendar list</dt>
        <dd>{result.calendarListSucceeded ? "Succeeded" : "Did not run"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Calendars</dt>
        <dd>{result.calendarCount == null ? "—" : result.calendarCount}</dd>
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

export function CalendarConnectionControls({
  connected,
  status,
  oauthConfigured,
}: {
  connected: boolean;
  status:
    | "ready"
    | "activation-required"
    | "consent-required"
    | "unavailable"
    | "paused"
    | "read-failed";
  oauthConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    testCalendarConnection,
    null as CalendarConnectionTestResult | null,
  );

  return (
    <div className="mt-8">
      <p className="text-[15px] text-[#efe8de]">{statusLine({ connected, status })}</p>
      {status === "consent-required" && oauthConfigured ? (
        <a
          href="/executive-dashboard/concierge/calendar/oauth/start"
          className="mt-6 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Connect calendar
        </a>
      ) : null}
      <form action={formAction} className="mt-4">
        <button
          type="submit"
          disabled={pending || status === "activation-required"}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
        >
          {pending ? "Testing…" : "Test connection"}
        </button>
        {state ? <ResultLines result={state} /> : null}
      </form>
      {connected ? (
        <form action={disconnectCalendarConnectionForm} className="mt-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Disconnect
          </button>
        </form>
      ) : null}
    </div>
  );
}
