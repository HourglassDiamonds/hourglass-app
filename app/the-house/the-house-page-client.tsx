"use client";

import React, { useRef } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "../shared-components/Header";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import EditorialImageMotion from "../shared-components/motion/EditorialImageMotion";
import RevealOnScroll from "../shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "../shared-components/ConsultationCtaLink";

const PERSPECTIVE_MAP = "/the-house/rupanuni-map-hero.png";

const perspectiveMapMaskDesktop: CSSProperties = {
  WebkitMaskImage:
    "radial-gradient(ellipse 94% 86% at 50% 48%, black 0%, black 54%, rgba(0,0,0,0.52) 74%, rgba(0,0,0,0.14) 88%, transparent 100%)",
  maskImage:
    "radial-gradient(ellipse 94% 86% at 50% 48%, black 0%, black 54%, rgba(0,0,0,0.52) 74%, rgba(0,0,0,0.14) 88%, transparent 100%)",
};

const perspectiveMapMaskMobile: CSSProperties = {
  WebkitMaskImage:
    "radial-gradient(ellipse 100% 84% at 50% 46%, black 0%, black 48%, rgba(0,0,0,0.42) 72%, rgba(0,0,0,0.1) 86%, transparent 100%)",
  maskImage:
    "radial-gradient(ellipse 100% 84% at 50% 46%, black 0%, black 48%, rgba(0,0,0,0.42) 72%, rgba(0,0,0,0.1) 86%, transparent 100%)",
};

const perspectiveTextScrimDesktop: CSSProperties = {
  background:
    "radial-gradient(ellipse 118% 62% at 50% 50%, rgba(239,232,222,0.78) 0%, rgba(239,232,222,0.7) 18%, rgba(239,232,222,0.56) 36%, rgba(239,232,222,0.38) 50%, rgba(239,232,222,0.22) 64%, rgba(239,232,222,0.1) 76%, rgba(239,232,222,0.04) 86%, transparent 96%)",
};

const perspectiveTextScrimMobile: CSSProperties = {
  background:
    "radial-gradient(ellipse 108% 58% at 50% 50%, rgba(239,232,222,0.82) 0%, rgba(239,232,222,0.74) 16%, rgba(239,232,222,0.58) 34%, rgba(239,232,222,0.4) 48%, rgba(239,232,222,0.24) 62%, rgba(239,232,222,0.1) 76%, rgba(239,232,222,0.03) 88%, transparent 96%)",
};

export default function TheHousePageClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleReplay = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    video.currentTime = 0;
    video.play();
  };

  const values = [
    {
      title: "Thoughtful Guidance",
      meta: "A private, one-to-one process built around clarity, trust, and steady guidance.",
    },
    {
      title: "Exceptional Sourcing",
      meta: "Diamonds selected for beauty, performance, and character, not just what appears strongest on paper.",
    },
    {
      title: "Designed with Intention",
      meta: "Every detail considered carefully, including where each part of the work is best carried out.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="the-house" />

        {/* THE HOUSE INTRO */}
        <section className="relative -mx-6 overflow-hidden border-b border-[#e4dbcf] px-6 pb-20 pt-16 md:-mx-10 md:px-10 md:pb-[128px] md:pt-[96px]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-x-[-2%] inset-y-[4%] opacity-[0.58] md:hidden"
              style={perspectiveMapMaskMobile}
            >
              <div className="relative h-full w-full">
                <Image
                  src={PERSPECTIVE_MAP}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="origin-[50%_56%] scale-[1.04] object-contain object-[50%_56%] saturate-[0.94] brightness-[1.01]"
                />
              </div>
            </div>

            <div
              className="absolute inset-x-[-16%] inset-y-[-6%] hidden opacity-[0.76] md:block"
              style={perspectiveMapMaskDesktop}
            >
              {/* Perspective light response — the map shifts by a few px
                  with the pointer, heavily damped, like changing viewing
                  angle over an old document. Desktop pointer devices only. */}
              <EditorialImageMotion mode="light" className="relative h-full w-full">
                <Image
                  src={PERSPECTIVE_MAP}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 768px) 0px, 1200px"
                  className="origin-[50%_58%] scale-[1.1] object-contain object-[50%_58%] saturate-[0.96] brightness-[1.01]"
                />
              </EditorialImageMotion>
            </div>

            <div
              className="absolute left-1/2 top-[46%] h-[76%] w-full -translate-x-1/2 -translate-y-1/2 md:hidden"
              style={perspectiveTextScrimMobile}
            />
            <div
              className="absolute left-1/2 top-[44%] hidden h-[80%] w-full -translate-x-1/2 -translate-y-1/2 md:block"
              style={perspectiveTextScrimDesktop}
            />

            <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-[#efe8de] via-[#efe8de]/62 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[#efe8de] via-[#efe8de]/58 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-[16%] bg-gradient-to-r from-[#efe8de] to-transparent md:w-[9%]" />
            <div className="absolute inset-y-0 right-0 w-[16%] bg-gradient-to-l from-[#efe8de] to-transparent md:w-[9%]" />
          </div>

          <div className="relative z-10 mx-auto max-w-[820px] text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
              The House
            </div>

            <h1
              className="mx-auto mt-4 max-w-[24ch] text-[2rem] font-light leading-[1.08] tracking-[-0.015em] text-[#1f1d1a] md:text-[2.45rem]"
              style={{ textWrap: "balance" }}
            >
              A perspective shaped over time.
            </h1>

            <div className="mx-auto mt-6 max-w-[44rem] text-[1rem] leading-[1.9] text-[#615a53]">
              <p>
                That perspective was shaped inside the traditional system: sourcing
                diamonds, evaluating gemstones, and seeing how decisions are made
                at the highest levels of the trade. As a Graduate Gemologist,
                Justin served as Lead GG for North America at one of the world’s
                leading firms, and later as Global Head of Sales for another,
                developing a clear sense of what truly matters and what doesn’t.
              </p>

              <p className="mt-5">
                Hourglass was built around that clarity, with trusted sourcing
                relationships and manufacturing across multiple continents chosen
                for their specific strengths, so each step is handled where it can
                be done best and the final piece feels considered from start to
                finish. For a deeper look at what gemological training means in
                practice, read{" "}
                <Link
                  href="/diamond-guide/why-work-with-a-graduate-gemologist"
                  className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
                >
                  Why Work With a Graduate Gemologist?
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* VIDEO */}
        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] pb-[104px] pt-[88px] md:pb-[120px] md:pt-[104px]">
          <div className="mx-auto max-w-[1040px]">
            <div className="mx-auto max-w-[720px] text-center">
              <div className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
                A Closer Look
              </div>

              <p className="mt-4 text-[1rem] leading-[1.8] text-[#615a53]">
                Our story becomes clearer when you see it.
              </p>
            </div>

            <div className="relative mx-auto mt-10 aspect-[16/9] overflow-hidden rounded-[30px] border border-[#ebe3d8] shadow-[0_14px_34px_rgba(49,38,29,0.05)]">
              <video
                ref={videoRef}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source
                  src="https://res.cloudinary.com/dorddtbvq/video/upload/q_auto/f_auto/v1777515354/The-House-Hero-Video_gpvbue.mp4"
                  type="video/mp4"
                />
              </video>

              <div className="absolute bottom-5 right-5 flex gap-2">
                <button
                  type="button"
                  onClick={handleReplay}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/30 bg-white/70 px-5 text-[10px] uppercase tracking-[0.22em] text-[#3a332c] backdrop-blur-md transition hover:bg-white"
                >
                  Replay
                </button>
              </div>
            </div>
          </div>
        </RevealOnScroll>

        {/* APPROACH */}
        <RevealOnScroll
          as="section"
          stagger
          className="border-b border-[#e4dbcf] py-[92px] md:py-[108px]"
        >
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
              Our Approach
            </div>

            <h2
              className="mx-auto mt-4 max-w-[30ch] text-[1.6rem] font-light leading-[1.08] tracking-[-0.015em] text-[#1f1d1a] md:text-[2.05rem]"
              style={{ textWrap: "balance" }}
            >
              Careful decisions at every stage.
            </h2>

            <div className="mx-auto mt-6 max-w-[42rem] text-[1rem] leading-[1.9] text-[#615a53]">
              <p>
                A beautiful piece is rarely the result of one good choice. It
                comes from a series of careful ones: what is worth showing, what
                is worth refining, where a stone should be sourced, and where a
                design should be brought to life. Not every workshop excels at the
                same things, and not every diamond deserves the same path.
              </p>

              <p className="mt-5">
                That is why the process is selective. Not to make things
                complicated, but to keep them clear and considered, so the final
                piece reflects real quality rather than unnecessary noise. How
                that differs from a traditional jewelry store is explained in{" "}
                <Link
                  href="/diamond-guide/independent-diamond-advisor-vs-jewelry-store"
                  className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
                >
                  Independent Diamond Advisor vs Traditional Jewelry Store
                </Link>
                .
              </p>
            </div>

            <div className="mt-10 flex justify-center">
              <Link
                href="/our-approach"
                className="inline-block border border-[#d6c3a5]/75 bg-[#f8f3eb] px-12 py-5 text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-[color,border-color,transform] duration-500 ease-out hover:-translate-y-px hover:border-[#c4b5a3] hover:text-[#1f1d1a] md:px-20 md:py-6"
              >
                Read Our Approach
                <span
                  aria-hidden
                  className="ml-2 inline-block text-[10px] normal-case tracking-normal opacity-60"
                >
                  →
                </span>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-[22px] border border-[#e4dbcf] bg-white/55 p-6 text-center shadow-[0_6px_18px_rgba(48,36,28,0.04)]"
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
                  {value.title}
                </div>

                <p className="mt-3 text-[14px] leading-7 text-[#5f5851]">
                  {value.meta}
                </p>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        {/* CTA */}
        <RevealOnScroll as="section" className="py-[108px] md:py-[122px]">
          <div className="mx-auto max-w-[720px] text-center">
            <h2
              className="mx-auto max-w-[24ch] text-[1.72rem] font-light leading-[1.14] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.24rem]"
              style={{ textWrap: "balance" }}
            >
              A more considered way to approach something that matters.
            </h2>

            <p className="mx-auto mt-6 max-w-[34rem] text-[1rem] leading-[1.9] text-[#615a53]">
              The difference isn’t in what’s offered. It’s in how decisions are
              made, how details are handled, and how the final piece comes
              together.
            </p>

            <div className="mt-10">
              <CTAGlimmer priority>
                <ConsultationCtaLink
                  location="the_house:footer"
                  className="inline-flex min-h-11 items-center rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition hover:bg-white"
                >
                  Start a Private Consultation
                </ConsultationCtaLink>
              </CTAGlimmer>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}