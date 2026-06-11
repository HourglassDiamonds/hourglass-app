"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";
import CTAGlimmer from "../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../shared-components/motion/RevealOnScroll";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const beginHereGuides = [
  {
    title: "What is a Carat",
    href: "/diamond-guide/what-is-a-carat",
    description:
      "A clear explanation of what carat weight measures, and what it does not.",
  },
  {
    title: "Diamond Size Chart",
    href: "/diamond-guide/diamond-size-chart",
    description:
      "A practical reference for how common carat weights translate into millimeter size.",
  },
  {
    title: "Diamond Size On Hand",
    href: "/diamond-guide/diamond-size-on-hand",
    description:
      "How finger size and shape change the way a diamond appears once worn.",
  },
];

const mostReadGuides = [
  {
    title: "How Big is a 2 Carat Diamond",
    href: "/diamond-guide/how-big-is-a-2-carat-diamond",
    description:
      "One of the most commonly asked size questions, with better visual context.",
  },
  {
    title: "Best Carat Size for Engagement Ring",
    href: "/diamond-guide/best-carat-size-for-an-engagement-ring",
    description:
      "A balanced way to think about size, presence, and everyday wear.",
  },
  {
    title: "Diamond Carat vs Size",
    href: "/diamond-guide/diamond-carat-vs-size",
    description:
      "Why two diamonds with similar weight can still look noticeably different.",
  },
  {
    title: "Do Elongated Diamonds Look Bigger",
    href: "/diamond-guide/do-elongated-diamonds-look-bigger",
    description:
      "How shape affects face up spread and visual presence on the hand.",
  },
];

const articleGroups = [
  {
    title: "Understanding Size",
    description:
      "How size is measured, and why weight alone does not tell the whole story.",
    articles: [
      {
        title: "How Big is a 1 Carat Diamond",
        href: "/diamond-guide/how-big-is-a-1-carat-diamond",
      },
      {
        title: "Diamond Carat vs Size",
        href: "/diamond-guide/diamond-carat-vs-size",
      },
    ],
  },
  {
    title: "On Hand Appearance",
    description:
      "How finger size, shape, and setting influence what a diamond feels like once worn.",
    articles: [
      {
        title: "Diamond Size On Hand",
        href: "/diamond-guide/diamond-size-on-hand",
      },
      {
        title: "Do Elongated Diamonds Look Bigger",
        href: "/diamond-guide/do-elongated-diamonds-look-bigger",
      },
      {
        title: "How to Make a Diamond Look Bigger",
        href: "/diamond-guide/how-to-make-a-diamond-look-bigger",
      },
    ],
  },
  {
    title: "Choosing Size",
    description:
      "How to think about visual balance, proportions, and everyday wear.",
    articles: [
      {
        title: "Best Carat Size for Engagement Ring",
        href: "/diamond-guide/best-carat-size-for-an-engagement-ring",
      },
      {
        title: "How Big is a 2 Carat Diamond",
        href: "/diamond-guide/how-big-is-a-2-carat-diamond",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Shapes",
    href: "/diamond-guide/diamond-shapes",
    description: "How shape influences spread, presence, and overall character.",
  },
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description: "What determines how a diamond comes to life once it moves.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide/buying-strategy",
    description: "How to balance visual impact, design, and budget thoughtfully.",
  },
];

export default function DiamondSizePage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[92px] pt-[82px] md:pb-[112px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Size
            </div>

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              How a diamond actually appears once worn.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Diamond size is often discussed as though carat weight tells the
              whole story. In practice, what you see depends on proportions,
              shape, finger size, and setting, which is why two diamonds of the
              same weight can feel quite different once worn.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[102px] md:py-[118px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Begin here
            </div>

            <h2 className="mt-5 text-[2.05rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.45rem]">
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

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[102px] md:py-[118px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Most read
            </div>

            <h2 className="mt-5 text-[2.05rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.45rem]">
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

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[106px] md:py-[126px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Continue exploring
            </div>

            <h2 className="mt-5 text-[2.05rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.45rem]">
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

                      <span
                        aria-hidden="true"
                        className="shrink-0 text-[1rem] leading-none text-[#8d8378]"
                      >
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[104px] md:py-[122px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Related topics
            </div>

            <h2 className="mt-5 text-[2.05rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.45rem]">
              Where this naturally leads.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-3">
            {relatedTopics.map((topic) => (
              <Link
                key={topic.title}
                href={topic.href}
                className="rounded-[28px] bg-white/[0.28] p-7 text-left transition duration-300 hover:bg-white/[0.42]"
              >
                <div className="text-[1.08rem] font-normal leading-[1.2] tracking-[-0.02em] text-[#1d1b18]">
                  {topic.title}
                </div>

                <p className="mt-3 max-w-[28ch] text-[0.94rem] leading-[1.72] text-[#6f675f]">
                  {topic.description}
                </p>
              </Link>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="py-[108px] md:py-[128px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              When the research becomes specific
            </div>

            <h2 className="mx-auto mt-5 max-w-[12ch] text-[2.2rem] font-normal leading-[1.04] tracking-[-0.048em] text-[#1d1b18] md:text-[3.05rem]">
              Guidance that makes the next step clearer.
            </h2>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.88] text-[#6f675f]">
              Once the broader picture is clear, the next step is usually about
              narrowing what feels right for the hand, the setting, and the
              person wearing it.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/diamond-guide"
                className="rounded-full border border-[#d9cec1] bg-white/58 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-[#6e665e] transition duration-300 hover:bg-white"
              >
                Browse Popular Guides
              </Link>

              <CTAGlimmer>


                <Link
                href="/concierge"
                className="rounded-full border border-[#2b2621] bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white transition duration-300 hover:opacity-90"
                onClick={() => trackConsultationCtaClicked("diamond_guide:diamond_size")}
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