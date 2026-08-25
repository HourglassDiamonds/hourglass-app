import Link from "next/link";
import {
  conciergeInboxSourcePath,
  formatNoteDate,
} from "@/lib/continuum/client-memory/read/presentation";
import type { InboxSourceView } from "@/lib/continuum/client-memory/human-intake";
import {
  humanCommunicationLabel,
  humanReviewStatusLabel,
  humanSourceTypeLabel,
} from "@/lib/continuum/client-memory/human-intake/labels";

export function InboxSourceList({ items }: { items: InboxSourceView[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
        No sources yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((item) => {
        const names = [...item.personNames, ...item.projectTitles];
        return (
          <li key={item.id}>
            <Link
              href={conciergeInboxSourcePath(item.id)}
              className="block py-5 outline-none hover:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
            >
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
                {humanSourceTypeLabel(item.sourceType)}
                {" · "}
                {humanCommunicationLabel(item.communicationType)}
                {" · "}
                {humanReviewStatusLabel(item.reviewStatus)}
              </p>
              <p className="mt-2 text-[13px] tracking-[0.04em] text-[#b7aa9c]">
                {formatNoteDate(item.capturedAt ?? item.ingestedAt)}
              </p>
              {names.length > 0 ? (
                <p className="mt-2 text-[15px] text-[#d8cfc4]">{names.join(" · ")}</p>
              ) : (
                <p className="mt-2 text-[15px] text-[#9a8e82]">Unassigned</p>
              )}
              {item.preview ? (
                <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
                  {item.preview}
                </p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
