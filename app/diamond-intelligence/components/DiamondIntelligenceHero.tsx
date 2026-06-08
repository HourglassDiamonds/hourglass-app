"use client";

import Link from "next/link";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import DiEditorialImage from "./DiEditorialImage";
import { DI_IMAGERY } from "./di-editorial-imagery";
import { CONSUMER_COPY } from "./consumer-display-labels";

export default function DiamondIntelligenceHero({
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
  const personality = decisionProfile.purchasePersonality;
  const showHeroImage = DI_IMAGERY.enableHeroImagery;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e4dbcf]/45 bg-[#faf8f5]/90 shadow-[0_6px_28px_rgba(48,36,28,0.04)]">
      <div
        className={
          showHeroImage
            ? "grid lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]"
            : undefined
        }
      >
        {showHeroImage ? (
          <DiEditorialImage
            slot="hero"
            variant="hero"
            className="min-h-[260px] rounded-none border-0 ring-0 sm:min-h-[300px] lg:min-h-[480px]"
          />
        ) : null}

        <div className="flex flex-col justify-center px-6 py-7 md:px-9 md:py-9 lg:px-10 lg:py-11">
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#a8926a]">
            Our Verdict
          </p>
          <h2
            className="mt-3.5 font-serif text-[2rem] font-normal leading-[1.08] tracking-[-0.025em] text-[#1f1d1a] md:text-[2.35rem]"
            style={{ textWrap: "balance" }}
          >
            {verdictLabel}
          </h2>
          <p
            className={`mt-4 text-[0.98rem] leading-[1.78] text-[#5f5851] ${showHeroImage ? "max-w-md" : "max-w-2xl"}`}
            style={{ textWrap: "balance" }}
          >
            {personalityDescriptor}
          </p>

          <div className="mt-8 grid gap-8 border-t border-[#ebe4da]/55 pt-8 sm:grid-cols-2 sm:gap-6 md:mt-9">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                {CONSUMER_COPY.recommendationLabel}
              </p>
              <p
                className="mt-3 font-serif text-[1.28rem] leading-[1.18] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.35rem]"
                style={{ textWrap: "balance" }}
              >
                {decisionProfile.overallRecommendation.band}
              </p>
              <p className="mt-2 text-[11px] leading-[1.55] text-[#948a80]">
                {CONSUMER_COPY.recommendationQualifier}
              </p>
              <p className="mt-2 text-[11px] font-medium tracking-[0.04em] text-[#6b5048]">
                Primary limitation: {decisionProfile.primaryLimitingFactor.display}
              </p>
              <p className="mt-3 text-[13px] leading-[1.72] text-[#5f5851]">
                {decisionProfile.overallRecommendation.explanation}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                What This Diamond Is
              </p>
              <p
                className="mt-3 font-serif text-[1.22rem] leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.28rem]"
                style={{ textWrap: "balance" }}
              >
                {personality.label}
              </p>
              <p className="mt-2 font-serif text-[13px] leading-[1.58] text-[#8a8177]">
                {personality.translation}
              </p>
              <p className="mt-3 text-[13px] leading-[1.72] text-[#5f5851]">
                {personality.summary}
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-[#ebe4da]/55 pt-8">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
              {CONSUMER_COPY.reportSuggestsLabel}
            </p>
            <p
              className={`mt-3 font-serif text-[1.05rem] font-normal leading-[1.55] tracking-[-0.015em] text-[#3a352f] md:text-[1.12rem] ${showHeroImage ? "max-w-md" : "max-w-2xl"}`}
              style={{ textWrap: "balance" }}
            >
              {interpretationSummary}
            </p>
            <p className={`mt-4 text-[11px] leading-[1.6] text-[#b0a698] ${showHeroImage ? "max-w-md" : "max-w-xl"}`}>
              Report-based read — not a lab grade or in-person verification.{" "}
              <Link
                href="/concierge"
                className="text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]"
                onClick={() =>
                  trackConsultationCtaClicked("diamond_intelligence:hero_verdict")
                }
              >
                Learn more about this diamond
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
