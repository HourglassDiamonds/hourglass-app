import Link from "next/link";
import type { CosFounderAttentionItem } from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { CosRecapConfirm } from "./cos-complete-control";
import { CosProposedActionRow } from "./cos-proposed-actions";

type FormAction = (formData: FormData) => void | Promise<void>;

export function CosFounderAttentionRow({
  item,
  completeAction,
  reviewAction,
}: {
  item: CosFounderAttentionItem;
  completeAction?: FormAction;
  reviewAction?: FormAction;
}) {
  return (
    <li className="hg-cos-item" data-cos-attention-lane={item.lane}>
      {item.recap ? <CosRecapConfirm item={item.recap} action={completeAction} /> : null}
      <div className="min-w-0 overflow-x-hidden">
        <p className="break-words text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          {item.title}
        </p>
        <p className="mt-1 break-words font-serif text-[1.15rem] leading-[1.18] tracking-[-0.03em] text-[#efe8de]">
          {item.headline}
        </p>
        {item.detail ? (
          <p className="mt-1 break-words text-[14px] leading-relaxed text-[#9a8e82]">
            {item.detail}
          </p>
        ) : null}
        {item.proposedAction ? (
          <ul className="mt-2">
            <CosProposedActionRow item={item.proposedAction} action={reviewAction} compact />
          </ul>
        ) : item.sourceHref ? (
          <Link
            href={item.sourceHref}
            className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
          >
            {item.sourceLabel ?? "Review"}
          </Link>
        ) : null}
        {item.recap && !item.recap.completable ? (
          <p className="mt-1 text-[13px] leading-relaxed text-[#8d8073]">
            Confirmation only — I will not mark this complete.
          </p>
        ) : null}
      </div>
    </li>
  );
}
