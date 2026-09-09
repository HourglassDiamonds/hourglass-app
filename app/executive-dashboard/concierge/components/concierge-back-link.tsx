"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { destinationBackForPath } from "@/lib/continuum/operating-shell/destinations";

export function ConciergeBackLink({
  href,
  label,
}: {
  href?: string;
  label?: string;
}) {
  const pathname = usePathname() ?? "";
  const inferred = destinationBackForPath(pathname);
  const target = href ?? inferred.href;
  const text = label ?? inferred.label;
  return (
    <Link
      href={target}
      aria-label={`Back to ${text}`}
      className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
    >
      ← {text}
    </Link>
  );
}
