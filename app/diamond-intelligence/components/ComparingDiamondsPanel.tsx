"use client";

import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import { DI_LINK } from "./di-editorial-classes";

export default function ComparingDiamondsPanel({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="rounded-lg border border-[#ebe4da]/30 bg-white/25 px-4 py-4 md:px-5 md:py-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6b5048]">
        Concierge
      </p>
      <p className="mt-0.5 text-[13px] leading-[1.72] text-[#5f5851]">
        We can set this diamond beside comparable options and speak plainly
        about value, performance, and fit.
      </p>
      <ConsultationCtaLink
        location="diamond_intelligence:comparing"
        tool="diamond-intelligence"
        className={`mt-4 inline-block ${DI_LINK} text-[11px] tracking-[0.1em]`}
      >
        Begin the Conversation
      </ConsultationCtaLink>
    </div>
  );
}