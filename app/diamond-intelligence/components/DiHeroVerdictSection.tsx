"use client";

import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import type { DiamondDecisionProfile } from "@/lib/diamond-intelligence/diamond-decision-profile";
import type { EditorialLightPerformancePresentation } from "@/lib/diamond-intelligence/client-editorial-language";
import DiEditorialImage from "./DiEditorialImage";
import {
  DI_BODY,
  DI_BODY_MUTED,
  DI_EYEBROW,
  DI_EYEBROW_ACCENT,
  DI_HEADLINE_SERIF,
  DI_LINK,
  DI_SECTION,
} from "./di-editorial-classes";

export default function DiHeroVerdictSection({
  editorialPresentation,
  personalityDescriptor,
  decisionProfile,
  showPerformanceScore,
  overallScore,
  lowInterpretationConfidence,
  preliminaryLabel,
}: {
  editorialPresentation: EditorialLightPerformancePresentation;
  personalityDescriptor: string;
  decisionProfile: DiamondDecisionProfile;
  showPerformanceScore: boolean;
  overallScore: number | null;
  lowInterpretationConfidence: boolean;
  preliminaryLabel?: string;
}) {
  const verdictLabel = lowInterpretationConfidence
    ? preliminaryLabel ?? "Preliminary Assessment"
    : editorialPresentation.tierLabel;

  const personality = decisionProfile.purchasePersonality;

  return (
    <section className={`${DI_SECTION} !pt-6 md:!pt-8`}>
      <div className="overflow-hidden rounded-[28px] bg-[#f3ede5]/55 ring-1 ring-[#e4dbcf]/35">
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <DiEditorialImage slot="hero" variant="hero" className="lg:min-h-full" />

          <div className="flex flex-col justify-center px-7 py-9 md:px-10 md:py-11 lg:px-12 lg:py-12">
            <p className={DI_EYEBROW_ACCENT}>Our Verdict</p>
            <h2
              className={`${DI_HEADLINE_SERIF} mt-4 text-[2rem] leading-[1.08] md:text-[2.35rem]`}
              style={{ textWrap: "balance" }}
            >
              {verdictLabel}
            </h2>
            <p
              className={`${DI_BODY} mt-5 max-w-md`}
              style={{ textWrap: "balance" }}
            >
              {personalityDescriptor}
            </p>
            {showPerformanceScore && overallScore !== null ? (
              <p className={`${DI_BODY_MUTED} mt-3 text-[0.84rem]`}>
                Performance read {overallScore}
                <span className="text-[#b8afa6]"> / 100</span>
              </p>
            ) : null}

            <div className="mt-9 grid gap-8 sm:grid-cols-2 sm:gap-6 md:mt-10">
              <div>
                <p className={DI_EYEBROW}>Recommendation</p>
                <p
                  className={`${DI_HEADLINE_SERIF} mt-3 text-[1.25rem] leading-[1.2] md:text-[1.35rem]`}
                >
                  {decisionProfile.overallRecommendation.band}
                </p>
                <p className={`${DI_BODY} mt-3 text-[0.94rem] leading-[1.75]`}>
                  {decisionProfile.overallRecommendation.explanation}
                </p>
              </div>

              <div>
                <p className={DI_EYEBROW}>What This Diamond Is</p>
                <p
                  className={`${DI_HEADLINE_SERIF} mt-3 text-[1.2rem] leading-[1.22] md:text-[1.3rem]`}
                >
                  {personality.label}
                </p>
                <p
                  className={`${DI_BODY_MUTED} mt-2 font-serif text-[0.95rem] leading-[1.55]`}
                >
                  {personality.translation}
                </p>
                <p className={`${DI_BODY} mt-3 text-[0.94rem] leading-[1.75]`}>
                  {personality.summary}
                </p>
              </div>
            </div>

            <p className={`${DI_BODY_MUTED} mt-8 text-[0.84rem] leading-[1.65]`}>
              Interpretation only — not a laboratory grade.{" "}
              <ConsultationCtaLink
                location="diamond_intelligence:hero"
                tool="diamond-intelligence"
                className={DI_LINK}
              >
                Have Justin Review This Diamond
              </ConsultationCtaLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
