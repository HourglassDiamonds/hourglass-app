"use client";

import Button from "@/app/shared-components/Button";
import CTAGlimmer from "@/app/shared-components/motion/CTAGlimmer";
import {
  buildConciergeHref,
  trackConsultationCtaClicked,
} from "@/lib/consultation-cta";

/** Preserve the existing Size Studio CTA location ID for Concierge attribution. */
export const DIAMOND_STUDIO_HANDOFF_LOCATION = "diamond_studio:result" as const;
export const DIAMOND_STUDIO_HANDOFF_TOOL = "diamond-studio" as const;

export function diamondStudioHandoffHref(): string {
  return buildConciergeHref({
    tool: DIAMOND_STUDIO_HANDOFF_TOOL,
    params: { location: DIAMOND_STUDIO_HANDOFF_LOCATION },
  });
}

export default function DiamondStudioHandoff() {
  return (
    <section
      className="dts-handoff border-t border-[#e4dbcf]/50 px-6 py-10 md:px-10 md:py-12"
      aria-labelledby="dts-handoff-heading"
      data-dts-handoff=""
    >
      <div className="mx-auto w-full max-w-[40rem] text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
          After you’ve compared
        </p>
        <h2
          id="dts-handoff-heading"
          className="mt-4 font-serif text-[1.45rem] font-normal leading-[1.25] tracking-[-0.02em] text-[var(--ink)] md:text-[1.65rem]"
        >
          Need help translating this to your ring?
        </h2>
        <p className="mx-auto mt-4 max-w-[34rem] text-[0.95rem] leading-[1.75] text-[var(--ink-soft)] md:text-[0.98rem] md:leading-[1.8]">
          Justin can help you compare apparent size, proportions, setting
          style, and how the diamond will sit on the hand, including natural
          and lab-grown options where relevant.
        </p>
        <div className="mt-6 md:mt-7">
          <CTAGlimmer>
            <Button
              href={diamondStudioHandoffHref()}
              onClick={() =>
                trackConsultationCtaClicked(DIAMOND_STUDIO_HANDOFF_LOCATION)
              }
            >
              Begin the Conversation
            </Button>
          </CTAGlimmer>
        </div>
      </div>
    </section>
  );
}
