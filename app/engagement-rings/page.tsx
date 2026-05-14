"use client";

import React from "react";
import Link from "next/link";
import Header from "../shared-components/Header";
import SectionHeading from "../shared-components/SectionHeading";

export default function EngagementRingsPage() {
  const process = [
    "We begin with a conversation around style, shape, budget, and how the ring will actually be worn.",
    "Diamonds are sourced with clear visual guidance, honest recommendations, and no pressure to choose before it feels right.",
    "The design is refined through proportion, reference imagery, and small adjustments until the direction feels natural.",
    "The finished piece is created, reviewed, and presented with the same care that shaped the process from the start.",
  ];

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="engagement-rings" />

        <section className="border-b border-[#e4dbcf] pb-[58px] pt-[54px] md:pb-[66px] md:pt-[62px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              Engagement Rings
            </div>

            <h1
              className="mt-5 text-[2.08rem] font-light leading-[1.06] tracking-[-0.025em] text-[#1f1d1a] md:text-[2.8rem]"
              style={{ textWrap: "balance" }}
            >
              Designed Around You
            </h1>

            <p className="mx-auto mt-6 max-w-[35rem] text-[1rem] leading-[1.85] text-[#625b54]">
              A private, guided process for creating a ring that feels
              considered, balanced, and unmistakably yours. These are just a few visuals to get the wheels turning.
            </p>

            <p className="mx-auto mt-4 max-w-[35rem] text-[0.98rem] leading-[1.9] text-[#6f6b66]">
  For those still refining direction, the{" "}
  <a href="/diamond-guide" className="underline underline-offset-4 hover:no-underline">
    Diamond Guide
  </a>{" "}
  offers a clear foundation before comparing specific designs.
</p>

          </div>
        </section>
      </div>

      <section className="border-b border-[#e4dbcf] py-[78px] md:py-[92px]">
        <div className="px-3 md:px-4 xl:px-6">
          <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,rgba(255,255,255,0.38),rgba(246,240,232,0.58))] shadow-[0_22px_70px_rgba(48,36,28,0.045)] ring-1 ring-[#e6ddd1]/70">
            <div className="md:hidden">
              <div className="px-6 py-8 text-center">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  Ring Studio
                </div>
                <p className="mx-auto mt-3 max-w-[26rem] text-[0.98rem] leading-[1.75] text-[#5f5851]">
                  Open the Ring Studio in a full-screen view for the best mobile
                  experience.
                </p>
                <a
                  href="/ring-studio/ring-studio-embed.html"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#f6f2eb]"
                >
                  Open Ring Studio
                </a>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[30px] md:block">
            <iframe
              src="/ring-studio/ring-studio-embed.html"
              className="h-[760px] w-full border-0 xl:h-[820px]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <section className="border-b border-[#e4dbcf] py-[92px] md:py-[104px]">
          <div className="mx-auto max-w-[820px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              Custom Design Process
            </div>

            <h2
              className="mt-5 text-[1.95rem] font-light leading-[1.09] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.55rem]"
              style={{ textWrap: "balance" }}
            >
              A bespoke process designed to feel calm, clear, and deeply
              personal.
            </h2>

            <p className="mx-auto mt-6 max-w-[43rem] text-[1rem] leading-[1.9] text-[#5f5851] md:text-[1.03rem]">
              Each project moves one step at a time, with enough guidance to
              make the decisions clear and enough room for the piece to become
              personal.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-4 md:grid-cols-2">
            {process.map((step, index) => (
              <div
                key={step}
                className="h-full rounded-[22px] border border-[#e4dbcf] bg-white/58 px-6 py-6 shadow-[0_10px_26px_rgba(48,36,28,0.04)] md:px-7 md:py-7"
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  Step {index + 1}
                </div>

                <p className="mt-3 text-[0.95rem] leading-[1.75] text-[#5f5851]">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-[86px] text-center md:py-[96px]">
          <SectionHeading
            title="A calmer way to begin."
            description="Start with a private conversation. We’ll understand the direction, then shape the right next step together."
          />

          <Link
            href="/concierge"
            className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#f6f2eb]"
          >
            Begin the Conversation
          </Link>
        </section>
      </div>
    </div>
  );
}