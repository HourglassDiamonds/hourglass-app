import { getAuthenticatedConditionalHoldRepository } from "@/lib/continuum/sterling/holds/load";
import type { ConditionalHoldRecord } from "@/lib/continuum/sterling/holds/types";
import { ConditionalHoldControls } from "./conditional-hold-controls";

export function ConditionalHoldPanelFallback() {
  return (
    <section
      aria-label="Loading held items"
      aria-busy="true"
      className="mx-auto mb-5 w-full max-w-3xl border-t border-white/[0.08] py-4"
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#6f675f]">
        Checking held items…
      </p>
    </section>
  );
}

export async function ConditionalHoldPanel() {
  const loaded = await getAuthenticatedConditionalHoldRepository();
  if (!loaded.ok) return null;
  const holds = await loaded.repository.listActive().catch(() => []);
  if (holds.length === 0) return null;
  return (
    <section className="mx-auto mb-5 w-full max-w-3xl border-y border-white/[0.08] py-4" aria-label="Held items">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">Held · {holds.length}</p>
      <div className="mt-2 divide-y divide-white/[0.06]">{holds.map((hold) => <HoldRow key={hold.holdId} hold={hold} />)}</div>
    </section>
  );
}

function HoldRow({ hold }: { hold: ConditionalHoldRecord }) {
  const met = hold.status === "condition_met";
  return (
    <article className="py-3 first:pt-1 last:pb-0">
      <p className="text-[13px] text-[#efe8de]">{met ? "Condition met" : "Held"}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-[#a99b8d]">{conditionLabel(hold)}</p>
      {met && hold.resumeEvidence ? <p className="mt-1 text-[11px] leading-relaxed text-[#8d8073]">{hold.resumeEvidence.summary}</p> : null}
      <ConditionalHoldControls hold={hold} conditionMet={met} />
    </article>
  );
}

function conditionLabel(hold: ConditionalHoldRecord) {
  const condition = hold.condition;
  if (condition.kind === "until_time") return `Until ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: condition.timezone }).format(new Date(condition.resumeAt))}`;
  if (condition.kind === "until_founder_contact") return `Until you contact ${condition.scope.personLabel ?? "the scoped contact"}`;
  if (condition.kind === "until_external_reply") return `Waiting for ${condition.scope.personLabel ?? "the external party"} to reply`;
  if (condition.kind === "until_source_event") return `Waiting for ${condition.scope.cadId ? `${condition.scope.cadId} ` : ""}CAD or source delivery`;
  return `Waiting for ${condition.event}`;
}
