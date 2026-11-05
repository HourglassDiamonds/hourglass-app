import type { RealClientAssociationBatch } from "@/lib/continuum/today-sterling/real-client-association";
import Link from "next/link";

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

export function RealClientAssociationReview({
  batch,
  reviewAction,
}: {
  batch: RealClientAssociationBatch;
  reviewAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mt-7 space-y-7">
      <section className="rounded-2xl border border-white/10 p-4">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">Read-only batch status</h2>
        <dl className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
          <div><dt className="text-[#81766c]">Indexed corpus</dt><dd>{batch.indexedMessageCount} messages / {batch.indexedThreadCount} threads</dd></div>
          <div><dt className="text-[#81766c]">Current cohort evidence</dt><dd>{batch.currentProviderThreadCount} provider threads</dd></div>
          <div><dt className="text-[#81766c]">Trusted associations</dt><dd>{batch.trustedCurrentProviderThreadCount}</dd></div>
          <div><dt className="text-[#81766c]">Persistence</dt><dd>{batch.associationPersistence}</dd></div>
        </dl>
        <p className="mt-4 text-[12px] leading-relaxed text-[#d6a66f]">
          Confirm and Reject are enabled only for an exact canonical email participant, an active Person → Project relationship, and activated durable persistence. Leave unresolved never writes.
        </p>
      </section>

      {batch.reviews.map((review) => (
        <section key={review.key} className="rounded-2xl border border-white/10 bg-black/10 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-[#efe8de]">{review.label}</h2>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#81766c]">{review.status.replaceAll("-", " ")}</p>
            </div>
            {review.fixtureEraThreadIds.length ? (
              <p className="rounded-full border border-[#d6a66f]/30 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[#d6a66f]">
                {review.fixtureEraThreadIds.length} fixture-era thread{review.fixtureEraThreadIds.length === 1 ? "" : "s"} excluded
              </p>
            ) : null}
          </div>

          {review.currentProviderThreads.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#a99c90]">No post-authorization provider thread was discovered by the bounded subject-token check. This is missing discoverability, not evidence of no correspondence or no reply.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {review.currentProviderThreads.map((thread) => (
                <article key={thread.threadId} className="rounded-xl border border-white/10 p-4">
                  <dl className="grid gap-3 text-[12px] md:grid-cols-2">
                    <div><dt className="text-[#81766c]">Provider thread</dt><dd className="break-all font-mono text-[11px]">{thread.threadId}</dd></div>
                    <div><dt className="text-[#81766c]">Evidence strength</dt><dd>{thread.identityEvidence === "exact-canonical-email" ? "Exact canonical email participant" : "Subject discovery only — not identity proof"}</dd></div>
                    <div><dt className="text-[#81766c]">Messages</dt><dd>{thread.messageCount} · {time(thread.earliestAt)} to {time(thread.latestAt)}</dd></div>
                    <div><dt className="text-[#81766c]">Attachment identifiers</dt><dd>{thread.sourceAttachmentIdentifiers.length ? thread.sourceAttachmentIdentifiers.join(", ") : "None indexed"}</dd></div>
                    <div><dt className="text-[#81766c]">Latest directions</dt><dd>Inbound {time(thread.latestInboundAt)} · Outbound {time(thread.latestOutboundAt)}</dd></div>
                    <div><dt className="text-[#81766c]">Plausible next owner</dt><dd>{thread.plausibleNextOwner} · chronology only, not a lifecycle decision</dd></div>
                    <div><dt className="text-[#81766c]">Proposed target</dt><dd>{thread.target ? `${thread.target.personLabel} → ${thread.target.projectLabel}${thread.target.jobLabel ? ` → ${thread.target.jobLabel}` : ""}` : "Unresolved — no supported non-fixture canonical target"}</dd></div>
                    <div><dt className="text-[#81766c]">Founder decision</dt><dd>{thread.target?.currentDecision ?? "unresolved"}</dd></div>
                  </dl>
                  {thread.fixtureTargetsExcluded.length ? <p className="mt-3 text-[11px] text-[#d6a66f]">Excluded fixture target: {thread.fixtureTargetsExcluded.join(", ")}</p> : null}
                  {thread.conflict ? <p className="mt-3 text-[11px] text-[#d39a8a]">Conflict: {thread.conflict}</p> : null}
                  {!thread.target && thread.sourceAttachmentIdentifiers.length ? (
                    <div className="mt-4 rounded-xl border border-[#ad9164]/25 bg-[#ad9164]/5 p-4 text-[12px] leading-relaxed text-[#c9b9a9]">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#ad9164]">Founder-reviewable canonical proposal</p>
                      <p className="mt-2">
                        Create a canonical Person only from the exact provider participant, then create or link one client Project only after its lifecycle is confirmed. Keep {thread.sourceAttachmentIdentifiers.join(", ")} as a source attachment identifier until the founder confirms whether it is the CAD job number. No Job or Today ownership is proposed from subject text alone.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link href="/executive-dashboard/concierge/client/new" className="text-[#d6a66f] underline underline-offset-4">Open Add Client</Link>
                        <Link href="/executive-dashboard/concierge" className="text-[#d6a66f] underline underline-offset-4">Open founder project intake</Link>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2" aria-label={`Founder decision contract for ${review.label} thread ${thread.threadId}`}>
                    {thread.target && batch.associationPersistence === "available" && !thread.conflict && reviewAction ? (
                      <>
                        {(["confirm", "reject"] as const).map((decision) => (
                          <form action={reviewAction} key={decision}>
                            <input type="hidden" name="threadId" value={thread.threadId} />
                            <input type="hidden" name="personId" value={thread.target!.personId} />
                            <input type="hidden" name="projectId" value={thread.target!.projectId} />
                            <input type="hidden" name="jobId" value={thread.target!.jobId ?? ""} />
                            <input type="hidden" name="reviewKey" value={thread.target!.reviewKey} />
                            <input type="hidden" name="decision" value={decision} />
                            <button type="submit" className="rounded-full border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#efe8de]">
                              {decision}
                            </button>
                          </form>
                        ))}
                      </>
                    ) : (
                      <>
                        <button type="button" disabled className="rounded-full border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">Confirm</button>
                        <button type="button" disabled className="rounded-full border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#81766c]">Reject</button>
                      </>
                    )}
                    <button type="button" className="rounded-full border border-[#ad9164]/35 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#ad9164]">Leave unresolved</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
