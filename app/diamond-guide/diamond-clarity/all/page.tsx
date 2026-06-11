"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";
import CTAGlimmer from "../../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../../shared-components/motion/RevealOnScroll";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const articleGroups = [
  {
    title: "Understanding Clarity",
    articles: [
      {
        title: "What is Diamond Clarity",
        href: "/diamond-guide/diamond-clarity/what-is-diamond-clarity",
      },
      {
        title: "Diamond Clarity Chart Explained",
        href: "/diamond-guide/diamond-clarity/diamond-clarity-chart-explained",
      },
      {
        title: "What Are Diamond Inclusions",
        href: "/diamond-guide/diamond-clarity/what-are-diamond-inclusions",
      },
    ],
  },
  {
    title: "What You Can Actually See",
    articles: [
      {
        title: "Eye Clean Diamonds Explained",
        href: "/diamond-guide/diamond-clarity/eye-clean-diamonds-explained",
      },
      {
        title: "Can You See Diamond Inclusions",
        href: "/diamond-guide/diamond-clarity/can-you-see-diamond-inclusions",
      },
      {
        title: "Diamond Blemishes vs Inclusions",
        href: "/diamond-guide/diamond-clarity/diamond-blemishes-vs-inclusions",
      },
    ],
  },
  {
    title: "Making Practical Decisions",
    articles: [
      {
        title: "VS1 vs VS2 Diamond Clarity",
        href: "/diamond-guide/diamond-clarity/vs1-vs-vs2-diamond-clarity",
      },
      {
        title: "What is SI1 Diamond Clarity",
        href: "/diamond-guide/diamond-clarity/what-is-si1-diamond-clarity",
      },
      {
        title: "Best Diamond Clarity for Engagement Rings",
        href: "/diamond-guide/diamond-clarity/best-diamond-clarity-for-engagement-rings",
      },
      {
        title: "Are Flawless Diamonds Worth It",
        href: "/diamond-guide/diamond-clarity/are-flawless-diamonds-worth-it",
      },
    ],
  },
];

export default function DiamondClarityAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Clarity
            </div>

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              All diamond clarity guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering clarity grades, inclusions, what
              is actually visible, and how to balance clarity without
              over-prioritizing it.
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
              Clarity tends to feel simpler once you separate what is visible in
              real life from what is mostly visible only on paper.
            </p>

            <div className="mt-8">
              <CTAGlimmer>

                <Link
                href="/concierge"
                className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
                onClick={() => trackConsultationCtaClicked("diamond_guide:diamond_clarity_all")}
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