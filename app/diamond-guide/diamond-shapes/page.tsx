"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";
import CTAGlimmer from "../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import CategoryPageBreadcrumbs from "../components/CategoryPageBreadcrumbs";
import CategoryGuideJsonLd from "../components/CategoryGuideJsonLd";

const beginHereGuides = [
  {
    title: "Round Diamond Guide",
    href: "/diamond-guide/round-diamond-guide",
    description:
      "A clear starting point for understanding the shape most people know best.",
  },
  {
    title: "Oval Diamond Guide",
    href: "/diamond-guide/oval-diamond-guide",
    description:
      "Why oval diamonds feel elongated, elegant, and often slightly larger face up.",
  },
  {
    title: "Cushion Diamond Guide",
    href: "/diamond-guide/cushion-diamond-guide",
    description:
      "A softer shape with a different kind of presence, depending on its proportions.",
  },
];

const mostReadGuides = [
  {
    title: "Oval vs Round Diamond",
    href: "/diamond-guide/oval-vs-round-diamond",
    description:
      "One of the most common comparisons, especially when deciding between spread and tradition.",
  },
  {
    title: "Pear Diamond Guide",
    href: "/diamond-guide/pear-diamond-guide",
    description:
      "A shape with more personality, and one that changes noticeably with proportions.",
  },
  {
    title: "Emerald Diamond Guide",
    href: "/diamond-guide/emerald-diamond-guide",
    description:
      "A quieter, more architectural shape that shows clarity and proportions differently.",
  },
  {
    title: "Radiant Diamond Guide",
    href: "/diamond-guide/radiant-diamond-guide",
    description:
      "A brighter, more energetic feel with a different balance of outline and sparkle.",
  },
];

const articleGroups = [
  {
    title: "Classic Starting Points",
    description:
      "The shapes people usually compare first when narrowing what feels most natural.",
    articles: [
      {
        title: "Round Diamond Guide",
        href: "/diamond-guide/round-diamond-guide",
      },
      {
        title: "Oval Diamond Guide",
        href: "/diamond-guide/oval-diamond-guide",
      },
      {
        title: "Oval vs Round Diamond",
        href: "/diamond-guide/oval-vs-round-diamond",
      },
    ],
  },
  {
    title: "Distinctive Shape Profiles",
    description:
      "Shapes with more individual character, presence, or silhouette once worn.",
    articles: [
      {
        title: "Pear Diamond Guide",
        href: "/diamond-guide/pear-diamond-guide",
      },
      {
        title: "Marquise Diamond Guide",
        href: "/diamond-guide/marquise-diamond-guide",
      },
      {
        title: "Asscher Diamond Guide",
        href: "/diamond-guide/asscher-diamond-guide",
      },
    ],
  },
  {
    title: "Structured and Modern",
    description:
      "Shapes that feel cleaner, sharper, or more architectural in the way they present.",
    articles: [
      {
        title: "Emerald Diamond Guide",
        href: "/diamond-guide/emerald-diamond-guide",
      },
      {
        title: "Radiant Diamond Guide",
        href: "/diamond-guide/radiant-diamond-guide",
      },
      {
        title: "Princess Diamond Guide",
        href: "/diamond-guide/princess-diamond-guide",
      },
      {
        title: "Cushion Diamond Guide",
        href: "/diamond-guide/cushion-diamond-guide",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Size",
    href: "/diamond-guide/diamond-size",
    description:
      "How shape changes visual spread, finger coverage, and overall presence.",
  },
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description:
      "How each shape handles proportions, light, and overall life differently.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide/buying-strategy",
    description:
      "How to narrow the right shape once style, priorities, and budget come into focus.",
  },
];

export default function DiamondShapesPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <CategoryGuideJsonLd segment="diamond-shapes" variant="hub" />
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[92px] pt-[82px] md:pb-[112px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <CategoryPageBreadcrumbs segment="diamond-shapes" variant="hub" />

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              Shape is where much of a diamond&apos;s character begins.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Shape influences far more than outline alone. It affects the way a
              diamond carries its size, how it handles light, and the overall
              impression it gives once worn — and{" "}
              <Link
                href="/diamond-studio"
                className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
              >
                Diamond Studio
              </Link>{" "}
              makes it easier to compare how different shapes face up before you
              decide.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[102px] md:py-[118px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
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
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Most read
            </div>

            <h2 className="mt-5 text-[2.05rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.45rem]">
              The comparisons people tend to make first.
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
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
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
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
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
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              When the research becomes specific
            </div>

            <h2 className="mx-auto mt-5 max-w-[12ch] text-[2.2rem] font-normal leading-[1.04] tracking-[-0.048em] text-[#1d1b18] md:text-[3.05rem]">
              Guidance that makes the next step clearer.
            </h2>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.88] text-[#6f675f]">
              Once the shape begins to narrow, the next step is usually about
              proportions, setting style, and how the diamond feels on the hand
              rather than in isolation.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/diamond-guide"
                className="rounded-full border border-[#d9cec1] bg-white/58 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-[#6e665e] transition duration-300 hover:bg-white"
              >
                Browse Popular Guides
              </Link>

              <CTAGlimmer>


                <ConsultationCtaLink
                location="guide_hub:diamond_shapes"
                tool="diamond-guide"
                className="rounded-full border border-[#2b2621] bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white transition duration-300 hover:opacity-90"
              >
                Begin the Conversation
              </ConsultationCtaLink>


              </CTAGlimmer>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}