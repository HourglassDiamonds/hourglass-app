"use client";

import Link from "next/link";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { CONSUMER_COPY } from "./consumer-display-labels";
import { DI_V3_SECTIONS } from "./di-v3-styles";

export default function DiAdvisoryCta({
  conciergeHref = "/concierge",
}: {
  conciergeHref?: string;
}) {
  return (
    <section className={`${DI_V3_SECTIONS} !mt-6 !gap-0`} aria-label="Concierge review">
      <div className="overflow-hidden rounded-[22px] border border-[rgba(181,150,98,0.28)] bg-[radial-gradient(circle_at_top_left,rgba(181,150,98,0.10),transparent_24rem),rgba(251,247,239,0.82)] px-7 py-10 md:px-10 md:py-12">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#9b8b78]">
          Concierge
        </p>
        <h2 className="mt-4 font-serif text-[clamp(26px,3.5vw,34px)] font-normal leading-[1.12] text-[#1e1a16]">
          {CONSUMER_COPY.justinReviewCtaHeadline}
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-[1.78] text-[#6f665b]">
          {CONSUMER_COPY.justinReviewCtaLead}
        </p>
        <Link
          href={conciergeHref}
          className="mt-5 inline-flex items-center justify-center rounded-full border border-[rgba(58,48,38,0.14)] bg-[#2b2723] px-8 py-3.5 text-[10px] uppercase tracking-[0.28em] text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hg-focus"
          onClick={() =>
            trackConsultationCtaClicked("diamond_intelligence:advisory_cta")
          }
        >
          {CONSUMER_COPY.justinReviewCta}
        </Link>
      </div>

      <div className="mt-6 rounded-[18px] border border-[rgba(181,150,98,0.16)] bg-[rgba(255,255,255,0.42)] px-7 py-8 md:px-9 md:py-9">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#9b8b78]">
          {CONSUMER_COPY.beyondTheReportTitle}
        </p>
        <p className="mt-4 max-w-2xl font-serif text-[clamp(20px,2.6vw,24px)] leading-[1.35] text-[#1e1a16]">
          {CONSUMER_COPY.beyondTheReportIntro}
        </p>
        <p className="mt-4 max-w-2xl text-[15px] leading-[1.78] text-[#6f665b]">
          {CONSUMER_COPY.beyondTheReportBody}
        </p>
      </div>
    </section>
  );
}
