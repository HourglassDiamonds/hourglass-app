"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";

const beginHereGuides = [
  {
    title: "Diamond Buying Tips from Jewelers",
    href: "/diamond-guide/diamond-buying-tips-from-jewelers",
    description:
      "A grounded place to start, with practical advice that helps separate signal from noise.",
  },
  {
    title: "Diamond Price vs Quality",
    href: "/diamond-guide/diamond-price-vs-quality",
    description:
      "How to think about tradeoffs clearly, without assuming more expensive always means better.",
  },
  {
    title: "Natural vs Lab Diamonds",
    href: "/diamond-guide/natural-vs-lab-diamonds",
    description:
      "A balanced look at one of the biggest decisions people face early in the process.",
  },
];

const mostReadGuides = [
  {
    title: "Are Lab Diamonds a Good Choice",
    href: "/diamond-guide/are-lab-diamonds-a-good-choice",
    description:
      "A practical look at when they make sense, and where the tradeoffs begin to matter.",
  },
  {
    title: "When is the Best Time to Buy a Diamond",
    href: "/diamond-guide/when-is-the-best-time-to-buy-a-diamond",
    description:
      "What timing actually affects, and what tends to matter far more than the calendar.",
  },
  {
    title: "Diamond Price vs Quality",
    href: "/diamond-guide/diamond-price-vs-quality",
    description:
      "How to find the point where the diamond still feels strong without paying for what adds very little.",
  },
  {
    title: "Natural vs Lab Diamonds",
    href: "/diamond-guide/natural-vs-lab-diamonds",
    description:
      "The comparison most people make first when trying to balance value, meaning, and long-term priorities.",
  },
];

const articleGroups = [
  {
    title: "Starting the Process",
    description:
      "The first decisions that shape the rest of the search, and how to make them more clearly.",
    articles: [
      {
        title: "Diamond Buying Tips from Jewelers",
        href: "/diamond-guide/diamond-buying-tips-from-jewelers",
      },
      {
        title: "Natural vs Lab Diamonds",
        href: "/diamond-guide/natural-vs-lab-diamonds",
      },
      {
        title: "Are Lab Diamonds a Good Choice",
        href: "/diamond-guide/are-lab-diamonds-a-good-choice",
      },
    ],
  },
  {
    title: "Balancing Value",
    description:
      "How to think about price, visible quality, and the point of diminishing returns.",
    articles: [
      {
        title: "Diamond Price vs Quality",
        href: "/diamond-guide/diamond-price-vs-quality",
      },
      {
        title: "When is the Best Time to Buy a Diamond",
        href: "/diamond-guide/when-is-the-best-time-to-buy-a-diamond",
      },
    ],
  },
  {
    title: "What Matters Most",
    description:
      "How to prioritize the parts of a diamond that truly change what you see and feel.",
    articles: [
      {
        title: "Diamond Price vs Quality",
        href: "/diamond-guide/diamond-price-vs-quality",
      },
      {
        title: "Diamond Buying Tips from Jewelers",
        href: "/diamond-guide/diamond-buying-tips-from-jewelers",
      },
      {
        title: "Natural vs Lab Diamonds",
        href: "/diamond-guide/natural-vs-lab-diamonds",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description:
      "Why cut often has the strongest effect on what you actually notice first.",
  },
  {
    title: "Diamond Color",
    href: "/diamond-guide/diamond-color",
    description:
      "How color becomes one of the main tradeoffs when balancing appearance and value.",
  },
  {
    title: "Certification",
    href: "/diamond-guide/certification",
    description:
      "How a grading report helps frame the decision without replacing judgment entirely.",
  },
];

export default function BuyingStrategyPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide"  />

        <section className="border-b border-[#e4dbcf] pb-[84px] pt-[82px] md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Buying Strategy
            </div>

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              A better decision usually comes from knowing what not to overpay
              for.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Buying well is rarely about maximizing every category at once. It
              is usually about understanding which factors change what you
              actually see, which ones matter more to you personally, and where
              the tradeoffs stop feeling worthwhile.
            </p>
          </div>
        </section>

        <section className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
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
        </section>

        <section className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
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
        </section>

        <section className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
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
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-[1rem] leading-none text-[#6f675f]"
                      >
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-[#e4dbcf] py-[104px] md:py-[122px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Related topics
            </div>

            <h2 className="mt-5 text-[2.15rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.5rem]">
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
        </section>

        <section className="py-[108px] md:py-[128px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              When the research becomes specific
            </div>

            <h2 className="mx-auto mt-5 max-w-[12ch] text-[2.2rem] font-normal leading-[1.04] tracking-[-0.048em] text-[#1d1b18] md:text-[3.05rem]">
              Guidance that makes the next step clearer.
            </h2>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.88] text-[#6f675f]">
              Once the report begins to make sense, the next step is usually
              understanding how much weight to give it, and where a diamond
              still needs to be judged beyond the paper.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/diamond-guide"
                className="rounded-full border border-[#d9cec1] bg-white/58 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-[#6e665e] transition duration-300 hover:bg-white"
              >
                Browse Popular Guides
              </Link>

              <Link
                href="/concierge"
                className="rounded-full border border-[#2b2621] bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white transition duration-300 hover:opacity-90"
              >
                Begin the Conversation
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}