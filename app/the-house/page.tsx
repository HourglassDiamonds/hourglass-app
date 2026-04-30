"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Header from "../shared-components/Header";

export default function TheHousePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isSoundOn, setIsSoundOn] = useState(false);

  const handleToggleSound = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    video.muted = !video.muted;
    setIsSoundOn(!video.muted);
  };

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
        <section className="border-b border-[#e4dbcf] pt-[64px] pb-[96px] md:pt-[80px] md:pb-[112px]">
          <div className="mx-auto max-w-[820px] text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              The House
            </div>

            <h1
              className="mx-auto mt-4 max-w-[24ch] text-[1.6rem] font-light leading-[1.08] tracking-[-0.015em] text-[#1f1d1a] md:text-[2.1rem]"
              style={{ textWrap: "balance" }}
            >
              A perspective shaped over time.
            </h1>

            <div className="mx-auto mt-6 max-w-[44rem] text-[1rem] leading-[1.9] text-[#615a53]">
              <p>
                That perspective was shaped inside the traditional system: sourcing
                diamonds, evaluating gemstones, and seeing how decisions are
                made at the highest levels of the trade. As a Graduate
                Gemologist, Justin served as Lead GG for North America at one
                of the world’s leading firms, and later as Global Head of Sales
                for another, developing a clear sense of what truly matters and
                what doesn’t.
              </p>

              <p className="mt-5">
                Hourglass was built around that clarity, with trusted sourcing
                relationships and manufacturing across multiple continents
                chosen for their specific strengths, so each step is handled
                where it can be done best and the final piece feels considered
                from start to finish.
              </p>
            </div>
          </div>
        </section>

        {/* VIDEO */}
<section className="border-b border-[#e4dbcf] pt-[88px] pb-[104px] md:pt-[104px] md:pb-[120px]">
  <div className="mx-auto max-w-[1040px]">
    <div className="mx-auto max-w-[720px] text-center">
      <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
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
    onClick={() => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }}
    className="rounded-full border border-white/30 bg-white/70 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#3a332c] backdrop-blur-md transition hover:bg-white"
  >
    Replay
  </button>

  <button
    onClick={() => {
      if (!videoRef.current) return;
      videoRef.current.muted = !videoRef.current.muted;
    }}
    className="rounded-full border border-white/30 bg-white/70 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#3a332c] backdrop-blur-md transition hover:bg-white"
  >
    Sound
  </button>
</div>

        {/* APPROACH */}
        <section className="border-b border-[#e4dbcf] py-[92px] md:py-[108px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
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
                comes from a series of careful ones: what is worth showing,
                what is worth refining, where a stone should be sourced, and
                where a design should be brought to life. Not every workshop
                excels at the same things, and not every diamond deserves the
                same path.
              </p>

              <p className="mt-5">
                That is why the process is selective. Not to make things
                complicated, but to keep them clear and considered, so the final
                piece reflects real quality rather than unnecessary noise.
              </p>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-[22px] border border-[#e4dbcf] bg-white/55 p-6 text-center shadow-[0_6px_18px_rgba(48,36,28,0.04)]"
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  {value.title}
                </div>

                <p className="mt-3 text-[14px] leading-7 text-[#5f5851]">
                  {value.meta}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-[108px] md:py-[122px]">
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
              <Link
                href="/concierge"
                className="inline-flex rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition hover:bg-white"
              >
                Start a Private Consultation
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}