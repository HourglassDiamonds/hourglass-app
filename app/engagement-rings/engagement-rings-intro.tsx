import Image from "next/image";
import type { CSSProperties } from "react";
import EngagementRingsHeroActions from "./engagement-rings-hero-actions";

const HERO_IMAGE = "/rings/antique-oval-3.png";
const HERO_ALT =
  "Three-stone oval engagement ring with half-moon side diamonds on stone and silk";

/** Dissolves left edge into ivory page bg — ~10% gentler than homepage default for ring clarity. */
const DESKTOP_MASK =
  "linear-gradient(to right, transparent 0%, transparent 3%, rgba(0,0,0,0.08) 15%, rgba(0,0,0,0.24) 23%, rgba(0,0,0,0.50) 31%, rgba(0,0,0,0.74) 37%, rgba(0,0,0,0.90) 43%, rgba(0,0,0,0.97) 47%, black 51%, black 100%)";

const desktopMaskStyle: CSSProperties = {
  WebkitMaskImage: DESKTOP_MASK,
  maskImage: DESKTOP_MASK,
  WebkitMaskSize: "148% 100%",
  maskSize: "148% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

const MOBILE_MASK =
  "linear-gradient(to right, transparent 0%, transparent 5%, rgba(0,0,0,0.12) 10%, rgba(0,0,0,0.30) 15%, rgba(0,0,0,0.54) 19%, rgba(0,0,0,0.78) 23%, black 26%, black 100%)";

const mobileMaskStyle: CSSProperties = {
  WebkitMaskImage: MOBILE_MASK,
  maskImage: MOBILE_MASK,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

const MOBILE_LEFT_BLEND =
  "linear-gradient(to right, #efe8de 0%, #efe8de 7%, rgba(239,232,222,0.84) 17%, rgba(239,232,222,0.56) 31%, rgba(239,232,222,0.20) 46%, transparent 65%)";

const MOBILE_BOTTOM_BLEND =
  "linear-gradient(to top, #efe8de 0%, rgba(239,232,222,0.74) 14%, transparent 36%)";

export default function EngagementRingsIntro() {
  return (
    <>
      <div className="relative overflow-hidden md:min-h-[360px] lg:min-h-[400px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden md:block md:w-[52%] lg:w-[58%] xl:w-[54%]"
          style={desktopMaskStyle}
        >
          <div className="relative h-full w-full">
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              priority
              quality={95}
              sizes="(max-width: 768px) 0px, (max-width: 1280px) 58vw, 680px"
              className="object-cover object-[58%_48%] origin-[58%_48%] scale-[0.98] md:object-[56%_46%] md:origin-[56%_46%] lg:object-[54%_44%] lg:origin-[54%_44%]"
            />
          </div>
        </div>

        <div className="relative z-10 md:max-w-[min(100%,28rem)] lg:max-w-[min(100%,32rem)]">
          <div className="min-w-0 text-left">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Engagement Rings
            </div>

            <h1
              className="mt-4 max-w-[16ch] text-[2rem] font-light leading-[1.1] tracking-[0.015em] text-[#1f1d1a] md:text-[2.45rem]"
              style={{ textWrap: "balance" }}
            >
              Engagement rings, designed around you.
            </h1>

            <p className="mt-5 max-w-[32rem] text-[1rem] leading-[1.88] text-[#625b54] md:text-[1.04rem] lg:max-w-[28rem]">
              Choosing an engagement ring is less about picking a setting from a
              case and more about finding the right balance: diamond,
              proportions, metal, hand, and everyday wear. Hourglass helps you
              compare possibilities with clear guidance so the final ring feels
              intentional rather than rushed.
            </p>

            <p className="mt-4 max-w-[32rem] text-[0.98rem] leading-[1.88] text-[#6a635c] lg:max-w-[28rem]">
              From refined house designs to modified settings, we work with
              clients in Charlotte, South Charlotte, and nationwide to shape the
              ring around the person who will wear it. You&apos;ll have room to
              compare designs, adjust proportions, and choose the diamond before
              anything is finalized.
            </p>

            <EngagementRingsHeroActions />
          </div>
        </div>

        <div className="relative z-10 mt-6 aspect-[3/2] w-full min-h-[220px] max-h-[min(56vw,280px)] md:hidden">
          <div
            className="absolute inset-0 overflow-hidden"
            style={mobileMaskStyle}
          >
            <div className="relative h-full w-full">
              <Image
                src={HERO_IMAGE}
                alt={HERO_ALT}
                fill
                priority
                quality={95}
                sizes="(max-width: 767px) 100vw, 0px"
                className="object-cover object-[52%_50%] origin-[52%_50%] scale-[0.96]"
              />
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[34%]"
            style={{ background: MOBILE_LEFT_BLEND }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[32%]"
            style={{ background: MOBILE_BOTTOM_BLEND }}
          />
        </div>
      </div>

      <p className="mt-8 border-t border-[#e4dbcf]/80 pt-6 text-center text-[0.72rem] uppercase tracking-[0.28em] text-[#6d655e] md:mt-9 md:text-[0.74rem]">
        Graduate Gemologist · Global Sourcing · Personal Guidance
      </p>
    </>
  );
}
