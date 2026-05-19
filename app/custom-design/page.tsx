"use client";

import React from "react";
import Link from "next/link";
import Header from "../shared-components/Header";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

export default function CustomDesignPage() {
  const processSteps = [
    {
      title: "Begin with a conversation",
      body:
        "We start with a simple conversation. In person, over video, or however you prefer. No pressure, no rush. Just a clear understanding of what you’re looking for and what matters most.",
    },
    {
      title: "Source with intention",
      body:
        "From there, we narrow things down. Rather than showing everything, we focus on a small number of options that actually make sense for the piece. Each one is chosen for a reason.",
    },
    {
      title: "Refine the details",
      body:
        "The design comes together step by step. We adjust proportions, review renderings, and make small changes until everything feels balanced and right.",
    },
  ];

  const productionNotes = [
    {
      title: "Timing",
      body:
        "Once the design is approved, most pieces are completed in about four to six weeks, depending on the materials and complexity.",
    },
    {
      title: "Craft",
      body:
        "Each piece is made by the workshop best suited to it. What matters most is not where it’s made, but how well it’s done.",
    },
    {
      title: "Nationwide",
      body:
        "Some clients prefer to meet in person. Many work with us remotely. Either way, the process stays simple, clear, and easy to follow from start to finish.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="custom-design" />

        <section className="border-b border-[#e4dbcf] pb-[76px] pt-[56px] md:pb-[104px] md:pt-[68px]">
          <div className="mx-auto max-w-[620px] text-center">
            <div className="text-[10px] uppercase tracking-[0.36em] text-[#8a8177]">
              Custom Design
            </div>

            <h1
              className="mt-6 text-[2.05rem] font-light leading-[1.02] tracking-[-0.025em] text-[#1f1d1a] md:text-[2.7rem]"
              style={{ textWrap: "balance" }}
            >
              Custom design should feel personal long before the ring is
              finished.
            </h1>

            <p className="mx-auto mt-7 max-w-[37rem] text-[1rem] leading-[1.82] text-[#5f5851] md:text-[1.04rem]">
              A piece like this comes together through a series of considered
              decisions, each one refining the next until the final piece feels
              balanced, natural, and entirely your own. If you are still exploring direction, the{" "}
  <a href="/diamond-guide" className="underline underline-offset-4 hover:no-underline">
    Diamond Guide
  </a>{" "}
  can help clarify what matters before the design process begins.
            </p>
          </div>
        </section>

      

        <section className="border-b border-[#e4dbcf] py-[88px] md:py-[96px]">
          <div className="mx-auto max-w-[860px] text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              The Design Process
            </div>

            <h2
              className="mt-5 text-[1.8rem] font-light leading-[1.08] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.2rem]"
              style={{ textWrap: "balance" }}
            >
              A more thoughtful way to create.
            </h2>

            <p className="mx-auto mt-6 max-w-[34rem] text-[0.98rem] leading-[1.85] text-[#5f5851] md:text-[1.02rem]">
              Clear enough to feel easy. Personal enough to feel like your own.
              Many clients describe the process as{" "}
              <WhisperedPraiseLink>calm and collaborative</WhisperedPraiseLink>.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[1100px] gap-5 md:grid-cols-3">
            {processSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-[24px] border border-[#e4dbcf] bg-white/52 p-6 shadow-[0_10px_26px_rgba(48,36,28,0.035)]"
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a8177]">
                  {step.title}
                </div>
                <p className="mt-4 text-[0.95rem] leading-[1.72] text-[#5f5851]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-[#e4dbcf] py-[88px] md:py-[96px]">
          <div className="mx-auto max-w-[780px] text-center">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              Craft, Timing &amp; Service
            </div>

            <h2
              className="mt-5 text-[1.8rem] font-light leading-[1.08] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.2rem]"
              style={{ textWrap: "balance" }}
            >
              Built with the same care that defines the process.
            </h2>

            <p className="mx-auto mt-5 max-w-[34rem] text-[0.98rem] leading-[1.85] text-[#5f5851] md:text-[1.02rem]">
              Once the design is approved, the rest should feel steady, clear,
              and well handled.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[1100px] gap-5 md:grid-cols-3">
            {productionNotes.map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-[#e4dbcf] bg-white/52 p-6 shadow-[0_10px_26px_rgba(48,36,28,0.035)]"
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a8177]">
                  {item.title}
                </div>
                <p className="mt-4 text-[0.95rem] leading-[1.72] text-[#5f5851]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#e9e1d6] pb-[104px] pt-[76px] md:pb-[112px] md:pt-[82px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[#7d746a]">
              Private Design Guidance
            </div>

            <p
              className="mx-auto mt-6 max-w-[30rem] text-[1.42rem] font-light leading-[1.35] tracking-[-0.03em] text-[#1f1d1a] md:text-[1.72rem]"
              style={{ textWrap: "balance" }}
            >
              A more considered way to create something that matters.
            </p>

            <p className="mx-auto mt-5 max-w-[25rem] text-[0.98rem] leading-[1.8] text-[#615a53] md:text-[1rem]">
              When you’re ready, we’ll start with a conversation.
            </p>

            <p className="mx-auto mt-10 max-w-[31rem] text-[0.9rem] leading-[1.75] text-[#5f5851]">
              We take on a limited number of projects each month so each one
              receives the time and attention it deserves.
            </p>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/concierge"
              className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-wide text-white transition-all duration-500 ease-out hover:-translate-y-[1px] hover:opacity-90"
            >
              Begin the Conversation
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}