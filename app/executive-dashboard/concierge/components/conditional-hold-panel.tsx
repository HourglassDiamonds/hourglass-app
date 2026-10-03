import Link from "next/link";
import { getAuthenticatedConditionalHoldRepository } from "@/lib/continuum/sterling/holds/load";
import type { ConditionalHoldRecord } from "@/lib/continuum/sterling/holds/types";
import { manageConditionalHoldAction } from "../conditional-hold-actions";

export async function ConditionalHoldPanel() {
  const loaded = await getAuthenticatedConditionalHoldRepository();
  if (!loaded.ok) return null;
  const holds = await loaded.repository.listActive().catch(() => []);
  if (holds.length === 0) return null;
  return (
    <section className="mx-auto mb-5 w-full max-w-3xl rounded-[18px] border border-white/[0.08] bg-[#171411]/75 p-4" aria-label="Conditional holds">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">Held · {holds.length}</p>
      <div className="mt-3 space-y-3">{holds.map((hold) => <HoldRow key={hold.holdId} hold={hold} />)}</div>
    </section>
  );
}

function HoldRow({ hold }: { hold: ConditionalHoldRecord }) {
  const met = hold.status === "condition_met";
  return (
    <article className="rounded-[14px] border border-white/[0.06] bg-black/10 p-3">
      <p className="text-[13px] text-[#efe8de]">{met ? "Condition met · Resume this?" : "Held"}</p>
      <p className="mt-1 text-[12px] text-[#a99b8d]">{conditionLabel(hold)}</p>
      {met && hold.resumeEvidence ? <p className="mt-1 text-[11px] text-[#8d8073]">Evidence: {hold.resumeEvidence.summary}</p> : null}
      <form action={manageConditionalHoldAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="holdId" value={hold.holdId} />
        <button name="holdAction" value="resume" className="min-h-9 rounded-full bg-[#ad9164] px-3 text-[11px] text-[#17120e]">{met ? "Resume" : "Resume now"}</button>
        {met ? <button name="holdAction" value="keep" className="min-h-9 rounded-full px-3 text-[11px] text-[#c4b7aa]">Keep holding</button> : null}
        <Link href={`/executive-dashboard/concierge/ask?q=${encodeURIComponent(`Edit the hold on job ${hold.entityId}`)}`} className="px-2 text-[11px] text-[#a99b8d]">Edit condition</Link>
        <button name="holdAction" value="cancel" className="min-h-9 rounded-full px-3 text-[11px] text-[#8d8073]">Cancel hold</button>
      </form>
    </article>
  );
}

function conditionLabel(hold: ConditionalHoldRecord) {
  const condition = hold.condition;
  if (condition.kind === "until_time") return `Until: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: condition.timezone }).format(new Date(condition.resumeAt))}`;
  if (condition.kind === "until_founder_contact") return `Until you contact ${condition.scope.personLabel ?? "the scoped contact"}`;
  if (condition.kind === "until_external_reply") return `Waiting for: ${condition.scope.personLabel ?? "scoped external party"} reply`;
  if (condition.kind === "until_source_event") return `Waiting for: ${condition.scope.cadId ? `${condition.scope.cadId} ` : ""}CAD/source delivery`;
  return `Waiting for: ${condition.event}`;
}
