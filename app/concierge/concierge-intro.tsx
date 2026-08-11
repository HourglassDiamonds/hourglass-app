import Image from "next/image";
import type { CSSProperties } from "react";
import { CONCIERGE_VISIBLE_COPY } from "@/lib/concierge/conversational-copy";
import SectionHeading from "../shared-components/SectionHeading";
import ConciergeOfficeInfo from "./concierge-office-info";

const HERO_IMAGE = "/concierge-hero.png";
const HERO_ALT =
  "Engagement ring with design sketches and jeweler's tools on a warm stone surface";

/** Matches homepage desktop hero — dissolves left edge into ivory page bg. */
const DESKTOP_MASK =
  "linear-gradient(to right, transparent 0%, transparent 4%, rgba(0,0,0,0.06) 16%, rgba(0,0,0,0.20) 24%, rgba(0,0,0,0.44) 32%, rgba(0,0,0,0.68) 38%, rgba(0,0,0,0.86) 44%, rgba(0,0,0,0.94) 48%, black 54%, black 100%)";

const desktopMaskStyle: CSSProperties = {
  WebkitMaskImage: DESKTOP_MASK,
  maskImage: DESKTOP_MASK,
  WebkitMaskSize: "155% 100%",
  maskSize: "155% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

/** Mobile — matches homepage mobile hero mask. */
const MOBILE_MASK =
  "linear-gradient(to right, transparent 0%, transparent 6%, rgba(0,0,0,0.10) 11%, rgba(0,0,0,0.28) 16%, rgba(0,0,0,0.52) 20%, rgba(0,0,0,0.76) 24%, black 28%, black 100%)";

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
  "linear-gradient(to right, #efe8de 0%, #efe8de 8%, rgba(239,232,222,0.92) 18%, rgba(239,232,222,0.62) 32%, rgba(239,232,222,0.22) 48%, transparent 68%)";

const MOBILE_BOTTOM_BLEND =
  "linear-gradient(to top, #efe8de 0%, rgba(239,232,222,0.82) 16%, transparent 38%)";

const copy = CONCIERGE_VISIBLE_COPY.hero;

export default function ConciergeIntro() {
  return (
    <div className="relative overflow-hidden md:min-h-[380px] lg:min-h-[420px]">
      {/* Tablet + desktop — right panel with homepage-style left fade */}
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
            className="object-cover object-[44%_42%] origin-[44%_42%] scale-[0.98] md:object-[46%_44%] md:origin-[46%_44%] lg:object-[48%_44%] lg:origin-[48%_44%] xl:object-[50%_42%] xl:origin-[50%_42%]"
          />
        </div>
      </div>

      <div className="relative z-10 md:max-w-[min(100%,26rem)] lg:max-w-[min(100%,32rem)]">
        <div className="min-w-0 text-left">
          <SectionHeading
            as="h1"
            eyebrow={copy.eyebrow}
            title={copy.title}
            titleClassName="max-w-[14ch]"
          />

          <p className="mt-5 max-w-[32rem] text-[1rem] leading-[1.88] text-[#6a635c] md:text-[1.04rem] lg:max-w-[28rem]">
            {copy.body}
          </p>

          <p className="mt-5 max-w-[32rem] text-[0.95rem] leading-[1.88] text-[#6d655e] lg:max-w-[28rem]">
            {copy.followUpPrefix}{" "}
            <a
              href="mailto:justin@hourglassdiamonds.com"
              className="hg-tap text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
            >
              justin@hourglassdiamonds.com
            </a>
            .
          </p>

          <p className="mt-6 max-w-[28rem] text-[0.88rem] leading-[1.75] tracking-[0.01em] text-[#6d655e] md:mt-7">
            {copy.reassurance}
          </p>

          <ConciergeOfficeInfo />
        </div>
      </div>

      {/* Mobile — landscape crop, copy above, subtle edge fades */}
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
              className="object-cover object-[38%_48%] origin-[38%_48%] scale-[0.96]"
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
  );
}
