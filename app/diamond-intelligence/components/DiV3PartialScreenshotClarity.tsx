"use client";

import Link from "next/link";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { CONSUMER_COPY, V3_PARTIAL_SCREENSHOT_CLARITY } from "./consumer-display-labels";
import { DI_V3_TEXT_CTA } from "./di-v3-styles";

export default function DiV3PartialScreenshotClarity({
  reportContext,
  trackingSource = "diamond_intelligence:partial_grade_review",
}: {
  reportContext?: DiamondIntelligenceConciergeContext;
  trackingSource?: string;
}) {
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );

  return (
    <div className="mx-auto mt-8 max-w-[520px] rounded-[18px] border border-[rgba(181,150,98,0.22)] bg-[rgba(255,255,255,0.28)] px-5 py-6 text-left">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#9b8b78]">
        {V3_PARTIAL_SCREENSHOT_CLARITY.eyebrow}
      </p>
      <p className="mt-4 text-[15px] leading-[1.72] text-[#6f665b]">
        {V3_PARTIAL_SCREENSHOT_CLARITY.body}
      </p>
      <p className="mt-4 text-[15px] leading-[1.72] text-[#6f665b]">
        {V3_PARTIAL_SCREENSHOT_CLARITY.followUp}
      </p>
      <p className="mt-4 text-[14px] leading-[1.68] text-[#75675e]">
        {V3_PARTIAL_SCREENSHOT_CLARITY.conciergeNote}
      </p>
      <div className="mt-5">
        <Link
          href={conciergeHref}
          className={DI_V3_TEXT_CTA}
          onClick={() => trackConsultationCtaClicked(trackingSource)}
        >
          {CONSUMER_COPY.justinReviewCta} →
        </Link>
      </div>
    </div>
  );
}
