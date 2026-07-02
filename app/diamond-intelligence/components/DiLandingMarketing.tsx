"use client";

import Image from "next/image";
import { DI_EYEBROW_STUDIO, DI_SERIF_HEADLINE } from "./di-studio-styles";

const STUDIO_HERO_IMAGE = "/homepage/diamond-studio-hero.jpg";

const STUDIO_GRAPHITE = {
  strong: "#1f1d1a",
  body: "#3a3632",
} as const;

/** Mirrors homepage hero — image dissolves left into page background. */
const HERO_DESKTOP_MASK =
  "linear-gradient(to right, transparent 0%, transparent 4%, rgba(0,0,0,0.06) 16%, rgba(0,0,0,0.20) 24%, rgba(0,0,0,0.44) 32%, rgba(0,0,0,0.68) 38%, rgba(0,0,0,0.86) 44%, rgba(0,0,0,0.94) 48%, black 54%, black 100%)";

const heroDesktopMaskStyle: React.CSSProperties = {
  WebkitMaskImage: HERO_DESKTOP_MASK,
  maskImage: HERO_DESKTOP_MASK,
  WebkitMaskSize: "155% 100%",
  maskSize: "155% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

/** Mobile — full artwork visibility; soft fade confined to lower edge only. */
const HERO_MOBILE_MASK =
  "linear-gradient(to bottom, black 0%, black 48%, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.42) 84%, rgba(0,0,0,0.16) 93%, transparent 100%)";

const heroMobileMaskStyle: React.CSSProperties = {
  WebkitMaskImage: HERO_MOBILE_MASK,
  maskImage: HERO_MOBILE_MASK,
  WebkitMaskSize: "100% 104%",
  maskSize: "100% 104%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center center",
  maskPosition: "center center",
};

const TRUST_ITEMS = [
  "Private by Default",
  "Independent Analysis",
  "Graduate Gemologist Reviewed",
  "No Sales Pressure",
] as const;

function scrollToUpload() {
  document.getElementById("di-upload-form")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function LandingHero() {
  return (
    <section
      className="relative overflow-hidden border-b border-[#e4dbcf]/60 bg-[#f7f1e7] pb-6 pt-2 md:min-h-[400px] md:pb-8 md:pt-3 lg:min-h-[440px]"
      aria-labelledby="di-landing-headline"
      data-hourglass-di="landing-hero"
    >
      <div
        aria-hidden
        className="absolute inset-0 hidden md:block"
        style={heroDesktopMaskStyle}
      >
        <Image
          src={STUDIO_HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[62%_52%] origin-[62%_48%] scale-[1.12] lg:object-[64%_50%] lg:scale-[1.1]"
        />
      </div>

      <div className="relative mx-auto max-w-[1200px]">
        <div className="relative z-10 flex min-h-0 flex-col justify-center px-5 md:min-h-[380px] md:px-10 lg:min-h-[420px]">
          <div className="min-w-0 max-w-[440px] max-md:mx-auto max-md:text-center md:text-left">
            <p className={DI_EYEBROW_STUDIO}>Diamond Intelligence</p>

            <h1
              id="di-landing-headline"
              className={`${DI_SERIF_HEADLINE} mt-4 font-serif text-[clamp(1.75rem,4.8vw,2.65rem)] font-normal leading-[1.12] tracking-[-0.028em] md:mt-5 md:leading-[1.1]`}
              style={{ textWrap: "balance", color: STUDIO_GRAPHITE.strong }}
            >
              Understand a Diamond Before You Buy It.
            </h1>

            <p
              className="mt-4 max-w-[32ch] text-[0.92rem] leading-[1.72] max-md:mx-auto md:mt-5 md:text-[0.95rem] md:leading-[1.78]"
              style={{ color: STUDIO_GRAPHITE.body, textWrap: "balance" }}
            >
              Receive an independent assessment of quality, light performance,
              craftsmanship, and purchase value before making a decision.
            </p>

            <div className="mt-6 flex flex-col items-start gap-2.5 max-md:mx-auto max-md:items-center md:mt-7">
              <button
                type="button"
                onClick={scrollToUpload}
                className="inline-flex items-center justify-center rounded-full border border-[#ece4da]/70 bg-[rgba(255,252,248,0.94)] px-6 py-3 text-[10px] uppercase tracking-[0.28em] text-[#5c534a] shadow-[0_2px_10px_rgba(48,36,28,0.04)] backdrop-blur-[6px] transition-colors duration-300 hover:bg-[rgba(255,252,248,0.98)] hover:text-[#2b2723] md:px-7"
              >
                Analyze a Diamond
              </button>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#948a80]">
                Private. Independent. No sales pressure.
              </p>
            </div>
          </div>

          <div
            aria-hidden
            className="relative mt-7 aspect-[16/10] min-h-[220px] w-full md:hidden"
            style={heroMobileMaskStyle}
          >
            <Image
              src={STUDIO_HERO_IMAGE}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[50%_54%] scale-[1.06] origin-[50%_42%]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustPrivacyBand() {
  return (
    <section
      className="mt-6 border-t border-[#e4dbcf]/70 pt-6 md:mt-7 md:pt-7"
      aria-label="Trust and privacy"
    >
      <ul className="grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-4 md:gap-0">
        {TRUST_ITEMS.map((item, index) => (
          <li
            key={item}
            className={`px-1 text-center text-[9px] uppercase leading-snug tracking-[0.24em] text-[#8a8177] sm:text-[10px] sm:tracking-[0.28em] ${
              index > 0
                ? "md:border-l md:border-[#e4dbcf]/70 md:px-4 lg:px-6"
                : "md:px-4 lg:px-6"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DiLandingIntro() {
  return (
    <p
      className={`${DI_SERIF_HEADLINE} mx-auto mb-2 max-w-[36rem] text-center text-[0.94rem] font-normal leading-[1.78] tracking-normal text-[#5f5148] md:text-[1rem] md:leading-[1.82]`}
      style={{ textWrap: "balance" }}
    >
      Diamond Intelligence is an independent interpretation layer for original
      diamond grading reports. Upload a PDF from a recognized laboratory to
      receive an assessment of quality, light performance, craftsmanship, and
      purchase value before making a decision.
    </p>
  );
}

export default function DiLandingMarketing() {
  return <LandingHero />;
}
