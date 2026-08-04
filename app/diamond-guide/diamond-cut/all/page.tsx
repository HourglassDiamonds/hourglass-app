"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";
import CTAGlimmer from "../../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../../shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";

const articleGroups = [
  {
    title: "Understanding Cut",
    articles: [
      {
        title: "What is Diamond Cut",
        href: "/diamond-guide/what-is-diamond-cut",
      },
      {
        title: "Is Diamond Cut the Most Important",
        href: "/diamond-guide/is-diamond-cut-the-most-important-c",
      },
      {
        title: "What Makes a Diamond Cut Good or Bad",
        href: "/diamond-guide/what-makes-a-diamond-cut-good-or-bad",
      },
    ],
  },
  {
    title: "Grading and Proportions",
    articles: [
      {
        title: "Excellent vs Very Good Diamond Cut",
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

export default function DiamondCutAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Cut
            </div>

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              All diamond cut guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering how cut is graded, how it affects
              light, and how to judge it more clearly in practice.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="py-[80px] md:py-[100px]">
          <div className="space-y-[60px]">
            {articleGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-[1.2rem] tracking-[-0.02em] text-[#1d1b18]">
                  {group.title}
                </h2>

                <div className="mt-6 divide-y divide-[#e7ddd2]">
                  {group.articles.map((article) => (
                    <Link
                      key={article.title}
                      href={article.href}
                      className="flex items-center justify-between py-4 transition hover:opacity-80"
                    >
                      <span className="text-[0.98rem]">{article.title}</span>
                      <span className="text-[#6f675f]">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="pb-[110px] pt-[40px]">
          <div className="mx-auto max-w-[700px] text-center">
            <h2 className="text-[2rem] leading-[1.1] tracking-[-0.045em] md:text-[2.6rem]">
              If you want clarity, we can help.
            </h2>

            <p className="mt-5 leading-[1.8] text-[#6f675f]">
              Cut is often the part that changes what you notice most. Seeing how
              it translates in person is where the picture usually sharpens.
            </p>

            <div className="mt-8">
              <CTAGlimmer>

                <ConsultationCtaLink
                location="guide_hub:diamond_cut_all"
                tool="diamond-guide"
                className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
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