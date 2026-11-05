"use client";

import { useState } from "react";
import {
  runControlledAcceptanceSequence,
  type AcceptanceControlResult,
} from "@/lib/continuum/concierge-funnel/control-sequence";

type ControlState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "complete"; result: AcceptanceControlResult }
  | { status: "failed"; message: string };

function Identifier({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border-t border-[#3b332c] py-3 first:border-t-0">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">{label}</dt>
      <dd className="mt-1 break-all font-mono text-[12px] text-[#d8ccbf]">
        {value ?? "Not present"}
      </dd>
    </div>
  );
}
export function AcceptanceControl() {
  const [state, setState] = useState<ControlState>({ status: "idle" });

  async function run() {
    setState({ status: "running" });
    try {
      const result = await runControlledAcceptanceSequence(fetch);
      setState({ status: "complete", result });
    } catch (error) {
      setState({
        status: "failed",
        message: error instanceof Error ? error.message : "Acceptance verification failed.",
      });
    }
  }

  const result = state.status === "complete" ? state.result : null;
  const ids = result?.verification.identifiers;

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-[1.35rem] border border-[#3b332c] bg-[#1a1613] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a58d6d]">
          Controlled synthetic fixture
        </p>
        <h2 className="mt-3 font-serif text-[1.55rem] font-normal text-[#efe8de]">
          One click. Two identical submissions.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[#b8aa9d]">
          Creates the approved example.test fixture, replays it once, then reloads
          the persisted intake, Candidate, founder action and outbox. No delivery
          or booking provider is connected to this control.
        </p>
        <button
          type="button"
          disabled={state.status === "running"}
          onClick={run}
          className="mt-6 min-h-12 w-full rounded-full border border-[#a88c64] bg-[#a88c64] px-5 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#17120e] outline-none transition hover:bg-[#b99b70] focus-visible:ring-2 focus-visible:ring-[#d7bd96] disabled:cursor-wait disabled:opacity-60"
        >
          {state.status === "running"
            ? "Running acceptance…"
            : "Run Synthetic Concierge Acceptance"}
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-[#74695f]">
          Nothing runs on page load or refresh. A deliberate founder click is required.
        </p>
      </section>

      <div aria-live="polite">
        {state.status === "failed" ? (
          <section role="alert" className="rounded-[1.35rem] border border-[#74463e] bg-[#251915] p-6">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#d89586]">Incomplete</p>
            <p className="mt-3 text-[14px] leading-relaxed text-[#ead7d1]">{state.message}</p>
          </section>
        ) : null}

        {result ? (
          <div className="space-y-6">
            <section className="rounded-[1.35rem] border border-[#3b332c] bg-[#1a1613] p-6">
              <p className={`text-[10px] uppercase tracking-[0.18em] ${result.complete ? "text-[#9fbd93]" : "text-[#d9a275]"}`}>
                {result.complete ? "Acceptance complete" : "Verification incomplete"}
              </p>
              <div className="mt-5 space-y-3">
                {result.checks.map((check) => (
                  <div key={check.label} className="flex gap-3 text-[13px] leading-relaxed">
                    <span aria-hidden className={check.passed ? "text-[#9fbd93]" : "text-[#d89586]"}>
                      {check.passed ? "✓" : "×"}
                    </span>
                    <span className={check.passed ? "text-[#d8ccbf]" : "text-[#ead7d1]"}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-[#3b332c] bg-[#1a1613] p-6">
              <h3 className="font-serif text-[1.3rem] text-[#efe8de]">Persisted identities</h3>
              <dl className="mt-4">
                <Identifier label="Intake" value={ids?.intakeId} />
                <Identifier label="Person" value={ids?.personId} />
                <Identifier label="Job" value={ids?.jobId} />
                <Identifier label="Candidate" value={ids?.candidateId} />
                <Identifier label="Acknowledgment outbox" value={ids?.outboxId} />
              </dl>
            </section>

            <section className="rounded-[1.35rem] border border-[#3b332c] bg-[#1a1613] p-6 text-[13px] leading-relaxed text-[#c7b9ac]">
              <h3 className="font-serif text-[1.3rem] text-[#efe8de]">Result</h3>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                <dt className="text-[#8d8073]">First</dt><dd>{result.first.funnelStatus}</dd>
                <dt className="text-[#8d8073]">Replay</dt><dd>{result.replay.funnelStatus}</dd>
                <dt className="text-[#8d8073]">Source</dt><dd>{result.verification.sourceLabel}</dd>
                <dt className="text-[#8d8073]">Classification</dt><dd>Synthetic acceptance fixture</dd>
                <dt className="text-[#8d8073]">Founder review</dt><dd>{result.verification.founderReview?.status}</dd>
                <dt className="text-[#8d8073]">Outbox</dt><dd>{result.verification.acknowledgement?.state}; {result.verification.acknowledgement?.attemptCount} attempts</dd>
                <dt className="text-[#8d8073]">Booking</dt><dd>{result.verification.booking?.state}; no availability offered</dd>
              </dl>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
