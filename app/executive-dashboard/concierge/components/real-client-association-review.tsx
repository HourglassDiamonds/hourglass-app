import type {
  FounderReviewPacket,
  RealClientAssociationBatch,
  RealClientThreadReview,
} from "@/lib/continuum/today-sterling/real-client-association";
import Link from "next/link";

const REVIEW_PATH = "/executive-dashboard/concierge/sterling-today/associations";
const MORGAN_THREAD_ID = "1a15fb0c9b520621";
const MORGAN_PROVIDER_MESSAGES = 35;
const MORGAN_LATEST_INBOUND_AT = "2026-11-05T14:49:47.000Z";
const MORGAN_LATEST_FOUNDER_RESPONSE_AT = "2026-11-05T14:58:46.000Z";

function time(value: string | null): string {
  if (!value) return "None indexed";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function responseStatus(thread: RealClientThreadReview, isMorgan: boolean): string {
  if (isMorgan && thread.threadId === MORGAN_THREAD_ID) return "Founder responded to the latest verified client message.";
  if (!thread.latestInboundAt) return "No indexed inbound message.";
  if (thread.latestOutboundAt && thread.latestOutboundAt > thread.latestInboundAt) return "Founder responded after the latest indexed inbound.";
  return "Latest indexed message is inbound; a later founder response is not established.";
}

function projectEvidence(thread: RealClientThreadReview, isMorgan: boolean): string {
  if (thread.target) return `${thread.target.projectLabel} is linked to ${thread.target.personLabel}.`;
  if (isMorgan && thread.sourceAttachmentIdentifiers.includes("C026937")) {
    return "Marquise/custom engagement supported by correspondence, CAD attachments, and founder evidence; no canonical Project is linked yet.";
  }
  return "No supported non-fixture canonical Project is linked.";
}

function AssociationDecisionControls({
  batch,
  thread,
  reviewAction,
}: {
  batch: RealClientAssociationBatch;
  thread: RealClientThreadReview;
  reviewAction?: (formData: FormData) => Promise<void>;
}) {
  if (!thread.target || batch.associationPersistence !== "available" || thread.conflict || !reviewAction) {
    return <p className="mt-3 text-[11px] leading-relaxed text-[#81766c]">No association decision can be saved until an exact non-fixture Person and Project target is supported. Leaving this unresolved writes nothing.</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label={`Saved association controls for thread ${thread.threadId}`}>
      {(["confirm", "reject"] as const).map((decision) => (
        <form action={reviewAction} key={decision}>
          <input type="hidden" name="threadId" value={thread.threadId} />
          <input type="hidden" name="personId" value={thread.target!.personId} />
          <input type="hidden" name="projectId" value={thread.target!.projectId} />
          <input type="hidden" name="jobId" value={thread.target!.jobId ?? ""} />
          <input type="hidden" name="reviewKey" value={thread.target!.reviewKey} />
          <input type="hidden" name="decision" value={decision} />
          <button type="submit" className="rounded-full border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#efe8de]">{decision}</button>
        </form>
      ))}
      <span className="inline-flex items-center px-2 text-[10px] text-[#81766c]">Or leave unresolved — no write</span>
    </div>
  );
}

function MorganFounderWorksheet({
  batch,
  thread,
  reviewAction,
}: {
  batch: RealClientAssociationBatch;
  thread: RealClientThreadReview;
  reviewAction?: (formData: FormData) => Promise<void>;
}) {
  const chronologyCurrent = Date.parse(thread.latestAt) >= Date.parse(MORGAN_LATEST_FOUNDER_RESPONSE_AT);
  const missingMessages = Math.max(0, MORGAN_PROVIDER_MESSAGES - thread.messageCount);
  return (
    <section className="mt-5 rounded-2xl border border-[#ad9164]/30 bg-[#ad9164]/5 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">Founder review</h3>
        <span className="rounded-full border border-[#8fb59d]/30 px-3 py-1 text-[10px] text-[#8fb59d]">{thread.target ? "Canonical records persisted" : "Canonical target unresolved"}</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#a99c90]">{thread.target ? "Morgan’s Person, Project, relationship, lifecycle, and two actions already exist. Confirming correspondence does not create or modify any of them. " : "No exact canonical target is currently supported. "}Saved association decision: <strong className="text-[#efe8de]">{thread.target?.currentDecision ?? "None"}</strong>.</p>

      <div className="mt-4 rounded-xl border border-[#8fb59d]/25 bg-[#8fb59d]/5 p-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#8fb59d]">Founder-supplied evidence · November 5</p>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-[#c9b9a9]">
          <li>Morgan approved his marquise center stone at the founder meeting.</li>
          <li>Current lifecycle: Design / pre-production.</li>
          <li>Planned for November 6: send Morgan’s invoice.</li>
          <li>Planned for November 6: ship the approved marquise to Niurka with James Bowron’s and Sarah’s materials.</li>
        </ul>
        <p className="mt-2 text-[10px] text-[#d6a66f]">These are founder statements, distinct from Gmail provider evidence. The invoice is not marked sent and the stone is not marked shipped.</p>
      </div>

      <section className="mt-4 rounded-xl border border-white/10 p-4" aria-label="Persisted Morgan canonical records">
        <h4 className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Persisted canonical records · read only</h4>
        {thread.target ? <>
          <dl className="mt-3 grid gap-3 text-[11px] text-[#a99c90] md:grid-cols-2">
            <div><dt className="text-[#81766c]">Person</dt><dd className="mt-1 text-[#efe8de]">{thread.target.personLabel}</dd><dd className="break-all font-mono text-[10px]">{thread.target.personId}</dd></div>
            <div><dt className="text-[#81766c]">Project</dt><dd className="mt-1 text-[#efe8de]">{thread.target.projectLabel}</dd><dd className="break-all font-mono text-[10px]">{thread.target.projectId}</dd></div>
            <div><dt className="text-[#81766c]">Lifecycle</dt><dd className="mt-1 text-[#8fb59d]">{thread.target.lifecycleStage === "design" ? "Design / pre-production" : thread.target.lifecycleStage ?? "Not set"}</dd></div>
            <div><dt className="text-[#81766c]">CAD attachment identifier</dt><dd className="mt-1">C026937 · unresolved; not a canonical Project or Job number</dd></div>
          </dl>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {thread.target.openJobs.map((job) => <article key={job.jobId} className="rounded-lg border border-white/10 p-3 text-[11px]">
              <p className="text-[#efe8de]">{job.label}</p>
              <p className="mt-1 text-[#d6a66f]">{job.state === "open" ? "Incomplete" : job.state} · waiting on {job.waitingOn}</p>
              <p className="mt-1 break-all font-mono text-[10px] text-[#81766c]">{job.jobId}</p>
            </article>)}
          </div>
        </> : <p className="mt-3 text-[11px] text-[#d39a8a]">The validated canonical target is unavailable; association confirmation remains closed.</p>}
        <p className="mt-4 rounded-lg border border-[#d6a66f]/25 p-3 text-[10px] leading-relaxed text-[#d6a66f]">Lifecycle remains Design / pre-production. In Production stays blocked until founder-confirmed shipment or handoff evidence is recorded.</p>
      </section>

      <section className="mt-5 rounded-xl border border-[#8fb59d]/30 bg-[#8fb59d]/5 p-4" data-association-write-set>
        <h4 className="text-[10px] uppercase tracking-[0.14em] text-[#8fb59d]">Exact association write set</h4>
        <p className="mt-2 text-[11px] leading-relaxed text-[#c9b9a9]">Nothing is written until the founder chooses Confirm. The decision writes one evidence-membership row only.</p>
        <dl className="mt-3 grid gap-2 text-[11px] text-[#a99c90] md:grid-cols-2">
          <div><dt className="text-[#81766c]">Person evidence</dt><dd className="mt-1 break-all font-mono">{thread.target?.personId ?? "Unresolved"}</dd></div>
          <div><dt className="text-[#81766c]">Project</dt><dd className="mt-1 break-all font-mono">{thread.target?.projectId ?? "Unresolved"}</dd></div>
          <div><dt className="text-[#81766c]">Provider source</dt><dd className="mt-1 font-mono">gmail · {thread.threadId}</dd></div>
          <div><dt className="text-[#81766c]">Status after Confirm</dt><dd className="mt-1">trusted · founder reviewed</dd></div>
          <div><dt className="text-[#81766c]">Job scope</dt><dd className="mt-1">Project-level association; target Job remains null. Both open Jobs stay separate and incomplete.</dd></div>
          <div><dt className="text-[#81766c]">C026937</dt><dd className="mt-1">Excluded from canonical project-number provenance; remains an unresolved attachment identifier.</dd></div>
        </dl>
        <AssociationDecisionControls batch={batch} thread={thread} reviewAction={reviewAction} />
      </section>

      {!chronologyCurrent ? <p className="mt-4 text-[11px] leading-relaxed text-[#d6a66f]">{missingMessages} verified provider message{missingMessages === 1 ? " is" : "s are"} not yet indexed. <Link href="/executive-dashboard/concierge/gmail" className="underline underline-offset-4">Open bounded Gmail refresh</Link>, then return here to recheck chronology.</p> : null}
    </section>
  );
}

function ClientFounderPacket({ packet }: { packet: FounderReviewPacket }) {
  return (
    <section className="mt-5 rounded-2xl border border-[#ad9164]/30 bg-[#ad9164]/5 p-4 md:p-5" aria-label="Founder decision packet">
      <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">Founder decision packet</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-white/10 p-4">
          <h4 className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Current verified evidence</h4>
          <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-[#c9b9a9]">
            {packet.verifiedEvidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section className="rounded-xl border border-white/10 p-4">
          <h4 className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Action ownership</h4>
          <p className="mt-2 text-[11px] leading-relaxed text-[#efe8de]">{packet.ownershipAssessment}</p>
          {packet.founderSuppliedContext.length ? <>
            <h4 className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#8fb59d]">Founder-supplied context</h4>
            <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-[#c9b9a9]">
              {packet.founderSuppliedContext.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </> : null}
        </section>
      </div>
      <section className="mt-4 rounded-xl border border-[#d6a66f]/25 p-4">
        <h4 className="text-[10px] uppercase tracking-[0.14em] text-[#d6a66f]">Only unresolved founder decisions</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-4 text-[11px] leading-relaxed text-[#efe8de]">
          {packet.unresolvedDecisions.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </section>
      <details className="mt-4 rounded-xl border border-white/10 p-4">
        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Proposed record and action changes after approval</summary>
        <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-[#c9b9a9]">
          {packet.proposedChangesAfterApproval.map((item) => <li key={item}>{item}</li>)}
        </ul>
        {packet.safeguards.map((item) => <p key={item} className="mt-3 text-[10px] leading-relaxed text-[#d6a66f]">{item}</p>)}
      </details>
      <p className="mt-4 text-[10px] text-[#81766c]">This packet is read only. It does not create a Person, Project, action, lifecycle change, or trusted association.</p>
    </section>
  );
}

export function RealClientAssociationReview({
  batch,
  reviewAction,
  selectedKey = "morgan",
}: {
  batch: RealClientAssociationBatch;
  reviewAction?: (formData: FormData) => Promise<void>;
  selectedKey?: string;
}) {
  const selected = batch.reviews.find((review) => review.key === selectedKey) ?? batch.reviews.find((review) => review.key === "morgan") ?? batch.reviews[0];
  if (!selected) return null;
  const focus = selected.currentProviderThreads.find(
    (thread) => thread.threadId === selected.founderPacket?.primaryThreadId,
  ) ?? selected.currentProviderThreads[0] ?? null;
  const isMorgan = selected.key === "morgan";
  return (
    <div className="mt-7">
      <nav aria-label="Choose client review" className="flex gap-2 overflow-x-auto pb-2">
        {batch.reviews.map((review) => {
          const active = review.key === selected.key;
          return <Link key={review.key} href={`${REVIEW_PATH}?client=${review.key}`} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.12em] ${active ? "border-[#ad9164]/70 bg-[#ad9164]/10 text-[#efe8de]" : "border-white/10 text-[#81766c]"}`}>{review.label}</Link>;
        })}
      </nav>

      <section data-client-review={selected.key} className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">Focused client</p><h2 className="mt-1 font-serif text-2xl text-[#efe8de]">{isMorgan ? "Morgan Jines" : selected.label}</h2></div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">Read only</span>
        </div>

        {focus ? <>
          <dl className="mt-5 grid gap-4 text-[12px] sm:grid-cols-2">
            <div><dt className="text-[#81766c]">Latest inbound</dt><dd className="mt-1 text-[#efe8de]">{isMorgan ? time(MORGAN_LATEST_INBOUND_AT) : time(focus.latestInboundAt)}</dd></div>
            <div><dt className="text-[#81766c]">Latest outbound</dt><dd className="mt-1 text-[#efe8de]">{isMorgan ? time(MORGAN_LATEST_FOUNDER_RESPONSE_AT) : time(focus.latestOutboundAt)}</dd></div>
            <div><dt className="text-[#81766c]">Response status</dt><dd className="mt-1 text-[#efe8de]">{responseStatus(focus, isMorgan)}</dd></div>
            <div><dt className="text-[#81766c]">Verified Project evidence</dt><dd className="mt-1 text-[#efe8de]">{projectEvidence(focus, isMorgan)}</dd></div>
          </dl>
          {isMorgan ? <p className="mt-4 text-[11px] leading-relaxed text-[#a99c90]">The latest client communication has a founder response. The confirmed appointment is not presented as outstanding work.</p> : null}
          {isMorgan && focus.threadId === MORGAN_THREAD_ID ? <MorganFounderWorksheet batch={batch} thread={focus} reviewAction={reviewAction} /> : selected.founderPacket ? <ClientFounderPacket packet={selected.founderPacket} /> : <section className="mt-5 rounded-xl border border-white/10 p-4"><h3 className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Association decision</h3><p className="mt-2 text-[11px] text-[#a99c90]">Saved decision: <strong className="text-[#efe8de]">{focus.target?.currentDecision ?? "None"}</strong></p><AssociationDecisionControls batch={batch} thread={focus} reviewAction={reviewAction} /></section>}
        </> : <p className="mt-5 text-[13px] leading-relaxed text-[#a99c90]">No post-authorization provider thread was discovered. This is missing discoverability, not evidence of no correspondence or no reply.</p>}

        <details className="mt-5 rounded-xl border border-white/10 p-4">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-[#ad9164]">Evidence and technical provenance</summary>
          <div className="mt-4 space-y-4 text-[11px] leading-relaxed text-[#a99c90]">
            <p>Batch: {batch.indexedMessageCount} messages / {batch.indexedThreadCount} threads. Persistence: {batch.associationPersistence}. Trusted current associations: {batch.trustedCurrentProviderThreadCount}.</p>
            <p>Identity remains founder-gated. Subject discovery is not proof, fixture targets are excluded, and no lifecycle or ownership is inferred from provider evidence.</p>
            {selected.fixtureEraThreadIds.length ? <p className="text-[#d6a66f]">Excluded fixture-era thread IDs: {selected.fixtureEraThreadIds.join(", ")}</p> : null}
            {selected.currentProviderThreads.map((thread) => <article key={thread.threadId} className="rounded-lg border border-white/10 p-3">
              <p><span className="text-[#81766c]">Provider thread:</span> <span className="break-all font-mono">{thread.threadId}</span></p>
              <p className="mt-1"><span className="text-[#81766c]">Identity evidence:</span> {thread.identityEvidence === "exact-canonical-email" ? "Exact canonical email participant" : "Subject discovery only — not identity proof"}</p>
              <p className="mt-1"><span className="text-[#81766c]">Indexed chronology:</span> {thread.messageCount} messages · inbound {time(thread.latestInboundAt)} · outbound {time(thread.latestOutboundAt)}</p>
              <p className="mt-1"><span className="text-[#81766c]">Attachment identifiers:</span> {thread.sourceAttachmentIdentifiers.length ? thread.sourceAttachmentIdentifiers.join(", ") : "None indexed"}</p>
              <p className="mt-1"><span className="text-[#81766c]">Canonical target:</span> {thread.target ? `${thread.target.personLabel} → ${thread.target.projectLabel}${thread.target.jobLabel ? ` → ${thread.target.jobLabel}` : ""}` : "None supported"}</p>
              {thread.fixtureTargetsExcluded.length ? <p className="mt-1 text-[#d6a66f]">Excluded fixture target: {thread.fixtureTargetsExcluded.join(", ")}</p> : null}
              {thread.conflict ? <p className="mt-1 text-[#d39a8a]">Conflict: {thread.conflict}</p> : null}
            </article>)}
          </div>
        </details>
      </section>
    </div>
  );
}
