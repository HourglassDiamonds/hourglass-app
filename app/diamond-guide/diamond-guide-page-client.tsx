"use client";

import React from "react";
import Link from "next/link";
import Header from "../shared-components/Header";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../shared-components/motion/RevealOnScroll";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const categories = [
  {
    title: "Diamond Size",
    description: "How size actually shows up once it’s worn.",
    href: "/diamond-guide/diamond-size",
  },
  {
    title: "Diamond Shapes",
    description: "How shape influences character, light, and feel.",
    href: "/diamond-guide/diamond-shapes",
  },
  {
    title: "Diamond Cut",
    description: "What gives a diamond its life.",
    href: "/diamond-guide/diamond-cut",
  },
  {
    title: "Light Performance",
    description: "Understanding brilliance, fire, and movement.",
    href: "/diamond-guide/light-performance",
  },
  {
    title: "Color",
    description: "When color matters and when it does not.",
    href: "/diamond-guide/diamond-color",
  },
  {
    title: "Clarity",
    description: "What matters, and what usually does not.",
    href: "/diamond-guide/diamond-clarity",
  },
  {
    title: "Certification",
    description: "How to read grading reports with context.",
    href: "/diamond-guide/certification",
  },
  {
    title: "Buying Strategy",
    description: "How to balance quality, design, and budget.",
    href: "/diamond-guide/buying-strategy",
  },
];

const popularGuides = [
  { title: "How Big is a 2 Carat Diamond", href: "/diamond-guide/how-big-is-a-2-carat-diamond" },
  { title: "Oval vs Round Diamond", href: "/diamond-guide/oval-vs-round-diamond" },
  { title: "Diamond Size on Hand", href: "/diamond-guide/diamond-size-on-hand" },
  { title: "What is Diamond Cut", href: "/diamond-guide/what-is-diamond-cut" },
  { title: "Diamond Color vs Clarity", href: "/diamond-guide/diamond-color-vs-clarity" },
  { title: "Natural vs Lab Diamonds", href: "/diamond-guide/natural-vs-lab-diamonds" },
];

const categoryPreview = [
  {
    title: "Diamond Size",
    href: "/diamond-guide/diamond-size",
    description: "Size is about more than carat weight. It’s how it actually wears.",
    articles: [
      { title: "What is a Carat", href: "/diamond-guide/what-is-a-carat" },
      { title: "How Big is a 1 Carat Diamond", href: "/diamond-guide/how-big-is-a-1-carat-diamond" },
      { title: "Diamond Size Chart", href: "/diamond-guide/diamond-size-chart" },
      { title: "Diamond Size on Hand", href: "/diamond-guide/diamond-size-on-hand" },
      { title: "Best Carat Size for Engagement Ring", href: "/diamond-guide/best-carat-size-for-an-engagement-ring" },
    ],
  },
  {
    title: "Diamond Shapes",
    href: "/diamond-guide/diamond-shapes",
    description: "Each shape carries its own presence once worn.",
    articles: [
      { title: "Round Diamond Guide", href: "/diamond-guide/round-diamond-guide" },
      { title: "Oval Diamond Guide", href: "/diamond-guide/oval-diamond-guide" },
      { title: "Emerald Diamond Guide", href: "/diamond-guide/emerald-diamond-guide" },
      { title: "Cushion Diamond Guide", href: "/diamond-guide/cushion-diamond-guide" },
      { title: "Oval vs Round Diamond", href: "/diamond-guide/oval-vs-round-diamond" },
    ],
  },
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description: "Cut is what gives a diamond its life, movement, and presence.",
    articles: [
      { title: "What is Diamond Cut", href: "/diamond-guide/what-is-diamond-cut" },
      { title: "Excellent vs Very Good Cut", href: "/diamond-guide/excellent-vs-very-good-diamond-cut" },
      { title: "Ideal Diamond Cut Proportions", href: "/diamond-guide/ideal-diamond-cut-proportions" },
      { title: "What Makes a Diamond Cut Good or Bad", href: "/diamond-guide/what-makes-a-diamond-cut-good-or-bad" },
      { title: "Is Diamond Cut the Most Important", href: "/diamond-guide/is-diamond-cut-the-most-important-c" },
    ],
  },
  {
    title: "Light Performance",
    href: "/diamond-guide/light-performance",
    description: "Light is where brilliance, fire, and movement come together.",
    articles: [
      { title: "What is Diamond Brilliance", href: "/diamond-guide/what-is-diamond-brilliance" },
      { title: "Diamond Fire Explained", href: "/diamond-guide/diamond-fire-explained" },
      { title: "What is Diamond Scintillation", href: "/diamond-guide/what-is-diamond-scintillation" },
      { title: "Diamond Light Return Explained", href: "/diamond-guide/diamond-light-return-explained" },
      { title: "How Lighting Affects Diamonds", href: "/diamond-guide/how-lighting-affects-diamonds" },
    ],
  },
];

export default function DiamondGuidePageClient() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[96px] pt-[78px] md:pb-[116px] md:pt-[94px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide
            </div>

            <h1
              className="mt-5 text-[2.2rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1d1b18] md:text-[3rem]"
              style={{ textWrap: "balance" }}
            >
              Clarity, before anything else.
            </h1>

            <p className="mx-auto mt-7 max-w-[620px] text-[1.03rem] leading-[1.9] text-[#6f675f]">
              Choosing a diamond can feel overwhelming at first. This guide
              brings together the details that matter most, from how a diamond
              looks on the hand to how it handles light, so you can move
              forward with clarity and confidence.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[106px] md:py-[124px]">
          <div className="mx-auto max-w-[900px]">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <Link
                  key={cat.title}
                  href={cat.href}
                  className="rounded-[28px] bg-white/32 p-7 text-left transition duration-300 hover:bg-white/52"
                >
                  <div className="text-[1.15rem] font-normal leading-[1.2] tracking-[-0.02em] text-[#1d1b18]">
                    {cat.title}
                  </div>

                  <p className="mt-3 max-w-[24ch] text-[0.95rem] leading-[1.75] text-[#6f675f]">
                    {cat.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          id="popular-guides"
          className="border-b border-[#e4dbcf] py-[104px] md:py-[124px]"
        >
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Popular Guides
            </div>

            <h2
              className="mt-5 text-[2rem] font-normal leading-[1.12] tracking-[-0.04em] text-[#1d1b18] md:text-[2.4rem]"
              style={{ textWrap: "balance" }}
            >
              A natural place to start.
            </h2>
          </div>

          <div className="mx-auto mt-12 max-w-[900px]">
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              {popularGuides.map((guide) => (
                <Link
                  key={guide.title}
                  href={guide.href}
                  className="rounded-full border border-[#e2d8cc] bg-[#f7f3ed] px-5 py-3 text-left text-[0.95rem] leading-[1.5] text-[#342f2a] transition duration-300 hover:border-[#d6cabd] hover:bg-white"
                >
                  {guide.title}
                </Link>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[108px] md:py-[128px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Browse the Guide
            </div>

            <h2
              className="mt-5 text-[2rem] font-normal leading-[1.12] tracking-[-0.04em] text-[#1d1b18] md:text-[2.4rem]"
              style={{ textWrap: "balance" }}
            >
              Explore what matters most.
            </h2>
          </div>

          <div className="mx-auto mt-16 max-w-[860px] space-y-10">
            {categoryPreview.map((section) => (
              <div
                key={section.title}
                className="rounded-[30px] bg-white/[0.24] px-7 py-8 transition duration-300 hover:bg-white/[0.32] md:px-9 md:py-9"
              >
                <div className="max-w-[560px]">
                  <h3 className="text-[1.2rem] font-normal tracking-[-0.02em] text-[#1d1b18]">
                    {section.title}
                  </h3>

                  <p className="mt-3 text-[0.96rem] leading-[1.75] text-[#6f675f]">
                    {section.description}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {section.articles.slice(0, 4).map((article) => (
                    <Link
                      key={article.title}
                      href={article.href}
                      className="rounded-full border border-[#e2d8cc] bg-[#f7f3ed] px-4 py-[0.72rem] text-[0.93rem] leading-[1.4] text-[#403a34] transition duration-300 hover:border-[#d6cabd] hover:bg-white"
                    >
                      {article.title}
                    </Link>
                  ))}

                  <Link
                    href={section.href}
                    className="px-2 py-[0.72rem] text-[11px] uppercase tracking-[0.3em] text-[#8d8378] transition duration-300 hover:text-[#5f5851]"
                  >
                    View All →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="py-[108px] md:py-[128px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              A More Considered Way to Research
            </div>

            <h2
              className="mx-auto mt-5 max-w-[13ch] text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1d1b18] md:text-[3rem]"
              style={{ textWrap: "balance" }}
            >
              Guidance that makes the next step feel clear.
            </h2>

            <p className="mx-auto mt-6 max-w-[620px] text-[1rem] leading-[1.9] text-[#6f675f]">
              The guide is here to make the process clearer before anything is
              chosen. As the library grows, it will work alongside the tools and
              the private consultation experience, helping each decision feel
              simpler, more informed, and easier to move forward with.
            </p>


            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="#popular-guides"
                className="rounded-full border border-[#d9cec1] bg-white/65 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-[#6e665e] transition duration-300 hover:bg-white"
              >
                Browse Popular Guides
              </Link>

              <CTAGlimmer>
                <Link
                  href="/concierge"
                  className="rounded-full border border-[#2b2621] bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white transition duration-300 hover:opacity-90"
                  onClick={() => trackConsultationCtaClicked("diamond_guide:index")}
                >
                  Begin the Conversation
                </Link>
              </CTAGlimmer>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}