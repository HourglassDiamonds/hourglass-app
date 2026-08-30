import Link from "next/link";
import { conciergeCohort1Path, conciergeCohort1ProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import type { CohortIndexSummary } from "@/lib/continuum/gmail/cohort-reconstruction-compose";
import type { CohortProjectReview } from "@/lib/continuum/gmail/cohort-reconstruction-compose";
import { AchedekalReconstructionProposal } from "./achedekal-reconstruction-proposal";
import { ClientMemorySection } from "./client-memory-section";
import {
  CohortArtifactHuntForm,
  CohortExactThreadForm,
  CohortRelatedThreadsForm,
} from "./cohort-reconstruction-forms";

function FlagList({ flags }: { flags: readonly string[] }) {
  if (flags.length === 0) {
    return <span className="text-[#8d8073]">None flagged</span>;
  }
  return <span>{flags.join(" · ")}</span>;
}

export function CohortReconstructionIndex({
  rows,
}: {
  rows: readonly CohortIndexSummary[];
}) {
  return (
    <ul className="mt-10 space-y-8">
      {rows.map((row) => (
        <li key={row.projectId} className="border-t border-[#3a332c] pt-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad9164]">
            {row.label}
          </p>
          <Link
            href={conciergeCohort1ProjectPath(row.projectId)}
            className="mt-3 inline-flex min-h-11 items-center font-serif text-[1.25rem] leading-snug tracking-[-0.02em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
          >
            {row.title}
          </Link>
          <dl className="mt-4 space-y-2 text-[13px] leading-relaxed text-[#c4b7aa]">
            <div>
              Person linkage: {row.personLinked ? "linked" : "not linked"}
            </div>
            <div>
              Gmail anchor:{" "}
              {row.storedThreadIndexStatus === "no-stored-thread"
                ? "none stored"
                : row.storedThreadIndexStatus === "indexed"
                  ? "stored and indexed"
                  : "stored, index empty"}
            </div>
            <div>
              CAD: {row.strongCad ? "strong structured identifier" : "weak or absent"}
            </div>
            <div>
              Attachment metadata: {row.attachmentMetadataCount}
            </div>
            <div>
              Stored data needing review:{" "}
              <FlagList flags={row.suspiciousStored} />
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function EvidenceList({
  heading,
  empty,
  rows,
}: {
  heading: string;
  empty: string;
  rows: readonly { title: string; detail: string }[];
}) {
  return (
    <ClientMemorySection title={heading}>
      {rows.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => (
            <li key={`${row.title}:${index}`}>
              <p className="text-[15px] text-[#efe8de]">{row.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#c4b7aa]">
                {row.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </ClientMemorySection>
  );
}

export function CohortProjectReviewView({
  review,
}: {
  review: CohortProjectReview;
}) {
  const discovery = review.discovery.ok ? review.discovery : null;
  const hunt = review.hunt.ok ? review.hunt : null;
  const related = (discovery?.related ?? []).map((row) => ({
    title: row.subject?.trim() || "Untitled thread",
    detail: `${row.strength} · score ${row.score} · metadata only · not opened`,
  }));
  const ambiguousThreads = (discovery?.ambiguous ?? []).map((row) => ({
    title: row.subject?.trim() || "Untitled thread",
    detail: "Ambiguous between Project Books. Not attached.",
  }));
  const artifacts = (hunt?.likely ?? []).map((row) => ({
    title: row.filename || "Untitled artifact",
    detail: [
      row.classification.label,
      row.evidenceReasons[0]?.detail,
      "metadata only",
      "not attached",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const ambiguousArtifacts = (hunt?.ambiguous ?? []).map((row) => ({
    title: row.filename || "Untitled artifact",
    detail: "Ambiguous between Project Books. Not attached.",
  }));

  return (
    <div className="mt-10 space-y-4">
      <ClientMemorySection title="Current stored data">
        <dl className="space-y-3">
          {review.currentStored.map((row) => {
            const assessed = review.proposalView.conflictingStoredData.find(
              (item) => item.label === row.label,
            );
            return (
              <div key={row.label}>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                  {row.label}
                </dt>
                <dd className="mt-1 text-[15px] text-[#d8cfc4]">{row.value || "—"}</dd>
                {assessed?.note ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-[#c4b7aa]">
                    {assessed.note}
                  </p>
                ) : null}
              </div>
            );
          })}
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-[#c4b7aa]">
          Person linkage: {review.personLinked ? "linked" : "not linked"}. Gmail
          anchor: {review.storedThreadIndexStatus.split("-").join(" ")}.
          Flagged stored fields:{" "}
          {review.suspiciousStored.length > 0
            ? review.suspiciousStored.join(", ")
            : "none"}
          . Supported recovered evidence is corroboration only — not canonical.
        </p>
      </ClientMemorySection>

      <EvidenceList
        heading="Candidate related threads"
        empty="No related-thread candidates from the bounded index search."
        rows={related}
      />
      <EvidenceList
        heading="Ambiguous threads"
        empty="No ambiguous threads in the bounded review set."
        rows={ambiguousThreads}
      />
      <EvidenceList
        heading="Artifact candidates"
        empty="No likely artifact candidates from metadata hunt."
        rows={artifacts}
      />
      <EvidenceList
        heading="Ambiguous artifacts"
        empty="No ambiguous artifacts in the bounded review set."
        rows={ambiguousArtifacts}
      />

      <AchedekalReconstructionProposal proposal={review.proposal} />

      {review.storedGmailAnchor ? (
        <ClientMemorySection title="Exact stored thread">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            Founder-only retrieval of the stored project thread. No mailbox
            search. No attachment bytes.
          </p>
          <CohortExactThreadForm projectId={review.projectId} />
        </ClientMemorySection>
      ) : (
        <ClientMemorySection title="Exact stored thread">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            No stored Gmail thread pointer on this Project Book.
          </p>
        </ClientMemorySection>
      )}

      <ClientMemorySection title="Index discovery">
        <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
          Project reads {review.queryBounds.projectReads} · thread reads{" "}
          {review.queryBounds.threadReads} · attachment-index searches{" "}
          {review.queryBounds.attachmentIndexSearches} · hydrate cap{" "}
          {review.queryBounds.hydrateCap} · full mailbox scan false
        </p>
        <CohortRelatedThreadsForm projectId={review.projectId} />
        <CohortArtifactHuntForm projectId={review.projectId} />
      </ClientMemorySection>

      <p className="pt-4 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Review only · automatic apply false · no canonical writes
      </p>
      <Link
        href={conciergeCohort1Path()}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← Cohort 1
      </Link>
    </div>
  );
}
