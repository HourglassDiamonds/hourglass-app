"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";
import CTAGlimmer from "../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../shared-components/motion/RevealOnScroll";

const beginHereGuides = [
  {
    title: "What is Diamond Clarity",
    href: "/diamond-guide/what-is-diamond-clarity",
    description:
      "A clear explanation of what clarity actually measures, and what it does not.",
  },
  {
    title: "Diamond Clarity Chart Explained",
    href: "/diamond-guide/diamond-clarity-chart-explained",
    description:
      "How the grading scale works, and where differences begin to matter visually.",
  },
  {
    title: "Eye Clean Diamonds Explained",
    href: "/diamond-guide/eye-clean-diamonds-explained",
    description:
      "What people really mean by eye clean, and why it often matters more than the grade itself.",
  },
];

const mostReadGuides = [
  {
    title: "VS1 vs VS2 Diamond Clarity",
    href: "/diamond-guide/vs1-vs-vs2-diamond-clarity",
    description:
      "A common comparison when deciding how much clarity actually matters in practice.",
  },
  {
    title: "What is SI1 Diamond Clarity",
    href: "/diamond-guide/what-is-si1-clarity",
    description:
      "Where inclusions begin to become more noticeable, and how often they do not.",
  },
  {
    title: "Best Diamond Clarity for Engagement Rings",
    href: "/diamond-guide/best-diamond-clarity-for-engagement-rings",
    description:
      "A balanced approach to clarity that avoids overpaying for what is rarely seen.",
  },
  {
    title: "Can You See Diamond Inclusions",
    href: "/diamond-guide/can-you-see-diamond-inclusions",
    description:
      "What is actually visible without magnification, and what tends to be overstated.",
  },
];

const articleGroups = [
  {
    title: "Understanding Clarity",
    description:
      "How clarity is defined, and why the scale often sounds more important than it feels in practice.",
    articles: [
      {
        title: "What is Diamond Clarity",
        href: "/diamond-guide/what-is-diamond-clarity",
      },
      {
        title: "Diamond Clarity Chart Explained",
        href: "/diamond-guide/diamond-clarity-chart-explained",
      },
      {
        title: "Can You See Diamond Inclusions",
        href: "/diamond-guide/can-you-see-diamond-inclusions",
      },
    ],
  },
  {
    title: "What You Can Actually See",
    description:
      "How inclusions appear in real conditions, and where they tend to disappear entirely.",
    articles: [
      {
        title: "Eye Clean Diamonds Explained",
        href: "/diamond-guide/eye-clean-diamonds-explained",
      },
      {
        title: "Can You See Diamond Inclusions",
        href: "/diamond-guide/can-you-see-diamond-inclusions",
      },
      {
        title: "Diamond Blemishes vs Inclusions",
        href: "/diamond-guide/diamond-blemishes-vs-inclusions",
      },
    ],
  },
  {
    title: "Making Practical Decisions",
    description:
      "How to balance clarity with size, cut, and overall appearance without over-prioritizing it.",
    articles: [
      {
        title: "VS1 vs VS2 Diamond Clarity",
        href: "/diamond-guide/vs1-vs-vs2-diamond-clarity",
      },
      {
        title: "What is SI1 Diamond Clarity",
        href: "/diamond-guide/what-is-si1-clarity",
      },
      {
        title: "Best Diamond Clarity for Engagement Rings",
        href: "/diamond-guide/best-diamond-clarity-for-engagement-rings",
      },
      {
        title: "Are Flawless Diamonds Worth It",
        href: "/diamond-guide/are-flawless-diamonds-worth-it",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Color",
    href: "/diamond-guide/diamond-color",
    description:
      "How clarity and color are often weighed together when balancing appearance.",
  },
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description:
      "Why cut often has a greater impact on what you see than clarity alone.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide",
    description:
      "How to prioritize clarity without losing balance across the entire diamond.",
  },
];

export default function DiamondClarityPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[84px] pt-[82px] md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Clarity
            </div>

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              Clarity matters less than it first appears.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Clarity refers to internal characteristics within a diamond, but
              most of them are only visible under magnification. In practice,
              what matters is how a diamond looks to the eye, which is why many
              clarity decisions come down to balance rather than chasing the
              highest grade.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Begin here
            </div>

            <h2 className="mt-5 text-[2.15rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.5rem]">
              A few essentials.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-3">
            {beginHereGuides.map((guide) => (
              <Link
                key={guide.title}
                href={guide.href}
                className="rounded-[30px] bg-white/[0.26] p-7 text-left transition duration-300 hover:bg-white/[0.4]"
              >
                <div className="text-[1.04rem] font-normal leading-[1.24] tracking-[-0.018em] text-[#1d1b18]">
                  {guide.title}
                </div>
                <p className="mt-4 max-w-[28ch] text-[0.94rem] leading-[1.75] text-[#6f675f]">
                  {guide.description}
                </p>
              </Link>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Most read
            </div>

            <h2 className="mt-5 text-[2.15rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.5rem]">
              The questions that come up first.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-2">
            {mostReadGuides.map((guide) => (
              <Link
                key={guide.title}
                href={guide.href}
                className="rounded-[30px] bg-white/[0.16] px-7 py-7 text-left transition duration-300 hover:bg-white/[0.3]"
              >
                <div className="text-[1.06rem] font-normal leading-[1.22] tracking-[-0.02em] text-[#1d1b18]">
                  {guide.title}
                </div>
                <p className="mt-4 max-w-[40ch] text-[0.94rem] leading-[1.75] text-[#6f675f]">
                  {guide.description}
                </p>
              </Link>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Continue exploring
            </div>

            <h2 className="mt-5 text-[2.15rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.5rem]">
              A closer look.
            </h2>
          </div>

          <div className="mx-auto mt-16 max-w-[860px] space-y-8">
            {articleGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-[30px] bg-white/[0.16] px-8 py-8 md:px-9 md:py-9"
              >
                <div className="max-w-[520px]">
                  <h3 className="text-[1.14rem] font-normal tracking-[-0.02em] text-[#1d1b18]">
                    {group.title}
                  </h3>
                  <p className="mt-3 text-[0.94rem] leading-[1.72] text-[#6f675f]">
                    {group.description}
                  </p>
                </div>

                <div className="mt-7 divide-y divide-[#e7ddd2]">
                  {group.articles.map((article) => (
                    <Link
                      key={article.title}
                      href={article.href}
                      className="flex w-full items-center justify-between gap-8 py-5 transition duration-300 hover:opacity-80"
                    >
                      <div className="text-[0.98rem] font-normal leading-[1.5] tracking-[-0.01em] text-[#1d1b18]">
                        {article.title}
                      </div>
                      <span className="text-[#6f675f]">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}