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
    title: "What is Diamond Cut",
    href: "/diamond-guide/what-is-diamond-cut",
    description:
      "A clear explanation of what cut actually refers to, and why it matters more than most expect.",
  },
  {
    title: "Excellent vs Very Good Cut",
    href: "/diamond-guide/excellent-vs-very-good-diamond-cut",
    description:
      "Where the real differences show, and when they matter in practice.",
  },
  {
    title: "Ideal Diamond Cut Proportions",
    href: "/diamond-guide/ideal-diamond-cut-proportions",
    description:
      "What proportion ranges actually produce better light performance.",
  },
];

const mostReadGuides = [
  {
    title: "What Makes a Diamond Cut Good or Bad",
    href: "/diamond-guide/what-makes-a-diamond-cut-good-or-bad",
    description:
      "A more practical way to evaluate cut beyond grading labels alone.",
  },
  {
    title: "How Diamond Cut Affects Sparkle",
    href: "/diamond-guide/how-diamond-cut-affects-sparkle",
    description:
      "How proportions and angles determine how a diamond handles light.",
  },
  {
    title: "Does Diamond Cut Affect Size",
    href: "/diamond-guide/does-diamond-cut-affect-size",
    description:
      "Why some diamonds appear larger or smaller despite similar weight.",
  },
  {
    title: "Is Diamond Cut the Most Important",
    href: "/diamond-guide/is-diamond-cut-the-most-important-c",
    description:
      "Where cut fits relative to color, clarity, and overall balance.",
  },
];

const articleGroups = [
  {
    title: "Understanding Cut",
    description:
      "How cut is defined, measured, and why it plays such a central role.",
    articles: [
      {
        title: "What is Diamond Cut",
        href: "/diamond-guide/what-is-diamond-cut",
      },
      {
        title: "Is Diamond Cut the Most Important",
        href: "/diamond-guide/is-diamond-cut-the-most-important-c",
      },
    ],
  },
  {
    title: "Grading and Proportions",
    description:
      "How grading systems work, and what proportion ranges actually matter.",
    articles: [
      {
        title: "Excellent vs Very Good Cut",
        href: "/diamond-guide/excellent-vs-very-good-diamond-cut",
      },
      {
        title: "Ideal Diamond Cut Proportions",
        href: "/diamond-guide/ideal-diamond-cut-proportions",
      },
      {
        title: "Do Fancy Shapes Have Cut Grades",
        href: "/diamond-guide/do-fancy-shape-diamonds-have-cut-grades",
      },
    ],
  },
  {
    title: "Practical Comparisons",
    description:
      "How cut influences appearance, size, and overall visual balance.",
    articles: [
      {
        title: "How Diamond Cut Affects Sparkle",
        href: "/diamond-guide/how-diamond-cut-affects-sparkle",
      },
      {
        title: "Does Diamond Cut Affect Size",
        href: "/diamond-guide/does-diamond-cut-affect-size",
      },
      {
        title: "Diamond Cut vs Diamond Shape",
        href: "/diamond-guide/diamond-cut-vs-diamond-shape",
      },
      {
        title: "Diamond Cut vs Polish vs Symmetry",
        href: "/diamond-guide/diamond-cut-vs-polish-vs-symmetry",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Light Performance",
    href: "/diamond-guide/light-performance",
    description:
      "How cut translates into brilliance, fire, and movement once the diamond is in motion.",
  },
  {
    title: "Diamond Shapes",
    href: "/diamond-guide/diamond-shapes",
    description:
      "How different shapes respond to cut and proportions differently.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide/buying-strategy",
    description:
      "How to prioritize cut without losing balance across the rest of the diamond.",
  },
];

export default function DiamondCutPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <CategoryGuideJsonLd segment="diamond-cut" variant="hub" />
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-16 pt-14 md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <CategoryPageBreadcrumbs segment="diamond-cut" variant="hub" />

            <h1 className="mt-4 text-[1.95rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] min-[390px]:text-[2.25rem] min-[390px]:leading-[1.05] min-[390px]:tracking-[-0.048em] md:mt-5 md:text-[3.15rem]">
              Cut is what brings a diamond to life.
            </h1>

            <p className="mx-auto mt-5 max-w-[630px] text-[0.95rem] leading-[1.85] text-[#6f675f] md:mt-7 md:text-[1.01rem] md:leading-[1.9]">
              Cut determines how a diamond interacts with light, which is why it
              has such a strong influence on what you actually see. Two diamonds
              with similar color and clarity can feel completely different
              depending on how well they are cut.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-16 md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Begin here
            </div>

            <h2 className="mt-4 text-[1.85rem] font-normal leading-[1.12] tracking-[-0.038em] text-[#1d1b18] md:mt-5 md:text-[2.5rem] md:leading-[1.1] md:tracking-[-0.042em]">
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

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-16 md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Most read
            </div>

            <h2 className="mt-4 text-[1.85rem] font-normal leading-[1.12] tracking-[-0.038em] text-[#1d1b18] md:mt-5 md:text-[2.5rem] md:leading-[1.1] md:tracking-[-0.042em]">
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

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-16 md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Continue exploring
            </div>

            <h2 className="mt-4 text-[1.85rem] font-normal leading-[1.12] tracking-[-0.038em] text-[#1d1b18] md:mt-5 md:text-[2.5rem] md:leading-[1.1] md:tracking-[-0.042em]">
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
                      className="flex min-h-11 w-full items-center justify-between gap-8 py-5 transition duration-300 hover:opacity-80"
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

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-20 md:py-[122px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Related topics
            </div>

            <h2 className="mt-4 text-[1.8rem] font-normal leading-[1.12] tracking-[-0.038em] text-[#1d1b18] md:mt-5 md:text-[2.45rem] md:leading-[1.1] md:tracking-[-0.042em]">
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

        <RevealOnScroll as="section" className="py-20 md:py-[128px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              When the research becomes specific
            </div>

            <h2 className="mx-auto mt-4 max-w-[12ch] text-[1.9rem] font-normal leading-[1.08] tracking-[-0.042em] text-[#1d1b18] md:mt-5 md:text-[3.05rem] md:leading-[1.04] md:tracking-[-0.048em]">
              Guidance that makes the next step clearer.
            </h2>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.88] text-[#6f675f]">
              Once the cut conversation becomes clearer, the next step is
              usually about balancing light performance, proportions, size, and
              the overall feel of the diamond in the ring.
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
                location="guide_hub:diamond_cut"
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