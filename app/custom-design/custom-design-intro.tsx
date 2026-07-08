import Image from "next/image";
import type { CSSProperties } from "react";
import CustomDesignHeroActions from "./custom-design-hero-actions";
import {
  CUSTOM_DESIGN_ALT,
  CUSTOM_DESIGN_MEDIA,
} from "./custom-design-media-config";

/** Soft left fade into ivory — slightly gentler so CAD details stay readable. */
const DESKTOP_MASK =
  "linear-gradient(to right, transparent 0%, transparent 2%, rgba(0,0,0,0.10) 12%, rgba(0,0,0,0.28) 20%, rgba(0,0,0,0.52) 28%, rgba(0,0,0,0.74) 34%, rgba(0,0,0,0.90) 40%, rgba(0,0,0,0.97) 45%, black 50%, black 100%)";

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

export default function CustomDesignIntro() {
  return (
    <>
      <div className="relative overflow-hidden md:min-h-[400px] lg:min-h-[440px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden md:block md:w-[52%] lg:w-[56%] xl:w-[54%]"
          style={desktopMaskStyle}
        >
          <div className="relative h-full w-full">
            <Image
              src={CUSTOM_DESIGN_MEDIA.hero}
              alt=""
              fill
              priority
              quality={95}
              sizes="(max-width: 768px) 0px, (max-width: 1280px) 56vw, 640px"
              className="object-cover object-[62%_42%] origin-[62%_42%] scale-[1.02] md:object-[60%_40%] lg:object-[58%_38%]"
            />
          </div>
        </div>

        <div className="relative z-10 md:max-w-[min(100%,26rem)] lg:max-w-[min(100%,32rem)]">
          <div className="min-w-0 text-left">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              Custom Design
            </div>

            <h1
              className="mt-4 max-w-[18ch] text-[2rem] font-light leading-[1.1] tracking-[0.015em] text-[#1f1d1a] md:text-[2.45rem]"
              style={{ textWrap: "balance" }}
            >
              Custom engagement rings, designed through a more personal process.
            </h1>

            <p className="mt-5 max-w-[32rem] text-[1rem] leading-[1.88] text-[#625b54] md:text-[1.04rem] lg:max-w-[28rem]">
              For clients in the Charlotte area, custom engagement rings begin
              with what the finished piece should express. Guided by a Graduate
              Gemologist, the diamond, setting, proportions, and personal
              details are considered together from the first conversation, not
              treated as separate decisions made under showroom pressure.
            </p>

            <p className="mt-4 max-w-[32rem] text-[0.98rem] leading-[1.88] text-[#6a635c] lg:max-w-[28rem]">
              Hourglass works with clients across Charlotte, South Charlotte,
              and nationwide. References and ideas are interpreted into a
              one-of-one design, with custom fine jewelry beyond engagement
              rings available when the piece calls for it.
            </p>

            <CustomDesignHeroActions />
          </div>
        </div>

        <div className="relative z-10 mt-6 aspect-[4/5] w-full min-h-[240px] max-h-[min(68vw,340px)] md:hidden">
          <div
            className="absolute inset-0 overflow-hidden"
            style={mobileMaskStyle}
          >
            <div className="relative h-full w-full">
              <Image
                src={CUSTOM_DESIGN_MEDIA.hero}
                alt={CUSTOM_DESIGN_ALT.hero}
                fill
                priority
                quality={95}
                sizes="(max-width: 767px) 100vw, 0px"
                className="object-cover object-[55%_38%] origin-[55%_38%] scale-[1.01]"
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
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[28%]"
            style={{ background: MOBILE_BOTTOM_BLEND }}
          />
        </div>
      </div>

      <p className="mt-6 border-t border-[#e4dbcf]/80 pt-5 text-center text-[0.72rem] uppercase tracking-[0.28em] text-[#8a8177] md:mt-7 md:pt-5 md:text-[0.74rem]">
        Graduate Gemologist · Global Sourcing · Custom Design
      </p>
    </>
  );
}
