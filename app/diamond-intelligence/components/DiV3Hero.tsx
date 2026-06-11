"use client";

import Link from "next/link";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import type { V3Gcal8xTier, V3HeroPresentation } from "./v3-presentation";
import {
  DI_V3_BRAND,
  DI_V3_HERO_CARD,
  DI_V3_HERO_INNER,
  DI_V3_PRODUCT,
  DI_V3_TEXT_CTA,
} from "./di-v3-styles";

export type DiV3HeroProps = {
  mode: "standard" | "gcal8x";
  hero: V3HeroPresentation;
  traitLine: string;
  gcal8xTier?: V3Gcal8xTier;
  reportContext?: DiamondIntelligenceConciergeContext;
};

export default function DiV3Hero({
  mode,
  hero,
  traitLine,
  gcal8xTier,
  reportContext,
}: DiV3HeroProps) {
  const conciergeHref = buildConciergeHrefFromDiamondIntelligence(
    reportContext ?? {},
  );

  const verdictSizeClass =
    mode === "gcal8x" && gcal8xTier === "Rare"
      ? "text-[clamp(48px,8vw,96px)]"
      : "text-[clamp(45px,7vw,76px)]";

  return (
    <article className={DI_V3_HERO_CARD}>
      <div className={DI_V3_HERO_INNER}>
        <div className="mb-6 md:mb-[30px]">
          <div className={DI_V3_BRAND}>Hourglass Diamonds</div>
          <div className={DI_V3_PRODUCT}>Diamond Intelligence</div>
        </div>

        {mode === "gcal8x" ? (
          <>
            <div className="mx-auto inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(181,150,98,0.42)] bg-[rgba(181,150,98,0.10)] px-4 py-[11px] text-[11px] uppercase tracking-[0.15em] text-[#514536]">
              <span
                className="h-[7px] w-[7px] rounded-full bg-[#b59662] shadow-[0_0_0_5px_rgba(181,150,98,0.12)]"
                aria-hidden
              />
              GCAL 8X Verified
            </div>
            <h1
              className={`${verdictSizeClass} mt-5 font-serif font-normal uppercase leading-[0.9] tracking-[0.035em] text-[#1e1a16]`}
            >
              {gcal8xTier ?? hero.purchaseHeadline}
            </h1>
            <p className="mx-auto mt-7 max-w-[540px] text-[clamp(17px,2.2vw,22px)] leading-[1.45] text-[#6f665b]">
              Already within one of the most selective performance-verified
              diamond classes.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#9b8b78]">
              Advisory Read
            </p>
            <h1
              className={`${verdictSizeClass} mb-4 font-serif font-normal uppercase leading-[0.92] tracking-[0.03em] text-[#1e1a16]`}
            >
              {hero.purchaseHeadline}
            </h1>

            {hero.purchaseSubline ? (
              <p className="mx-auto mb-5 max-w-[540px] font-serif text-[clamp(18px,2.4vw,24px)] leading-[1.35] text-[#514536]">
                {hero.purchaseSubline}
              </p>
            ) : null}

            {hero.opticalPerformanceLine ? (
              <p className="text-[clamp(16px,2vw,19px)] leading-[1.5] text-[#6f665b]">
                {hero.opticalPerformanceLine}
              </p>
            ) : null}

            {hero.opticalDetailLine ? (
              <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-[1.6] text-[#6f665b]">
                {hero.opticalDetailLine}
              </p>
            ) : null}

            {hero.percentile?.scope === "broad" ? (
              <>
                <p className="mt-7 font-serif text-[clamp(34px,4.5vw,48px)] leading-none text-[#1e1a16]">
                  {hero.percentile.topLine}
                </p>
                <p className="mt-2 text-[15px] text-[#6f665b]">
                  {hero.percentile.topSubline}
                </p>
                {hero.percentile.betterThanPercent != null ? (
                  <p className="mx-auto mt-7 max-w-[460px] text-[clamp(17px,2.2vw,22px)] leading-[1.45] text-[#6f665b]">
                    Better than approximately
                    <br />
                    <strong className="font-serif text-[1.32em] font-normal text-[#1e1a16]">
                      {hero.percentile.betterThanPercent}%
                    </strong>{" "}
                    of diamonds reviewed.
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}

        <p className="mx-auto mt-8 text-center text-[15px] tracking-[0.06em] text-[#514536] md:mt-[34px] md:text-base">
          {traitLine}
        </p>

        <div className="mx-auto mb-8 mt-10 h-px w-full max-w-full bg-[linear-gradient(90deg,transparent,rgba(58,48,38,0.24),transparent)] md:mb-[34px]" />

        <div className="mx-auto max-w-[470px] leading-[1.7] text-[#6f665b]">
          <h2 className="font-serif text-[26px] font-normal text-[#1e1a16] md:text-[29px]">
            Have Justin Review This Diamond
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            Justin personally reviews a limited number of diamonds each week.
            Share the report or listing and he can help determine whether it is
            worth pursuing.
          </p>
          <p className="mt-4 text-sm tracking-[0.04em] text-[#1e1a16]">
            Justin Smith, GG
          </p>
          <Link
            href={conciergeHref}
            className={`${DI_V3_TEXT_CTA} mt-5`}
            onClick={() =>
              trackConsultationCtaClicked("diamond_intelligence:v3_hero")
            }
          >
            Request Justin&apos;s Review →
          </Link>
        </div>
      </div>
    </article>
  );
}
