import Link from "next/link";
import type { CosBriefItem, CosWatchingItem } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { founderFacingBriefActionLabel } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import { CosAskConcierge, type TodayAskAction } from "./cos-ask-concierge";

function EvidenceControl({ item }: { item: CosBriefItem }) {
  if (item.evidence.length === 0) return null;
  return (
    <details className="hg-cos-evidence inline min-w-0 align-middle">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-[10px] uppercase tracking-[0.16em] text-[#5c564f] outline-none hover:text-[#6f675f] focus-visible:text-[#6f675f]">
        Evidence
      </summary>
      <div className="mt-2 min-w-0">
        <ol className="space-y-2">
          {item.evidence.map((beat) => (
            <li key={beat.candidateId} className="min-w-0">
              <p className="break-words text-[13px] leading-relaxed text-[#c4b7aa]">
                {beat.sourceHref ? (
                  <Link
                    href={beat.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#ad9164] outline-none hover:text-[#efe8de]"
                  >
                    {beat.label}
                  </Link>
                ) : (
                  beat.label
                )}
              </p>
              <p className="break-words text-[13px] leading-relaxed text-[#9a8e82]">
                {beat.summary}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function CosBriefActions({ item }: { item: CosBriefItem }) {
  const actions = item.actions.filter((action) => action.kind !== "add_to_top5");
  if (actions.length === 0 && item.evidence.length === 0) return null;
  return (
    <div className="hg-cos-brief-details mt-2 min-w-0">
      <p className="flex min-w-0 flex-wrap items-center gap-x-5">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={action.kind}
              href={action.href}
              target={action.kind === "open_email" ? "_blank" : undefined}
              rel={action.kind === "open_email" ? "noreferrer" : undefined}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              {founderFacingBriefActionLabel(action.kind, action.label)}
            </Link>
          ) : null,
        )}
        <EvidenceControl item={item} />
      </p>
    </div>
  );
}

export function CosWatchingList({
  watching,
  askAction,
}: {
  watching: readonly CosWatchingItem[];
  askAction?: TodayAskAction;
}) {
  if (watching.length === 0) return null;
  return (
    <section data-cos-watching className="hg-cos-watching mt-10 min-w-0">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Watching
      </h2>
      <ul className="hg-cos-docket mt-5">
        {watching.map((item) => {
          const briefing = item.briefing;
          const name = briefing
            ? [briefing.displayName, briefing.projectName]
                .filter((row, index, all) => row && all.indexOf(row) === index)
                .join(" / ")
            : item.title;
          return (
            <li
              key={item.id}
              className="hg-cos-item hg-cos-docket-item min-w-0 overflow-x-hidden"
              data-cos-watching-item={item.id}
              data-cos-ball={item.briefingPacket?.ballHolder}
            >
              <div className="min-w-0 overflow-x-hidden">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 break-words font-serif text-[1.05rem] leading-snug tracking-[-0.02em] text-[#efe8de]">
                    {name}
                  </p>
                  <p className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">
                    {briefing?.stateChip ?? "WAITING"}
                  </p>
                </div>
                {briefing ? (
                  <>
                    <p className="mt-2 break-words font-serif text-[1.28rem] leading-[1.2] tracking-[-0.03em] text-[#efe8de]">
                      {briefing.headline}
                    </p>
                    <p className="mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
                      {briefing.stand}
                    </p>
                    <div className="mt-3 min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">
                        {briefing.nextLabel}
                      </p>
                      <p className="mt-1 break-words text-[14px] leading-relaxed text-[#d8cfc4]">
                        {briefing.nextBody}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
                    {item.detail}
                  </p>
                )}
                {item.briefingPacket ? (
                  <CosAskConcierge packet={item.briefingPacket} askAction={askAction} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
