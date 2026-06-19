"use client";

import Link from "next/link";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { CONSUMER_COPY, V3_FANCY_COLOR_GUIDANCE } from "./consumer-display-labels";
import { DI_V3_PARTIAL_CARD, DI_V3_TEXT_CTA } from "./di-v3-styles";

export default function DiV3FancyColorGuidance({
  reportContext,
}: {
  reportContext?: DiamondIntelligenceConciergeContext;
}) {
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );

  return (
    <section className={`${DI_V3_PARTIAL_CARD} mx-auto max-w-[860px]`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9b8b78]">
        {V3_FANCY_COLOR_GUIDANCE.eyebrow}
      </p>
      <h2 className="mt-4 font-serif text-[clamp(28px,4.5vw,40px)] font-normal leading-[1.05] text-[#1e1a16]">
        {V3_FANCY_COLOR_GUIDANCE.headline}
      </h2>
      <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-[1.72] text-[#6f665b]">
        {V3_FANCY_COLOR_GUIDANCE.body}
      </p>
      <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.72] text-[#75675e]">
        {V3_FANCY_COLOR_GUIDANCE.conciergeNote}
      </p>
      <div className="mx-auto mt-8 max-w-[520px]">
        <Link
          href={conciergeHref}
          className={DI_V3_TEXT_CTA}
          onClick={() =>
            trackConsultationCtaClicked("diamond_intelligence:fancy_color_guidance")
          }
        >
          {CONSUMER_COPY.justinReviewCta} →
        </Link>
      </div>
    </section>
  );
}
