import Link from "next/link";
import type { CosBriefItem, CosWatchingItem } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import {
  COS_BRIEF_TITLE,
  COS_WATCHING_TITLE,
} from "@/lib/continuum/chief-of-staff/operating-loop/present";

function BriefActions({ item }: { item: CosBriefItem }) {
  return (
    <p className="mt-2 flex min-w-0 flex-wrap gap-x-5">
      {item.actions.map((action) =>
        action.href ? (
          <Link
            key={action.kind}
            href={action.href}
            target={action.kind === "open_email" ? "_blank" : undefined}
            rel={action.kind === "open_email" ? "noreferrer" : undefined}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            {action.label}
          </Link>
        ) : null,
      )}
    </p>
  );
}

function EvidenceDrawer({ item }: { item: CosBriefItem }) {
  if (item.evidence.length === 0) return null;
  return (
    <details className="hg-cos-evidence mt-2 min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]">
        Review evidence
      </summary>
      <div className="mt-2 min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Supporting evidence
        </p>
        <ol className="mt-2 space-y-2">
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
        <p className="mt-3 break-words text-[12px] uppercase tracking-[0.14em] text-[#8d8073]">
          Project · {item.projectStateLabel ?? "None"}
        </p>
        <p className="mt-1 break-words text-[12px] uppercase tracking-[0.14em] text-[#8d8073]">
          Open Job · {item.openJobLabel ?? "None"}
        </p>
      </div>
    </details>
  );
}

export function CosConciergeBrief({
  items,
  watching,
}: {
  items: readonly CosBriefItem[];
  watching: readonly CosWatchingItem[];
}) {
  if (items.length === 0 && watching.length === 0) return null;
  return (
    <div data-cos-brief className="hg-cos-brief mt-10 min-w-0 overflow-x-hidden">
      {items.length > 0 ? (
        <>
          <h3 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {COS_BRIEF_TITLE}
          </h3>
          <ol className="mt-4 space-y-5">
            {items.map((item) => (
              <li
                key={item.id}
                data-cos-brief-item={item.rank}
                data-cos-brief-class={item.rankClass}
                className="hg-cos-brief-item min-w-0 overflow-x-hidden"
              >
                <p className="break-words text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {item.rank}. {item.personLabel && item.projectTitle && item.personLabel !== item.projectTitle
                    ? `${item.personLabel} — ${item.headline}`
                    : `${item.personLabel ?? item.projectTitle ?? "Unassigned"} — ${item.headline}`}
                </p>
                <p className="hg-cos-brief-explanation mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
                  {item.explanation}
                </p>
                <p className="mt-2 break-words text-[14px] leading-relaxed text-[#efe8de]">
                  Recommended: {item.recommended}
                </p>
                {item.urgencyLabel || item.stateLabel ? (
                  <p className="mt-1 break-words text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
                    {[item.stateLabel, item.urgencyLabel].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <div className="hg-cos-brief-details">
                  <BriefActions item={item} />
                  <EvidenceDrawer item={item} />
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {watching.length > 0 ? (
        <details data-cos-watching className="hg-cos-watching mt-6 min-w-0">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-[11px] uppercase tracking-[0.22em] text-[#6f675f] outline-none hover:text-[#8d8073]">
            {COS_WATCHING_TITLE}
          </summary>
          <ul className="mt-2 space-y-2">
            {watching.map((item) => (
              <li key={item.id} className="min-w-0">
                <p className="break-words text-[13px] leading-relaxed text-[#9a8e82]">
                  {item.title}
                </p>
                <p className="break-words text-[13px] leading-relaxed text-[#7d746a]">
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
