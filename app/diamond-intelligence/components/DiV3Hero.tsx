"use client";

import Link from "next/link";
import {
  buildConciergeHrefFromDiamondIntelligence,
  type DiamondIntelligenceConciergeContext,
} from "@/lib/concierge/diamond-intelligence-context";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import type { V3Gcal8xTier, V3PercentilePresentation } from "./v3-presentation";
import {
  DI_V3_BRAND,
  DI_V3_HERO_CARD,
  DI_V3_HERO_INNER,
  DI_V3_PRODUCT,
  DI_V3_TEXT_CTA,
} from "./di-v3-styles";

export type DiV3HeroProps = {
  mode: "standard" | "gcal8x";
  verdictLabel: string;
  traitLine: string;
  percentile?: V3PercentilePresentation | null;
  gcal8xTier?: V3Gcal8xTier;
  clarityStandardsNote?: string | null;
  reportContext?: DiamondIntelligenceConciergeContext;
};

export default function DiV3Hero({
  mode,
  verdictLabel,
  traitLine,
  percentile,
  gcal8xTier,
  clarityStandardsNote,
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
              {gcal8xTier ?? verdictLabel}
            </h1>
            <p className="mx-auto mt-7 max-w-[540px] text-[clamp(17px,2.2vw,22px)] leading-[1.45] text-[#6f665b]">
              Already within one of the most selective performance-verified
              diamond classes.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#9b8b78]">
              The Read
            </p>
            <h1
              className={`${verdictSizeClass} mb-7 font-serif font-normal uppercase leading-[0.9] tracking-[0.035em] text-[#1e1a16]`}
            >
              {verdictLabel}
            </h1>

            {percentile ? (
              <>
                <p className="font-serif text-[clamp(34px,4.5vw,48px)] leading-none text-[#1e1a16]">
                  {percentile.topLine}
                </p>
                <p className="mt-2 text-[15px] text-[#6f665b]">
                  {percentile.topSubline}
                </p>
                <p className="mx-auto mt-7 max-w-[460px] text-[clamp(17px,2.2vw,22px)] leading-[1.45] text-[#6f665b]">
                  Better than approximately
                  <br />
                  <strong className="font-serif text-[1.32em] font-normal text-[#1e1a16]">
                    {percentile.betterThanPercent}%
                  </strong>{" "}
                  of diamonds reviewed.
                </p>
              </>
            ) : clarityStandardsNote ? (
              <p className="mx-auto mt-7 max-w-[520px] text-[clamp(17px,2.2vw,22px)] leading-[1.55] text-[#6f665b]">
                {clarityStandardsNote}
              </p>
            ) : null}
          </>
        )}

        <p className="mx-auto mt-8 text-center text-[15px] tracking-[0.06em] text-[#514536] md:mt-[34px] md:text-base">
          {traitLine}
        </p>

        <div className="mx-auto mb-8 mt-10 h-px w-full max-w-full bg-[linear-gradient(90deg,transparent,rgba(58,48,38,0.32),transparent)] md:mb-[34px]" />

        <div className="mx-auto max-w-[470px] leading-[1.7] text-[#6f665b]">
          <h2 className="font-serif text-[26px] font-normal text-[#1e1a16] md:text-[29px]">
            Considering this diamond?
          </h2>
          <p className="mt-2.5">I&apos;d be happy to share my thoughts.</p>
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
