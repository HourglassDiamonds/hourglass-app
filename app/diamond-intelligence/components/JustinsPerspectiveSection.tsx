"use client";

import Link from "next/link";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { DI_EDITORIAL_CARD, DI_EYEBROW_STUDIO } from "./di-studio-styles";

export default function JustinsPerspectiveSection({
  visible,
  reportContext,
}: {
  visible: boolean;
  reportContext?: DiamondIntelligenceConciergeContext;
}) {
  if (!visible) return null;

  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );

  return (
    <section className={`${DI_EDITORIAL_CARD} p-8 md:p-12`}>
      <p className={DI_EYEBROW_STUDIO}>Justin&apos;s Perspective</p>

      <div className="mt-6 max-w-3xl space-y-5 text-[16px] leading-8 text-[#51463e]">
        <p>
          After evaluating thousands of diamonds as a Graduate Gemologist, I
          rarely spend much time interpreting the grading report itself.
        </p>
        <p>
          The more valuable work is identifying what the report does not reveal.
        </p>
        <p>
          Two diamonds can appear similar on paper and perform very differently
          once video, optical imaging, transparency, and eye-clean appearance
          are considered.
        </p>
        <p>
          If this diamond is being seriously considered, I&apos;d be happy to
          review it personally.
        </p>
      </div>

      <div className="mt-8 border-t border-[#e6dacb] pt-6">
        <p className="font-serif text-xl text-[#211a16]">Justin Smith, GG</p>
        <Link
          href={conciergeHref}
          className="mt-2 inline-block text-sm underline underline-offset-4 text-[#6f5946] transition-colors hover:text-[#211a16]"
          onClick={() =>
            trackConsultationCtaClicked(
              "diamond_intelligence:justins_perspective",
            )
          }
        >
          Request Justin&apos;s review
        </Link>
      </div>
    </section>
  );
}
