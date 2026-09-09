import Link from "next/link";
import type { CosOperatingLoopView } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import {
  COS_ANOMALY_TITLE,
  COS_DECISION_TITLE,
  COS_TOP5_TITLE,
  COS_WORTH_KNOWING_TITLE,
} from "@/lib/continuum/chief-of-staff/operating-loop/present";
import { CosCompleteControl } from "./cos-complete-control";
import { CosFounderAttentionRow } from "./cos-founder-attention";

type CompleteAction = (formData: FormData) => void | Promise<void>;

export function ChiefOfStaffToday({
  loop,
  completeAction,
  reviewAction,
}: {
  loop: CosOperatingLoopView;
  completeAction?: CompleteAction;
  reviewAction?: CompleteAction;
}) {
  return (
    <section data-cos-operating-loop={loop.status} className="min-w-0 overflow-x-hidden">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Chief of Staff
      </h2>
      <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
        {loop.status === "active" ? COS_TOP5_TITLE : "Today"}
      </p>
      {loop.status !== "active" ? (
        <>
          <p className="mt-5 max-w-[22ch] font-serif text-[1.7rem] font-normal leading-[1.12] tracking-[-0.035em] text-[#efe8de] md:text-[1.9rem]">
            {loop.heading}
          </p>
          {loop.quietDetail ? (
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#9a8e82]">
              {loop.quietDetail}
            </p>
          ) : null}
        </>
      ) : (
        <ol className="hg-cos-top5 mt-5">
          {loop.top5.map((item) => (
            <li key={item.id} className="hg-cos-item">
              <CosCompleteControl item={item} action={completeAction} />
              <div className="min-w-0 overflow-x-hidden">
                <p className="break-words font-serif text-[1.25rem] leading-[1.18] tracking-[-0.03em] text-[#efe8de]">
                  {item.action}
                </p>
                <p className="mt-1 break-words text-[13px] leading-relaxed text-[#c4b7aa]">
                  {item.clientLabel
                    ? `${item.clientLabel} · ${item.projectTitle}`
                    : item.projectTitle}
                </p>
                <p className="mt-1 break-words text-[11px] uppercase tracking-[0.14em] text-[#8d8073]">
                  {item.ownership}
                  {" · "}
                  {item.timing}
                </p>
                <p className="mt-2 break-words text-[14px] leading-relaxed text-[#9a8e82]">
                  {item.why}
                </p>
                <p className="mt-2 flex min-w-0 flex-wrap gap-x-5">
                  <Link
                    href={item.accordionHref}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                  >
                    Open project
                  </Link>
                  <Link
                    href={item.editHref}
                    className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                  >
                    Edit
                  </Link>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {loop.needsYourDecision.length > 0 ? (
        <div data-cos-needs-decision className="hg-cos-attention mt-10 min-w-0 overflow-x-hidden">
          <h3 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {COS_DECISION_TITLE}
          </h3>
          <ul className="mt-4 space-y-5">
            {loop.needsYourDecision.map((item) => (
              <CosFounderAttentionRow
                key={item.id}
                item={item}
                completeAction={completeAction}
                reviewAction={reviewAction}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {loop.worthKnowing.length > 0 ? (
        <div data-cos-worth-knowing className="hg-cos-attention mt-10 min-w-0 overflow-x-hidden">
          <h3 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {COS_WORTH_KNOWING_TITLE}
          </h3>
          <ul className="mt-4 space-y-5">
            {loop.worthKnowing.map((item) => (
              <CosFounderAttentionRow
                key={item.id}
                item={item}
                completeAction={completeAction}
                reviewAction={reviewAction}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {loop.anomalies.length > 0 ? (
        <div data-cos-anomalies className="hg-cos-anomaly mt-10">
          <h3 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            {COS_ANOMALY_TITLE}
          </h3>
          <ul className="mt-4 space-y-4">
            {loop.anomalies.map((item) => (
              <li key={item.id} className="min-w-0">
                <p className="break-words text-[15px] leading-relaxed text-[#efe8de]">
                  {item.headline}
                </p>
                <p className="mt-1 break-words text-[14px] leading-relaxed text-[#9a8e82]">
                  {item.detail}
                </p>
                {item.sourceHref ? (
                  <Link
                    href={item.sourceHref}
                    className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
                  >
                    {item.sourceLabel ?? "Source"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
