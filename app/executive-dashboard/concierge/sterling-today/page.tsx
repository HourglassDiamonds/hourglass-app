import Link from "next/link";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { SterlingTodayShadowControl } from "../components/sterling-today-shadow-control";
import { reviewCanonicalSterlingProposal } from "./approval-actions";
import { getAuthenticatedCanonicalApprovalReviewAccess } from "@/lib/continuum/today-sterling/canonical-approval-load";
import type { CanonicalApprovalReview } from "@/lib/continuum/today-sterling/canonical-approval-review";
import {
  isSterlingTodayDurableLeaseAvailable,
  isSterlingTodaySarahSemanticFeatureEnabled,
  isSterlingTodaySemanticFeatureEnabled,
} from "@/lib/continuum/today-sterling/server-config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata = {
  title: "Sterling Today founder review",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function SterlingTodayShadowPage({ searchParams }: {
  searchParams: Promise<{ proposal?: string; result?: string }>;
}) {
  const query = await searchParams;
  const semanticAvailable = isSterlingTodaySemanticFeatureEnabled() && isSterlingTodayDurableLeaseAvailable();
  const sarahSemanticAvailable = isSterlingTodaySarahSemanticFeatureEnabled();
  const reviewAccess = await getAuthenticatedCanonicalApprovalReviewAccess();
  const proposals = reviewAccess.ok ? await reviewAccess.repository.list(50) : [];
  const selected = reviewAccess.ok && query.proposal
    ? proposals.find((proposal) => proposal.proposalId === query.proposal) ?? await reviewAccess.repository.get(query.proposal)
    : proposals[0] ?? null;
  const review = reviewAccess.ok && selected ? await reviewAccess.reader.load(selected) : null;
  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <section className="mt-8 max-w-4xl rounded-3xl border border-[#ad9164]/25 bg-[#17130f] p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">Preview only · founder decision required</p>
        <h1 className="mt-3 font-serif text-[1.9rem] font-normal tracking-[-0.035em] text-[#efe8de]">
          Sterling canonical approvals
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#a99c90]">
          Viewing a proposal never changes canonical records. Approval executes the exact server-loaded payload through the
          reviewed transaction; rejection records a durable decision without a canonical mutation.
        </p>
        <Link href="/executive-dashboard/concierge/sterling-today/readiness" className="mt-4 inline-block text-[11px] uppercase tracking-[0.14em] text-[#ad9164] underline underline-offset-4">
          Open read-only publication readiness
        </Link>
        <Link href="/executive-dashboard/concierge/sterling-today/operational-review" className="ml-5 mt-4 inline-block text-[11px] uppercase tracking-[0.14em] text-[#ad9164] underline underline-offset-4">
          Open bounded operational shadow
        </Link>
        {!reviewAccess.ok ? (
          <p role="alert" className="mt-6 rounded-xl border border-[#d39a8a]/30 p-4 text-[13px] text-[#d39a8a]">
            {reviewAccess.reason === "not-preview"
              ? "Canonical approval is unavailable outside the verified isolated Preview runtime."
              : "Founder approval data is unavailable. Sign in again or retry later."}
          </p>
        ) : proposals.length === 0 ? (
          <p className="mt-6 rounded-xl border border-white/10 p-4 text-[13px] text-[#9d9084]">
            No durable transactional proposals are awaiting review. No synthetic shared-Preview records were created.
          </p>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.5fr)]">
            <nav aria-label="Sterling proposals" className="space-y-2">
              {proposals.map((proposal) => (
                <Link key={proposal.proposalId}
                  href={`/executive-dashboard/concierge/sterling-today?proposal=${proposal.proposalId}`}
                  className={`block rounded-xl border p-3 text-[12px] transition ${selected?.proposalId === proposal.proposalId ? "border-[#ad9164]/60 bg-[#ad9164]/10 text-[#efe8de]" : "border-white/10 text-[#a99c90] hover:border-white/20"}`}>
                  <span className="block text-[10px] uppercase tracking-[0.15em]">{proposal.proposalType.replaceAll("_", " ")}</span>
                  <span className="mt-1 block break-all">{proposal.proposalId}</span>
                  <span className="mt-1 block text-[#81766c]">{proposal.status} · v{proposal.recordVersion}</span>
                </Link>
              ))}
            </nav>
            {review ? <FounderProposalReview review={review} result={query.result} /> : null}
          </div>
        )}
      </section>
      <SterlingTodayShadowControl
        semanticAvailable={semanticAvailable}
        sarahSemanticAvailable={sarahSemanticAvailable}
      />
    </ConciergeShell>
  );
}

function FounderProposalReview({ review, result }: { review: CanonicalApprovalReview; result?: string }) {
  const proposal = review.proposal;
  const statusMessage = result ? reviewResultMessage(result) : null;
  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">Exact proposal identity</p>
          <p className="mt-2 break-all text-[12px] text-[#efe8de]">{proposal.proposalId}</p>
        </div>
        <p className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#a99c90]">
          {proposal.status} · record v{proposal.recordVersion}
        </p>
      </div>
      {statusMessage ? (
        <p role={statusMessage.ok ? "status" : "alert"} className={`mt-4 rounded-xl border p-3 text-[13px] ${statusMessage.ok ? "border-[#a9bd8e]/30 text-[#a9bd8e]" : "border-[#d39a8a]/30 text-[#d39a8a]"}`}>
          {statusMessage.message}
        </p>
      ) : null}

      <ReviewSection title="Canonical identities">
        {review.identity.project ? (
          <dl className="space-y-1">
            <ReviewRow label="Project" value={`${review.identity.project.displayTitle} · ${review.identity.project.projectId}`} />
            <ReviewRow label="Project kind" value={review.identity.project.projectKind} />
          </dl>
        ) : null}
        {review.identity.people.map((person) => (
          <dl key={person.personId} className="mt-3 space-y-1 rounded-lg border border-white/10 p-3">
            <ReviewRow label="Client" value={`${person.displayName} · ${person.personId}`} />
            <ReviewRow label="Project binding" value={person.relationshipVerified ? "Verified" : "Missing"} />
          </dl>
        ))}
        {review.identity.jobs.map((job) => (
          <dl key={job.jobId} className="mt-3 space-y-1 rounded-lg border border-white/10 p-3">
            <ReviewRow label="Job" value={`${job.subject} · ${job.jobId}`} />
            <ReviewRow label="Current state" value={`${job.state} · waiting on ${job.waitingOn}`} />
            <ReviewRow label="Client / Project" value={`${job.personId ?? "missing"} / ${job.projectId ?? "missing"}`} />
            <ReviewRow label="Record version" value={job.updatedAt} />
          </dl>
        ))}
        {review.identity.candidate ? (
          <dl className="space-y-1 rounded-lg border border-white/10 p-3">
            <ReviewRow label="Candidate" value={review.identity.candidate.candidateId} />
            <ReviewRow label="Exact source" value={`${review.identity.candidate.sourceSystem} · ${review.identity.candidate.sourceRef}`} />
            <ReviewRow label="Verified identity hash" value={review.identity.candidate.emailHash ?? "Missing"} />
            <ReviewRow label="Candidate state" value={`${review.identity.candidate.candidateState} · ${review.identity.candidate.reviewStatus}`} />
            <ReviewRow label="Record version" value={review.identity.candidate.recordVersion} />
          </dl>
        ) : null}
      </ReviewSection>

      <ReviewSection title="Existing canonical state">
        {review.currentLifecycle
          ? <p>Lifecycle: <span className="text-[#efe8de]">{review.currentLifecycle.stage ?? "not set"}</span> · version {review.currentLifecycle.recordVersion}</p>
          : <p>{review.identity.candidate ? "Candidate source state shown above." : "No lifecycle state exists."}</p>}
      </ReviewSection>

      <ReviewSection title="Proposed precise changes">
        <div className="space-y-3">
          {review.proposedChanges.map((change) => (
            <div key={change.operationId} className="rounded-lg border border-[#ad9164]/25 p-3">
              <p className="text-[#efe8de]">{change.target}</p>
              <p className="mt-1">{change.kind.replaceAll("_", " ")} · expected version {change.expectedRecordVersion}</p>
              <p className="mt-1 break-all">Person {change.personId ?? "not applicable"}{change.jobId ? ` · Job ${change.jobId}` : ""}</p>
              <p className="mt-2 break-all text-[11px] text-[#81766c]">Evidence: {change.evidenceRefs.join(", ")}</p>
            </div>
          ))}
        </div>
      </ReviewSection>

      <ReviewSection title="Reasoning and provenance">
        <p className="text-[#c4b7aa]">{proposal.reasoningSummary}</p>
        <p className="mt-2 break-all text-[11px] text-[#81766c]">Proposal evidence: {proposal.evidenceRefs.join(", ")}</p>
      </ReviewSection>

      <ReviewSection title="Ambiguity and missing evidence">
        {review.ambiguities.length === 0 ? <p className="text-[#a9bd8e]">No structural identity, version, or declared-evidence gap detected.</p> : (
          <ul className="list-disc space-y-1 pl-5 text-[#d39a8a]">
            {review.ambiguities.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-[#81766c]">Live Gmail retrieval is not performed by this review screen and remains a separate acceptance gate.</p>
      </ReviewSection>

      {proposal.executionReceipt != null ? (
        <ReviewSection title="Durable execution receipt">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-[#a9bd8e]">{JSON.stringify(proposal.executionReceipt, null, 2)}</pre>
        </ReviewSection>
      ) : null}

      {review.canApprove || review.canReject ? (
        <form action={reviewCanonicalSterlingProposal} className="mt-6 border-t border-white/10 pt-5">
          <input type="hidden" name="proposalId" value={proposal.proposalId} />
          <input type="hidden" name="expectedRecordVersion" value={proposal.recordVersion} />
          <label className="block text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">
            Founder note (optional)
            <textarea name="note" maxLength={1000} rows={3} className="mt-2 block w-full rounded-xl border border-white/10 bg-[#171411] p-3 text-[13px] normal-case tracking-normal text-[#efe8de]" />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            {review.canApprove ? <button name="reviewAction" value="approve" className="min-h-11 rounded-xl bg-[#ad9164] px-4 text-[11px] uppercase tracking-[0.15em] text-[#17120e]">Approve and apply once</button> : null}
            {review.canReject ? <button name="reviewAction" value="reject" className="min-h-11 rounded-xl border border-white/15 px-4 text-[11px] uppercase tracking-[0.15em] text-[#c4b7aa]">Reject · no canonical change</button> : null}
          </div>
          <p className="mt-3 text-[11px] text-[#81766c]">Review/defer is unavailable for transactional canonical proposals because no tested reversible canonical-defer RPC exists.</p>
        </form>
      ) : (
        <p className="mt-6 border-t border-white/10 pt-5 text-[12px] text-[#81766c]">This proposal is not currently actionable. Refresh shows its durable decision and receipt.</p>
      )}
    </article>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 border-t border-white/10 pt-4 text-[12px] leading-relaxed text-[#a99c90]"><h2 className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">{title}</h2>{children}</section>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 sm:grid-cols-[120px_1fr]"><dt className="text-[#81766c]">{label}</dt><dd className="break-all text-[#c4b7aa]">{value}</dd></div>;
}

function reviewResultMessage(result: string): { ok: boolean; message: string } {
  const messages: Record<string, { ok: boolean; message: string }> = {
    executed: { ok: true, message: "Approved and applied atomically. The receipt below is durable." },
    "already-present": { ok: true, message: "Exact replay recognized. No duplicate canonical or history write was created." },
    rejected: { ok: true, message: "Rejected durably. No canonical record was changed." },
    "approved-pending-execution": {
      ok: false,
      message: "Founder approval was recorded durably, but canonical execution did not complete. The approved decision remains pending without a success receipt; preserve it for review before retrying.",
    },
    "stale-version": { ok: false, message: "The proposal or canonical record changed. Refresh and review the current version." },
    "conflicting-replay": { ok: false, message: "The repeat request conflicts with the executed decision or payload and was rejected." },
    "review-blocked": { ok: false, message: "Approval is blocked by the identity, version, or evidence findings shown below." },
    "proposal-not-found": { ok: false, message: "The exact proposal no longer exists." },
    "not-preview": { ok: false, message: "This workflow is available only in verified isolated Preview." },
    unauthorized: { ok: false, message: "Founder authorization is required." },
  };
  return messages[result] ?? { ok: false, message: "The transaction was rejected safely. No partial mutation was accepted." };
}
