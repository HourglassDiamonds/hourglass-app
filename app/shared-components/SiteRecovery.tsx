"use client";

import Link from "next/link";
import Header from "./Header";

type SiteRecoveryProps = {
  eyebrow: string;
  title: string;
  body: string;
  onRetry?: () => void;
};

export default function SiteRecovery({
  eyebrow,
  title,
  body,
  onRetry,
}: SiteRecoveryProps) {
  return (
    <div className="min-h-[70vh] bg-hg-ivory text-hg-ink">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
      </div>
      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        <p className="mb-10 text-[11px] uppercase tracking-[0.28em] text-hg-eyebrow">
          {eyebrow}
        </p>
        <h1 className="mb-6 font-serif text-[32px] leading-[1.2] text-hg-ink md:text-[38px]">
          {title}
        </h1>
        <p className="max-w-[38rem] text-[15px] leading-[1.7] text-[#4e463f]">
          {body}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center text-[13px] tracking-[0.04em] text-hg-ink underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:decoration-hg-ink"
            >
              Try again
            </button>
          ) : null}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[13px] tracking-[0.04em] text-hg-ink underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:decoration-hg-ink"
          >
            Return home
          </Link>
          <Link
            href="/concierge"
            className="inline-flex min-h-11 items-center text-[13px] tracking-[0.04em] text-hg-ink underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:decoration-hg-ink"
          >
            Concierge
          </Link>
        </div>
      </section>
    </div>
  );
}
