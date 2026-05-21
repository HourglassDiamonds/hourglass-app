"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const beginHereGuides = [
  {
    title: "What is Diamond Color",
    href: "/diamond-guide/what-is-diamond-color",
    description:
      "A clear starting point for understanding what color grading actually measures.",
  },
  {
    title: "Diamond Color Chart Explained",
    href: "/diamond-guide/diamond-color-chart-explained",
    description:
      "How the grading scale works, and where the visible differences begin to matter.",
  },
  {
    title: "Best Diamond Color for Engagement Ring",
    href: "/diamond-guide/best-diamond-color-for-engagement-ring",
    description:
      "A practical way to balance appearance, setting style, and overall value.",
  },
];

const mostReadGuides = [
  {
    title: "D vs E vs F Diamond Color",
    href: "/diamond-guide/d-vs-e-vs-f-diamond-color",
    description:
      "How the highest color grades compare once a diamond is actually seen in person.",
  },
  {
    title: "G vs H Diamond Color",
    href: "/diamond-guide/g-vs-h-diamond-color",
    description:
      "One of the most common real-world comparisons when balancing beauty and value.",
  },
  {
    title: "Does Diamond Color Matter",
    href: "/diamond-guide/does-diamond-color-matter",
    description:
      "When color matters more, when it matters less, and what tends to influence that.",
  },
  {
    title: "Near Colorless Diamonds Explained",
    href: "/diamond-guide/near-colorless-diamonds-explained",
    description:
      "Why near colorless often becomes the most balanced place to start.",
  },
];

const articleGroups = [
  {
    title: "Understanding Color",
    description:
      "How color is graded, and why the scale is often discussed more rigidly than it should be.",
    articles: [
      {
        title: "What is Diamond Color",
        href: "/diamond-guide/what-is-diamond-color",
      },
      {
        title: "Diamond Color Chart Explained",
        href: "/diamond-guide/diamond-color-chart-explained",
      },
      {
        title: "Near Colorless Diamonds Explained",
        href: "/diamond-guide/near-colorless-diamonds-explained",
      },
    ],
  },
  {
    title: "Common Comparisons",
    description:
      "The comparisons people usually make first when deciding how much color matters to them.",
    articles: [
      {
        title: "D vs E vs F Diamond Color",
        href: "/diamond-guide/d-vs-e-vs-f-diamond-color",
      },
      {
        title: "G vs H Diamond Color",
        href: "/diamond-guide/g-vs-h-diamond-color",
      },
      {
        title: "Diamond Color vs Clarity",
        href: "/diamond-guide/diamond-color-vs-clarity",
      },
    ],
  },
  {
    title: "Practical Decisions",
    description:
      "How color affects appearance, value, and the way a diamond feels in different settings.",
    articles: [
      {
        title: "Best Diamond Color for Engagement Ring",
        href: "/diamond-guide/best-diamond-color-for-engagement-ring",
      },
      {
        title: "Does Diamond Color Matter",
        href: "/diamond-guide/does-diamond-color-matter",
      },
      {
        title: "Can You See Diamond Color",
        href: "/diamond-guide/can-you-see-diamond-color",
      },
      {
        title: "Are Colorless Diamonds Worth It",
        href: "/diamond-guide/are-colorless-diamonds-worth-it",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Clarity",
    href: "/diamond-guide/diamond-clarity",
    description:
      "How clarity and color are often weighed against one another in real decisions.",
  },
  {
    title: "Diamond Shapes",
    href: "/diamond-guide/diamond-shapes",
    description:
      "How certain shapes tend to reveal color more readily than others.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide",
    description:
      "How to prioritize color in a way that still keeps the overall diamond balanced.",
  },
];

export default function DiamondColorPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[84px] pt-[82px] md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Color
            </div>

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              Color matters differently than most people expect.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Diamond color is often treated as a straight climb toward the top
              of the scale, but in practice the right choice depends on more
              than the grade alone. Shape, setting, size, and personal
              priorities all influence where color becomes noticeable and where
              it simply stops mattering as much.
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
              Once the scale starts to make sense, the next step is usually
              understanding where color actually changes what you see, and where
              it simply becomes a matter of preference.
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
                onClick={() => trackConsultationCtaClicked("diamond_guide:diamond_color")}
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