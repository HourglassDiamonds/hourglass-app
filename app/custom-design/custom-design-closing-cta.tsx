"use client";

import Link from "next/link";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

export default function CustomDesignClosingCta() {
  return (
    <section className="border-t border-[#e4dbcf] bg-[#ebe4da]/25 py-[56px] md:py-[72px] lg:py-[88px]">
      <div className="grid grid-cols-12 gap-x-6 gap-y-8 lg:gap-x-8 md:items-end">
        <div className="col-span-12 md:col-span-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
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
              <Link
                href="/concierge"
                className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#efe8de]"
                onClick={() =>
                  trackConsultationCtaClicked("custom_design:footer")
                }
              >
                Begin the Conversation
              </Link>
            </CTAGlimmer>
          </div>
        </div>
      </div>
    </section>
  );
}
