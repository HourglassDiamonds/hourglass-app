"use client";

import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";

export default function ContinuumError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      data-continuum-error-shell
      className="min-h-[70vh] px-6 py-16 text-[#efe8de]"
    >
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Continuum
      </p>
      <h1 className="mt-6 font-serif text-[2rem] leading-[1.1] tracking-[-0.04em]">
        This screen could not be loaded.
      </h1>
      <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        The private workspace hit a bounded failure. Retry, or return to Today.
      </p>
      <div className="mt-10 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:text-[#ad9164]"
        >
          Retry
        </button>
        <Link
          href={CONCIERGE_HOME_PATH}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#ad9164] outline-none hover:text-[#efe8de]"
        >
          Today
        </Link>
      </div>
    </div>
  );
}
