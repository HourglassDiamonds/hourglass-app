"use client";

import Button from "../shared-components/Button";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import {
  buildConciergeHref,
  trackConsultationCtaClicked,
} from "@/lib/consultation-cta";

export default function EngagementRingsClosingCta() {
  return (
    <section className="border-t border-[#e4dbcf]/75 bg-[#ebe4da]/25 py-[52px] md:py-[64px] lg:py-[76px]">
      <div className="grid grid-cols-12 gap-x-6 gap-y-7 lg:gap-x-8 md:items-end">
        <div className="col-span-12 md:col-span-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
            A Private Conversation
          </div>
          <h2
            className="mt-4 max-w-[18ch] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.1rem]"
            style={{ textWrap: "balance" }}
          >
            When you are ready, we will begin with what matters most.
          </h2>
        </div>

        <div className="col-span-12 md:col-span-5 md:col-start-8">
          <p className="max-w-[24rem] text-[0.98rem] leading-[1.85] text-[#5f5851] md:text-[1rem]">
            No pressure. No expectation that you already have everything figured
            out.
          </p>
          <div className="mt-6 md:mt-6">
            <CTAGlimmer>
              <Button
                href={buildConciergeHref({
                  params: { location: "engagement_rings:footer" },
                })}
                onClick={() =>
                  trackConsultationCtaClicked("engagement_rings:footer")
                }
              >
                Begin the Conversation
              </Button>
            </CTAGlimmer>
          </div>
        </div>
      </div>
    </section>
  );
}
