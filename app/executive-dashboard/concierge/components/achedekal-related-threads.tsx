"use client";

import { useActionState } from "react";
import { findAchedekalRelatedThreads } from "../achedekal-discovery-actions";
import type { AchedekalDiscoveryState } from "@/lib/continuum/gmail/achedekal-candidate-discovery";
import { ClientMemorySection } from "./client-memory-section";

const ERROR_COPY: Record<
  Exclude<AchedekalDiscoveryState, { ok: true }>["safeErrorCode"],
  string
> = {
  unauthorized: "This surface could not be opened.",
  "project-not-found": "This project could not be found.",
  "index-unavailable": "Gmail metadata index unavailable.",
};

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-1 text-[13px] leading-relaxed text-[#c4b7aa]">
      <span className="text-[#8d8073]">{label}: </span>
      {value}
    </p>
  );
}

function CandidateCard({
  row,
  heading,
}: {
  row: Extract<AchedekalDiscoveryState, { ok: true }>["related"][number];
  heading: string;
}) {
  const dates =
    row.earliestDate || row.latestDate
      ? `${row.earliestDate ?? "—"} → ${row.latestDate ?? "—"}`
      : "—";
  const direction = `${row.inboundCount} inbound · ${row.outboundCount} outbound`;
  const attachments =
    row.attachmentCount === 0
      ? "None"
      : `${row.attachmentCount}${row.attachmentTypes.length ? ` · ${row.attachmentTypes.join(", ")}` : ""}`;
  return (
    <li className="border-t border-[#3a332c] pt-5">
      <p className="text-[13px] uppercase tracking-[0.16em] text-[#8d8073]">
        {heading}
      </p>
      <p className="mt-2 text-[15px] text-[#efe8de]">{row.subject || "—"}</p>
      <MetaLine label="Thread" value={row.threadId} />
      <MetaLine label="Dates" value={dates} />
      <MetaLine label="Messages" value={`${row.messageCount} · ${direction}`} />
      <MetaLine label="Attachments" value={attachments} />
      <MetaLine label="Score" value={String(row.score)} />
      <MetaLine label="Strength" value={row.strength} />
      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">
        Why
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[#c4b7aa]">
        {row.reasons.map((reason, index) => (
          <li key={`${reason.kind}:${reason.value}:${index}`}>{reason.detail}</li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Candidate — not opened · Metadata only · Founder review required
      </p>
    </li>
  );
}

function DiscoveryResult({
  state,
}: {
  state: Extract<AchedekalDiscoveryState, { ok: true }>;
}) {
  const knownDates =
    state.knownThread && (state.knownThread.earliestDate || state.knownThread.latestDate)
      ? `${state.knownThread.earliestDate ?? "—"} → ${state.knownThread.latestDate ?? "—"}`
      : "—";
  return (
    <div className="mt-10 space-y-10">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad9164]">
        Not opened · Metadata only · Founder review required
      </p>
      {state.resultsLimited ? (
        <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
          Ranked / limited independently: related top {state.relatedLimit},
          ambiguous top {state.ambiguousLimit}, unassigned / possible new
          project top {state.unassignedLimit}.
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
          Ranked independently. Related limit {state.relatedLimit}. Ambiguous
          limit {state.ambiguousLimit}. Unassigned / possible new project limit{" "}
          {state.unassignedLimit}. Score-0 vendor noise is not shown.
        </p>
      )}

      <ClientMemorySection title="Known project thread">
        {state.knownThreadIndexStatus === "empty-index" ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No indexed metadata available for the stored project thread.
          </p>
        ) : state.knownThread ? (
          <div className="text-[15px] text-[#d8cfc4]">
            <p className="text-[#efe8de]">{state.knownThread.subject || "—"}</p>
            <MetaLine label="Thread" value={state.knownThread.threadId} />
            <MetaLine label="Dates" value={knownDates} />
            <MetaLine
              label="Messages"
              value={`${state.knownThread.messageCount} · ${state.knownThread.inboundCount} inbound · ${state.knownThread.outboundCount} outbound`}
            />
            <MetaLine
              label="Attachments"
              value={String(state.knownThread.attachmentCount)}
            />
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Stored exact thread · indexed metadata only
            </p>
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No stored project thread on this Project Book.
          </p>
        )}
      </ClientMemorySection>

      <ClientMemorySection title="Possible related threads">
        {state.related.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No related-thread candidates above the discovery threshold.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.related.map((row, index) => (
              <CandidateCard
                key={row.threadId}
                row={row}
                heading={`Candidate ${index + 1}`}
              />
            ))}
          </ul>
        )}
      </ClientMemorySection>

      <ClientMemorySection title="Ambiguous / possible new project">
        {state.ambiguous.length + state.unassigned.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No meaningful ambiguous collisions or Person-related possible new
            projects in the bounded review set.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.ambiguous.map((row, index) => (
              <CandidateCard
                key={`ambiguous:${row.threadId}`}
                row={row}
                heading={`Ambiguous ${index + 1}`}
              />
            ))}
            {state.unassigned.map((row, index) => (
              <CandidateCard
                key={`unassigned:${row.threadId}`}
                row={row}
                heading={`Possible new project ${index + 1}`}
              />
            ))}
          </ul>
        )}
      </ClientMemorySection>
    </div>
  );
}

export function AchedekalRelatedThreadsForm() {
  const [state, formAction, pending] = useActionState(
    findAchedekalRelatedThreads,
    null as AchedekalDiscoveryState | null,
  );

  return (
    <div className="mt-12">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
        >
          {pending ? "Searching index…" : "Find possible related threads"}
        </button>
      </form>
      {state && !state.ok ? (
        <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
          {ERROR_COPY[state.safeErrorCode]}
        </p>
      ) : null}
      {state?.ok ? <DiscoveryResult state={state} /> : null}
    </div>
  );
}
