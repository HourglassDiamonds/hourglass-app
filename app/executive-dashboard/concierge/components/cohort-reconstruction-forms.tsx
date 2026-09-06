"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  findCohortArtifactCandidates,
  findCohortRelatedThreads,
  reviewCohortProjectGmailEvidence,
} from "../cohort-reconstruction-actions";
import { conciergeCopyGmailProjectArtifactPath } from "@/lib/continuum/client-memory/read/presentation";
import type { AchedekalDiscoveryState } from "@/lib/continuum/gmail/achedekal-candidate-discovery";
import type { AchedekalReviewState } from "@/lib/continuum/gmail/achedekal-review";
import type { ArtifactHuntState } from "@/lib/continuum/gmail/artifact-hunt";
import { ClientMemorySection } from "./client-memory-section";

const BUTTON =
  "inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]";

function ErrorText({ text }: { text: string }) {
  return (
    <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
      {text}
    </p>
  );
}

export function CohortExactThreadForm({ projectId }: { projectId: string }) {
  const action = reviewCohortProjectGmailEvidence.bind(null, projectId);
  const [state, formAction, pending] = useActionState(
    action,
    null as AchedekalReviewState | null,
  );

  return (
    <div className="mt-8">
      <form action={formAction}>
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Reviewing…" : "Review stored-thread evidence"}
        </button>
      </form>
      {state && !state.ok ? (
        <ErrorText text="Stored-thread evidence could not be opened." />
      ) : null}
      {state?.ok ? (
        <ClientMemorySection title="Exact stored thread">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            {state.threadSummary.messageCount} messages ·{" "}
            {state.candidates.length} candidate facts · automatic apply false
          </p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            No project changes have been applied
          </p>
        </ClientMemorySection>
      ) : null}
    </div>
  );
}

export function CohortRelatedThreadsForm({ projectId }: { projectId: string }) {
  const action = findCohortRelatedThreads.bind(null, projectId);
  const [state, formAction, pending] = useActionState(
    action,
    null as AchedekalDiscoveryState | null,
  );

  return (
    <div className="mt-8">
      <form action={formAction}>
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Searching index…" : "Re-run related-thread discovery"}
        </button>
      </form>
      {state && !state.ok ? (
        <ErrorText text="Related-thread discovery could not be opened." />
      ) : null}
      {state?.ok ? (
        <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]">
          {state.related.length} related · {state.ambiguous.length} ambiguous ·{" "}
          {state.unassigned.length} unassigned · metadata only · not opened
        </p>
      ) : null}
    </div>
  );
}

export function CohortArtifactHuntForm({ projectId }: { projectId: string }) {
  const action = findCohortArtifactCandidates.bind(null, projectId);
  const [state, formAction, pending] = useActionState(
    action,
    null as ArtifactHuntState | null,
  );

  return (
    <div className="mt-8">
      <form action={formAction}>
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Searching index…" : "Re-run artifact hunt"}
        </button>
      </form>
      {state && !state.ok ? (
        <ErrorText text="Artifact hunt could not be opened." />
      ) : null}
      {state?.ok ? (
        <div className="mt-6">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            {state.likely.length} likely · {state.ambiguous.length} ambiguous ·{" "}
            {state.unassigned.length} unassigned · metadata only · not attached
          </p>
          {state.likely.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {state.likely.map((row) => (
                <li key={row.candidateId}>
                  <p className="break-words text-[15px] leading-relaxed text-[#e7ddd2]">
                    {row.filename || "—"}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#c4b7aa]">
                    {row.subject?.trim() || "Indexed Gmail message"}
                    {row.sentAt ? ` · ${row.sentAt}` : ""}
                  </p>
                  <Link
                    href={conciergeCopyGmailProjectArtifactPath(projectId, {
                      messageId: row.source.messageId,
                      attachmentId: row.source.attachmentId,
                    })}
                    className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                  >
                    Copy to project
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
