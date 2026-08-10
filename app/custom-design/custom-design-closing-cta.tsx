"use client";

import Button from "../shared-components/Button";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import {
  buildConciergeHref,
  trackConsultationCtaClicked,
} from "@/lib/consultation-cta";

export default function CustomDesignClosingCta() {
  return (
    <section className="border-t border-[#e4dbcf] bg-[#ebe4da]/25 py-[56px] md:py-[72px] lg:py-[88px]">
      <div className="grid grid-cols-12 gap-x-6 gap-y-8 lg:gap-x-8 md:items-end">
        <div className="col-span-12 md:col-span-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
            A Personal Beginning
          </div>
          <h2
            className="mt-4 max-w-[18ch] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.15rem]"
            style={{ textWrap: "balance" }}
          >
            When the piece matters, the process should too.
          </h2>
        </div>

        <div className="col-span-12 md:col-span-4 md:col-start-9">
          <p className="max-w-[24rem] text-[0.98rem] leading-[1.85] text-[#5f5851] md:text-[1rem]">
            Share what you are considering. We will help you shape the next
            step.
          </p>
          <div className="mt-6 md:mt-7">
            <CTAGlimmer>
              <Button
                href={buildConciergeHref({
                  params: { location: "custom_design:footer" },
                })}
                onClick={() =>
                  trackConsultationCtaClicked("custom_design:footer")
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
