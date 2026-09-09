import Link from "next/link";
import type { CosProposedAction } from "@/lib/continuum/chief-of-staff/operating-loop/types";

type ReviewAction = (formData: FormData) => void | Promise<void>;

export function CosProposedActionRow({
  item,
  action,
  compact = false,
}: {
  item: CosProposedAction;
  action?: ReviewAction;
  compact?: boolean;
}) {
  return (
    <li className="min-w-0 overflow-x-hidden">
      {compact ? null : (
        <>
          <p className="break-words text-[15px] leading-relaxed text-[#efe8de]">
            {item.headline}
          </p>
          <p className="mt-1 break-words text-[13px] leading-relaxed text-[#9a8e82]">
            {item.projectTitle ? `${item.sourceLabel} · ${item.projectTitle}` : item.sourceLabel}
          </p>
        </>
      )}
      <div className="mt-2 flex min-w-0 flex-wrap gap-x-5">
        {item.canAddToActions && item.sourceId && item.projectId ? (
          <form action={action}>
            <input type="hidden" name="action" value="approve" />
            <input type="hidden" name="candidateId" value={item.candidateId} />
            <input type="hidden" name="sourceId" value={item.sourceId} />
            <input type="hidden" name="mutationId" value={item.mutationId} />
            <input type="hidden" name="projectId" value={item.projectId} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
            >
              Add to actions
            </button>
          </form>
        ) : null}
        <Link
          href={item.sourceHref}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
        >
          Review
        </Link>
        {item.canDismiss && item.sourceId ? (
          <form action={action}>
            <input type="hidden" name="action" value="discard" />
            <input type="hidden" name="candidateId" value={item.candidateId} />
            <input type="hidden" name="sourceId" value={item.sourceId} />
            <input type="hidden" name="mutationId" value={item.mutationId} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#8d8073] outline-none hover:text-[#efe8de]"
            >
              Dismiss
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
