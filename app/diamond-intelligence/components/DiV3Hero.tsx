"use client";

import Image from "next/image";
import type { DiamondIntelligenceConciergeContext } from "@/lib/concierge/diamond-intelligence-context";
import type { V3Gcal8xTier, V3HeroPresentation } from "./v3-presentation";
import {
  DI_V3_HERO_CARD,
  DI_V3_HERO_INNER,
  DI_V3_HERO_KICKER_BRAND,
  DI_V3_HERO_KICKER_PRODUCT,
  DI_V3_HERO_PROOF,
  DI_V3_HERO_TRAIT,
  DI_V3_HERO_WATERMARK,
  DI_V3_HERO_WATERMARK_IMG,
} from "./di-v3-styles";

export type DiV3HeroProps = {
  mode: "standard" | "gcal8x";
  hero: V3HeroPresentation;
  traitLine: string;
  gcal8xTier?: V3Gcal8xTier;
  reportContext?: DiamondIntelligenceConciergeContext;
};

function HeroKicker() {
  return (
    <div className="mb-8 md:mb-10">
      <p className={DI_V3_HERO_KICKER_BRAND}>Hourglass Diamonds</p>
      <p className={DI_V3_HERO_KICKER_PRODUCT}>Diamond Intelligence Review</p>
    </div>
  );
}

export default function DiV3Hero({
  mode,
  hero,
  traitLine,
  gcal8xTier,
}: DiV3HeroProps) {
  const verdictSizeClass =
    mode === "gcal8x" && gcal8xTier === "Rare"
      ? "text-[clamp(48px,8vw,96px)]"
      : "text-[clamp(45px,7vw,76px)]";

  return (
    <article className={DI_V3_HERO_CARD}>
      <div className={DI_V3_HERO_WATERMARK} aria-hidden>
        <Image
          src="/hourglass-logo-gold.png"
          alt=""
          width={300}
          height={300}
          className={DI_V3_HERO_WATERMARK_IMG}
          priority
        />
      </div>

      <div className={DI_V3_HERO_INNER}>
        <HeroKicker />

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
              className={`${verdictSizeClass} mt-7 font-serif font-normal uppercase leading-[0.9] tracking-[0.035em] text-[#1e1a16] md:mt-8`}
            >
              {hero.purchaseHeadline}
            </h1>
            <p className="mx-auto mt-8 max-w-[540px] font-serif text-[clamp(18px,2.4vw,24px)] leading-[1.35] text-[#514536] md:mt-10">
              Among the most selective performance-verified diamond classes.
            </p>
            <p className={`${DI_V3_HERO_TRAIT} mt-10 md:mt-12`}>{traitLine}</p>
          </>
        ) : (
          <>
            <h1
              className={`${verdictSizeClass} font-serif font-normal uppercase leading-[0.92] tracking-[0.03em] text-[#1e1a16]`}
            >
              {hero.purchaseHeadline}
            </h1>

            {hero.purchaseSubline ? (
              <p className="mx-auto mt-8 max-w-[540px] font-serif text-[clamp(18px,2.4vw,24px)] leading-[1.35] text-[#514536] md:mt-10">
                {hero.purchaseSubline}
              </p>
            ) : null}

            <p
              className={`${DI_V3_HERO_TRAIT} ${
                hero.purchaseSubline ? "mt-10 md:mt-12" : "mt-8 md:mt-10"
              }`}
            >
              {traitLine}
            </p>

            {hero.opticalPerformanceLine || hero.opticalDetailLine ? (
              <div className="mx-auto mt-8 max-w-[520px] space-y-2 text-[14px] leading-[1.6] text-[#8a8177] md:mt-10">
                {hero.opticalPerformanceLine ? (
                  <p>{hero.opticalPerformanceLine}</p>
                ) : null}
                {hero.opticalDetailLine ? (
                  <p>{hero.opticalDetailLine}</p>
                ) : null}
              </div>
            ) : null}

            {hero.percentile?.scope === "broad" ? (
              <div className={DI_V3_HERO_PROOF}>
                <p className="font-serif text-[19px] leading-tight text-[#6f665b]">
                  {hero.percentile.topLine}
                </p>
                <p className="mt-1.5">{hero.percentile.topSubline}</p>
                {hero.percentile.betterThanPercent != null ? (
                  <p className="mt-3">
                    Better than approximately{" "}
                    <span className="font-serif text-[#514536]">
                      {hero.percentile.betterThanPercent}%
                    </span>{" "}
                    of diamonds reviewed.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        <div className="mx-auto mt-12 h-px w-full max-w-full bg-[linear-gradient(90deg,transparent,rgba(58,48,38,0.24),transparent)] md:mt-14" />
      </div>
    </article>
  );
}
