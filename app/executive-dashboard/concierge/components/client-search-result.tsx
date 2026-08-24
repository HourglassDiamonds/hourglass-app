import Link from "next/link";
import {
  conciergeClientPath,
  projectCountLabel,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";

export function ClientSearchResultRow({
  result,
  href,
}: {
  result: ClientSearchResult;
  href?: string;
}) {
  const secondary =
    result.organizationName?.trim() ||
    result.email?.trim() ||
    result.phone?.trim() ||
    null;
  const projects = projectCountLabel(result.linkedProjectCount);

  return (
    <Link
      href={href ?? conciergeClientPath(result.personId)}
      className="block min-h-14 rounded-[18px] px-1 py-4 outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:shadow-[0_0_0_2px_#987648]"
    >
      <p className="font-serif text-[1.28rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de]">
        {result.displayName}
      </p>
      {secondary ? (
        <p className="mt-1 break-words text-[13.5px] leading-relaxed text-[#b7aa9c]">
          {secondary}
        </p>
      ) : null}
      {projects ? (
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
          {projects}
        </p>
      ) : null}
    </Link>
  );
}
