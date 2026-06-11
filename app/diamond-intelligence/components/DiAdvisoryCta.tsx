"use client";

import Link from "next/link";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { DI_BODY, DI_EYEBROW, DI_SECTION } from "./di-editorial-classes";

export default function DiAdvisoryCta() {
  return (
    <section className={`${DI_SECTION} !border-b-0`}>
      <div className="rounded-[28px] bg-[rgba(251,247,239,0.72)] px-8 py-10 ring-1 ring-[rgba(181,150,98,0.18)] md:px-12 md:py-12">
        <p className={DI_EYEBROW}>Concierge</p>
        <h2 className="mt-4 font-serif text-[1.55rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.75rem]">
          {CONSUMER_COPY.justinReviewCta}
        </h2>
        <p className={`${DI_BODY} mt-4 max-w-lg`}>
          {CONSUMER_COPY.justinReviewCtaSupporting}
        </p>
        <Link
          href="/concierge"
          className="mt-8 inline-flex items-center justify-center rounded-full border border-[rgba(58,48,38,0.14)] bg-[#2b2723] px-8 py-3.5 text-[10px] uppercase tracking-[0.28em] text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cbbda9]"
          onClick={() =>
            trackConsultationCtaClicked("diamond_intelligence:advisory_cta")
          }
        >
          {CONSUMER_COPY.justinReviewCta}
        </Link>
      </div>
    </section>
  );
}
