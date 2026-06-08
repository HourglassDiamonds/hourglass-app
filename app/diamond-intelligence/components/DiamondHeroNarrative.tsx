"use client";

import Link from "next/link";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { EditorialLightPerformancePresentation } from "@/lib/diamond-intelligence/client-editorial-language";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import DiamondPurchasePersonalitySection from "./DiamondPurchasePersonalitySection";
import { RecommendationBlock } from "./decision-profile-blocks";

export default function DiamondHeroNarrative({
  verdictLabel,
  personalityDescriptor,
  decisionProfile,
  interpretationSummary,
}: {
  verdictLabel: string;
  personalityDescriptor: string;
  decisionProfile: DiamondDecisionProfile;
  interpretationSummary: string;
}) {
  return (
    <div className="space-y-5 md:space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#a8926a]">
          Our Verdict
        </p>
        <p className="mt-3 font-serif text-[1.75rem] leading-[1.1] tracking-[-0.025em] text-[#1f1d1a] md:text-[2rem]">
          {verdictLabel}
        </p>
        <p className="mt-3 max-w-md text-[13px] leading-[1.72] text-[#5f5851]">
          {personalityDescriptor}
        </p>
      </div>

      <RecommendationBlock profile={decisionProfile} />

      <DiamondPurchasePersonalitySection
        personality={decisionProfile.purchasePersonality}
      />

      <div className="border-t border-[#ebe4da]/50 pt-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
          Optical interpretation
        </p>
        <p className="mt-3 max-w-md font-serif text-[1.15rem] font-normal leading-[1.48] tracking-[-0.015em] text-[#1f1d1a] md:text-[1.22rem] md:leading-[1.52]">
          {interpretationSummary}
        </p>
        <p className="mt-4 max-w-sm text-[12px] leading-[1.68] text-[#948a80]">
          Interpretation only — not a laboratory grade. Justin can review the
          diamond with you before you decide.
        </p>
        <Link
          href="/concierge"
          className="mt-3.5 inline-flex text-[11px] tracking-[0.12em] text-[#6b5048] underline underline-offset-4"
          onClick={() =>
            trackConsultationCtaClicked("diamond_intelligence:hero_verdict")
          }
        >
          Have Justin review this diamond
        </Link>
      </div>
    </div>
  );
}
