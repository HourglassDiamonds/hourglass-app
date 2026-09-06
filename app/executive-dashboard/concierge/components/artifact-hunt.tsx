"use client";

import Link from "next/link";
import { useActionState } from "react";
import { findAchedekalArtifactCandidates } from "../artifact-hunt-actions";
import {
  ACHEDEKAL_ARTIFACT_HUNT_HEADING,
  ACHEDEKAL_KNOWN_ARTIFACT_CLASSIFICATION_BASIS,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import { conciergeCopyGmailProjectArtifactPath } from "@/lib/continuum/client-memory/read/presentation";
import type { ArtifactHuntState } from "@/lib/continuum/gmail/artifact-hunt";
import { ClientMemorySection } from "./client-memory-section";

const ERROR_COPY: Record<
  Exclude<ArtifactHuntState, { ok: true }>["safeErrorCode"],
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
  projectId,
}: {
  row: Extract<ArtifactHuntState, { ok: true }>["likely"][number];
  heading: string;
  projectId: string;
}) {
  const date = row.sentAt ?? "—";
  const source = row.subject?.trim()
    ? row.subject
    : `Stored thread ${row.source.threadId}`;
  return (
    <li className="border-t border-[#3a332c] pt-5">
      <p className="text-[13px] uppercase tracking-[0.16em] text-[#8d8073]">
        {heading}
      </p>
      <p className="mt-2 text-[15px] text-[#efe8de]">{row.filename || "—"}</p>
      <MetaLine label="Type" value={row.classification.label} />
      <MetaLine label="Date" value={date} />
      <MetaLine label="Source" value={source} />
      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">
        Why it matched
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[#c4b7aa]">
        {row.evidenceReasons.map((reason, index) => (
          <li key={`${reason.kind}:${reason.value}:${index}`}>{reason.detail}</li>
        ))}
      </ul>
      <Link
        href={conciergeCopyGmailProjectArtifactPath(projectId, {
          messageId: row.source.messageId,
          attachmentId: row.source.attachmentId,
        })}
        className="mt-3 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        Copy to project
      </Link>
      <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Not opened · Metadata only
      </p>
    </li>
  );
}

function HuntResult({
  state,
}: {
  state: Extract<ArtifactHuntState, { ok: true }>;
}) {
  return (
    <div className="mt-10 space-y-10">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad9164]">
        Not opened · Metadata only · Founder review required
      </p>
      <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
        {state.warning} Classification is metadata-derived, not visual.{" "}
        {ACHEDEKAL_KNOWN_ARTIFACT_CLASSIFICATION_BASIS}.
      </p>
      {state.resultsLimited ? (
        <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
          Ranked / limited independently: likely top {state.exactLimit},
          ambiguous top {state.ambiguousLimit}, unassigned / possible other
          Project top {state.unassignedLimit}.
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
          Ranked independently. Likely limit {state.exactLimit}. Ambiguous
          limit {state.ambiguousLimit}. Unassigned / possible other Project
          limit {state.unassignedLimit}.
        </p>
      )}

      <ClientMemorySection title="Likely Project artifacts">
        {state.likely.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No likely Project artifact candidates in the bounded review set.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.likely.map((row, index) => (
              <CandidateCard
                key={row.candidateId}
                row={row}
                heading={`Candidate ${index + 1}`}
                projectId={state.projectId}
              />
            ))}
          </ul>
        )}
      </ClientMemorySection>

      <ClientMemorySection title="Ambiguous">
        {state.ambiguous.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No ambiguous artifact candidates in the bounded review set.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.ambiguous.map((row, index) => (
              <CandidateCard
                key={`ambiguous:${row.candidateId}`}
                row={row}
                heading={`Ambiguous ${index + 1}`}
                projectId={state.projectId}
              />
            ))}
          </ul>
        )}
      </ClientMemorySection>

      <ClientMemorySection title="Unassigned / possible other Project">
        {state.unassigned.length === 0 ? (
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No Person-related unassigned artifacts in the bounded review set.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.unassigned.map((row, index) => (
              <CandidateCard
                key={`unassigned:${row.candidateId}`}
                row={row}
                heading={`Unassigned ${index + 1}`}
                projectId={state.projectId}
              />
            ))}
          </ul>
        )}
      </ClientMemorySection>
    </div>
  );
}

export function ArtifactHuntForm() {
  const [state, formAction, pending] = useActionState(
    findAchedekalArtifactCandidates,
    null as ArtifactHuntState | null,
  );

  return (
    <div className="mt-12">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {ACHEDEKAL_ARTIFACT_HUNT_HEADING}
      </h2>
      <form action={formAction} className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
        >
          {pending ? "Searching index…" : "Find artifact candidates"}
        </button>
      </form>
      {state && !state.ok ? (
        <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
          {ERROR_COPY[state.safeErrorCode]}
        </p>
      ) : null}
      {state?.ok ? <HuntResult state={state} /> : null}
    </div>
  );
}
