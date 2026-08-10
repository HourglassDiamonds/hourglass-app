"use client";

import Link from "next/link";
import Header from "@/app/shared-components/Header";
import CTAGlimmer from "@/app/shared-components/motion/CTAGlimmer";
import RevealOnScroll from "@/app/shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import { DI_V3_SECTIONS } from "@/app/diamond-intelligence/components/di-v3-styles";
import { APPROACH_CHAPTERS } from "./content";
import ApproachChapter from "./components/ApproachChapter";

function MidPageCta() {
  return (
    <RevealOnScroll as="section" className="mx-auto w-full max-w-[960px]">
      <div className="overflow-hidden rounded-[22px] border border-[rgba(181,150,98,0.28)] bg-[radial-gradient(circle_at_top_left,rgba(181,150,98,0.10),transparent_24rem),rgba(251,247,239,0.82)] px-7 py-10 text-center md:px-10 md:py-12">
        <h2
          className="mx-auto max-w-[22ch] font-serif text-[clamp(1.45rem,3.2vw,1.95rem)] font-normal leading-[1.14] tracking-[-0.02em] text-[#1f1d1a]"
          style={{ textWrap: "balance" }}
        >
          Still Evaluating a Diamond?
        </h2>
        <p className="mx-auto mt-5 max-w-[36rem] text-[0.96rem] leading-[1.88] text-[#615a53]">
          Diamond Intelligence was built to help consumers understand how a
          diamond is likely to perform in the real world — not just how it
          appears on a grading report.
        </p>
        <div className="mt-8">
          <CTAGlimmer>
            <Link
              href="/diamond-intelligence"
              className="inline-flex min-h-11 items-center rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition hover:bg-white"
            >
              Explore Diamond Intelligence
            </Link>
          </CTAGlimmer>
        </div>
      </div>
    </RevealOnScroll>
  );
}

function FinalCta() {
  return (
    <RevealOnScroll as="section" className="mx-auto max-w-[720px] text-center">
      <h2
        className="mx-auto max-w-[24ch] text-[1.72rem] font-light leading-[1.14] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.05rem]"
        style={{ textWrap: "balance" }}
      >
        Begin With Better Information
      </h2>
      <p className="mx-auto mt-6 max-w-[38rem] text-[1rem] leading-[1.9] text-[#615a53]">
        Whether you&apos;re comparing diamonds online, evaluating a grading
        report, or beginning a custom engagement ring project, our goal remains
        the same: help you make a confident decision. For foundational reading
        on expertise and how we work, start with{" "}
        <Link
          href="/diamond-guide/buying-strategy"
          className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
        >
          Buying Strategy
        </Link>
        .
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
        <CTAGlimmer>
          <Link
            href="/diamond-intelligence"
            className="inline-flex min-h-11 items-center rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-[#6f665d] transition hover:bg-white"
          >
            Explore Diamond Intelligence
          </Link>
        </CTAGlimmer>
        <CTAGlimmer>
          <ConsultationCtaLink
            location="our_approach:final_cta"
            className="inline-flex min-h-11 items-center rounded-full border border-[rgba(58,48,38,0.14)] bg-[#2b2723] px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-white transition-opacity hover:opacity-90"
          >
            Begin the Conversation
          </ConsultationCtaLink>
        </CTAGlimmer>
      </div>
    </RevealOnScroll>
  );
}

export default function OurApproachPageClient() {
  const [chapter01, chapter02, chapter03, chapter04] = APPROACH_CHAPTERS;

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a] [background:radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_36rem),linear-gradient(180deg,#efe8de,#ebe3d8)]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />

        <section className="border-b border-[#e4dbcf] pb-16 pt-14 md:pb-[100px] md:pt-[80px]">
          <div className="mx-auto max-w-[820px] text-center">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
              Our Approach
            </p>
            <h1
              className="mx-auto mt-4 max-w-[20ch] text-[2rem] font-light leading-[1.08] tracking-[-0.015em] text-[#1f1d1a] md:text-[2.45rem]"
              style={{ textWrap: "balance" }}
            >
              Why We Work This Way
            </h1>
            <p className="mx-auto mt-5 max-w-[42rem] text-[0.95rem] leading-[1.85] text-[#615a53] md:mt-6 md:text-[1rem] md:leading-[1.9]">
              A thoughtful look at how we evaluate diamonds, make
              recommendations, and guide clients through one of life&apos;s most
              meaningful purchases.
            </p>
          </div>
        </section>

        <RevealOnScroll
          as="section"
          className="border-b border-[#e4dbcf] py-16 md:pb-[96px] md:pt-[112px]"
        >
          <div className="mx-auto max-w-[760px] text-center">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#6d655e]">
              Our Perspective
            </p>
            <h2
              className="mx-auto mt-4 max-w-[28ch] font-serif text-[1.45rem] font-normal leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.85rem]"
              style={{ textWrap: "balance" }}
            >
              The Hourglass Perspective
            </h2>
            <div className="mx-auto mt-6 max-w-[42rem] text-[1rem] leading-[1.9] text-[#615a53]">
              <p>
                We are extremely selective about what we recommend, but not
                about who we help.
              </p>
              <p className="mt-5">
                Every client brings a different set of priorities, preferences,
                timelines, and budgets. Our role is not to decide whether
                someone is &ldquo;qualified&rdquo; to work with us. Our role is
                to help you understand your options, avoid costly mistakes, and
                make the most informed decision possible. Whether you ultimately
                choose a diamond through Hourglass or not, we&apos;re happy to
                help you navigate the process with confidence.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        <section className="py-16 md:py-[88px]">
          <div className={`${DI_V3_SECTIONS} !mt-0 !gap-5 md:!gap-6`}>
            <ApproachChapter chapter={chapter01} />
            <ApproachChapter chapter={chapter02} />
          </div>

          <div className="mt-10 md:mt-12">
            <MidPageCta />
          </div>

          <div className={`${DI_V3_SECTIONS} !mt-10 !gap-5 md:!mt-12 md:!gap-6`}>
            <ApproachChapter chapter={chapter03} />
            <ApproachChapter chapter={chapter04} />
          </div>
        </section>

        <section className="border-t border-[#e4dbcf] py-20 md:py-[112px]">
          <FinalCta />
        </section>
      </div>
    </div>
  );
}
