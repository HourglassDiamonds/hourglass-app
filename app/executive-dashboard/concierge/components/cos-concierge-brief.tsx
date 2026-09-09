import Link from "next/link";
import type { CosBriefItem, CosWatchingItem } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import {
  cosWatchingCountLabel,
  founderFacingBriefActionLabel,
} from "@/lib/continuum/chief-of-staff/operating-loop/docket";

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
}: {
  watching: readonly CosWatchingItem[];
}) {
  if (watching.length === 0) return null;
  return (
    <details data-cos-watching className="hg-cos-watching mt-8 min-w-0">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-[11px] uppercase tracking-[0.2em] text-[#5c564f] outline-none hover:text-[#6f675f]">
        {cosWatchingCountLabel(watching.length)}
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
  );
}
