"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const beginHereGuides = [
  {
    title: "What is Diamond Brilliance",
    href: "/diamond-guide/what-is-diamond-brilliance",
    description:
      "A clear starting point for understanding the bright white light people notice first.",
  },
  {
    title: "Diamond Fire Explained",
    href: "/diamond-guide/diamond-fire-explained",
    description:
      "How flashes of colored light appear, and why they feel different from brightness alone.",
  },
  {
    title: "What is Diamond Scintillation",
    href: "/diamond-guide/what-is-diamond-scintillation",
    description:
      "The movement and contrast that make a diamond feel alive once it begins to move.",
  },
];

const mostReadGuides = [
  {
    title: "Diamond Light Return Explained",
    href: "/diamond-guide/diamond-light-return-explained",
    description:
      "How light enters and returns through a diamond, and why that changes what you see.",
  },
  {
    title: "How Diamond Cut Affects Light Performance",
    href: "/diamond-guide/how-diamond-cut-affects-light-performance",
    description:
      "Why proportions and cut quality have such a strong influence on brightness and life.",
  },
  {
    title: "Diamond Sparkle Explained",
    href: "/diamond-guide/diamond-sparkle-explained",
    description:
      "A more practical way to think about sparkle beyond general marketing language.",
  },
  {
    title: "How Lighting Affects Diamonds",
    href: "/diamond-guide/how-lighting-affects-diamonds",
    description:
      "Why the same diamond can feel different in daylight, soft indoor light, or direct spot lighting.",
  },
];

const articleGroups = [
  {
    title: "The Basics of Light",
    description:
      "The core ideas behind brightness, fire, and movement, and how they work together.",
    articles: [
      {
        title: "What is Diamond Brilliance",
        href: "/diamond-guide/what-is-diamond-brilliance",
      },
      {
        title: "Diamond Fire Explained",
        href: "/diamond-guide/diamond-fire-explained",
      },
      {
        title: "What is Diamond Scintillation",
        href: "/diamond-guide/what-is-diamond-scintillation",
      },
    ],
  },
  {
    title: "How Light Moves Through a Diamond",
    description:
      "How return, leakage, and contrast patterns shape the way a diamond is perceived.",
    articles: [
      {
        title: "Diamond Light Return Explained",
        href: "/diamond-guide/diamond-light-return-explained",
      },
      {
        title: "Diamond Light Leakage Explained",
        href: "/diamond-guide/diamond-light-leakage-explained",
      },
      {
        title: "Diamond Contrast Patterns Explained",
        href: "/diamond-guide/diamond-contrast-patterns-explained",
      },
    ],
  },
  {
    title: "What You Actually Notice",
    description:
      "How cut and lighting conditions influence what a diamond feels like once worn.",
    articles: [
      {
        title: "How Diamond Cut Affects Light Performance",
        href: "/diamond-guide/how-diamond-cut-affects-light-performance",
      },
      {
        title: "Diamond Sparkle Explained",
        href: "/diamond-guide/diamond-sparkle-explained",
      },
      {
        title: "How Lighting Affects Diamonds",
        href: "/diamond-guide/how-lighting-affects-diamonds",
      },
      {
        title: "Best Light Performance in Diamonds",
        href: "/diamond-guide/best-light-performance-in-diamonds",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description:
      "How cut determines the way a diamond handles light in the first place.",
  },
  {
    title: "Diamond Shapes",
    href: "/diamond-guide/diamond-shapes",
    description:
      "How different shapes carry brightness, fire, and contrast in noticeably different ways.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide",
    description:
      "How to think about visual performance in a practical way when comparing options.",
  },
];

export default function LightPerformancePage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[84px] pt-[82px] md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Light Performance
            </div>

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              Light is what gives a diamond its life.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Much of what people respond to in a diamond comes back to light.
              Brightness, fire, contrast, and movement all shape the way a stone
              feels once worn, which is why two diamonds can appear very
              different even before color or clarity become part of the
              conversation.
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
              Once the basics are clear, the next step is usually comparing how
              a diamond performs in person, not simply how it sounds on paper.
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
                onClick={() => trackConsultationCtaClicked("diamond_guide:light_performance")}
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