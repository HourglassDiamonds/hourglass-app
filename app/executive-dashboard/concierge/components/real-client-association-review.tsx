import {
  CUSTOM_LIFECYCLE_STAGES,
  CUSTOM_LIFECYCLE_STAGE_LABELS,
} from "@/lib/continuum/client-memory/project-lifecycle";
import type {
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

function UnsavedChoices({
  name,
  choices,
}: {
  name: string;
  choices: readonly (readonly [string, string])[];
}) {
  return choices.map(([value, label]) => (
    <label key={value} className="mt-2 flex gap-2 text-[11px] text-[#c9b9a9]">
      <input type="radio" name={name} value={value} />
      <span>{label}</span>
    </label>
  ));
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
        <span className="rounded-full border border-[#d6a66f]/30 px-3 py-1 text-[10px] text-[#d6a66f]">Unsaved worksheet</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#a99c90]">Selections below are not persisted and reset when you leave. Saved association decision: <strong className="text-[#efe8de]">{thread.target?.currentDecision ?? "None"}</strong>.</p>

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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <fieldset className="rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">Person</legend>
          <UnsavedChoices name="morgan-person-decision" choices={[["create", "Create Morgan Jines as a real Person"], ["link", "Link the exact participant to an existing non-fixture Person"], ["unresolved", "Leave Person unresolved"]]} />
        </fieldset>
        <fieldset className="rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">Project</legend>
          <UnsavedChoices name="morgan-project-decision" choices={[["create", "Create the Marquise/custom engagement Project"], ["link", "Link an existing non-fixture Project"], ["unresolved", "Leave Project unresolved"]]} />
        </fieldset>
        <fieldset className="rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">Lifecycle</legend>
          <p className="text-[11px] text-[#8fb59d]">Founder evidence supports Design / pre-production.</p>
          <select name="morgan-project-lifecycle" defaultValue="" className="mt-2 w-full rounded-lg border border-white/10 bg-[#17130f] p-2 text-[11px] text-[#c9b9a9]">
            <option value="" disabled>Approve lifecycle — none saved</option>
            {CUSTOM_LIFECYCLE_STAGES.map((stage) => <option key={stage} value={stage}>{CUSTOM_LIFECYCLE_STAGE_LABELS[stage]}</option>)}
          </select>
        </fieldset>
        <fieldset className="rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">C026937</legend>
          <UnsavedChoices name="morgan-cad-number-decision" choices={[["confirm", "Confirm as the CAD job number"], ["decline", "Keep only as an attachment identifier"], ["unresolved", "Leave its canonical role unresolved"]]} />
        </fieldset>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 p-4">
        <h4 className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">November 6 review-only actions</h4>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <fieldset>
            <legend className="text-[11px] text-[#efe8de]">Send Morgan’s invoice · November 6</legend>
            <p className="mt-1 text-[10px] text-[#d6a66f]">Planned — not sent</p>
            <UnsavedChoices name="morgan-invoice-action" choices={[["approve", "Approve as a founder action"], ["unresolved", "Leave unresolved"]]} />
          </fieldset>
          <fieldset>
            <legend className="text-[11px] text-[#efe8de]">Ship approved marquise to Niurka · November 6</legend>
            <p className="mt-1 text-[10px] text-[#d6a66f]">Planned — not shipped; grouped with James Bowron and Sarah materials</p>
            <UnsavedChoices name="morgan-shipping-action" choices={[["approve", "Approve as a founder action"], ["unresolved", "Leave unresolved"]]} />
          </fieldset>
        </div>
        <p className="mt-4 rounded-lg border border-[#d6a66f]/25 p-3 text-[10px] leading-relaxed text-[#d6a66f]">Lifecycle gate: remain in Design / pre-production. Propose In Production only after founder-confirmed shipment or handoff evidence is recorded.</p>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Next action</p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#a99c90]">Create or link the real Person first, then create or link the Marquise Project with the founder-confirmed Design lifecycle. The review-only actions can be approved only after that canonical target exists.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/executive-dashboard/concierge/client/new" className="rounded-full border border-[#ad9164]/50 px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[#efe8de]">Add Morgan as client</Link>
          <Link href="/executive-dashboard/concierge" className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[#c9b9a9]">Open Project intake</Link>
        </div>
      </div>

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
  const focus = selected.currentProviderThreads[0] ?? null;
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
          {isMorgan && focus.threadId === MORGAN_THREAD_ID ? <MorganFounderWorksheet batch={batch} thread={focus} reviewAction={reviewAction} /> : <section className="mt-5 rounded-xl border border-white/10 p-4"><h3 className="text-[10px] uppercase tracking-[0.14em] text-[#81766c]">Association decision</h3><p className="mt-2 text-[11px] text-[#a99c90]">Saved decision: <strong className="text-[#efe8de]">{focus.target?.currentDecision ?? "None"}</strong></p><AssociationDecisionControls batch={batch} thread={focus} reviewAction={reviewAction} /></section>}
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
