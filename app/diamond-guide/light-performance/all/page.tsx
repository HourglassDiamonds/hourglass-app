"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";

const articleGroups = [
  {
    title: "The Basics of Light",
    articles: [
      {
        title: "What is Diamond Brilliance",
        href: "/diamond-guide/light-performance/what-is-diamond-brilliance",
      },
      {
        title: "Diamond Fire Explained",
        href: "/diamond-guide/light-performance/diamond-fire-explained",
      },
      {
        title: "What is Diamond Scintillation",
        href: "/diamond-guide/light-performance/what-is-diamond-scintillation",
      },
    ],
  },
  {
    title: "How Light Moves Through a Diamond",
    articles: [
      {
        title: "Diamond Light Return Explained",
        href: "/diamond-guide/light-performance/diamond-light-return-explained",
      },
      {
        title: "Diamond Light Leakage Explained",
        href: "/diamond-guide/light-performance/diamond-light-leakage-explained",
      },
      {
        title: "Diamond Contrast Patterns Explained",
        href: "/diamond-guide/light-performance/diamond-contrast-patterns-explained",
      },
    ],
  },
  {
    title: "What You Actually Notice",
    articles: [
      {
        title: "How Diamond Cut Affects Light Performance",
        href: "/diamond-guide/light-performance/how-diamond-cut-affects-light-performance",
      },
      {
        title: "Diamond Sparkle Explained",
        href: "/diamond-guide/light-performance/diamond-sparkle-explained",
      },
      {
        title: "How Lighting Affects Diamonds",
        href: "/diamond-guide/light-performance/how-lighting-affects-diamonds",
      },
      {
        title: "Best Light Performance in Diamonds",
        href: "/diamond-guide/light-performance/best-light-performance-in-diamonds",
      },
    ],
  },
];

export default function LightPerformanceAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Light Performance
            </div>

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              All light performance guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering brightness, fire, scintillation,
              light return, and the way performance changes what a diamond feels
              like in person.
            </p>
          </div>
        </section>

        <section className="py-[80px] md:py-[100px]">
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
        </section>

        <section className="pb-[110px] pt-[40px]">
          <div className="mx-auto max-w-[700px] text-center">
            <h2 className="text-[2rem] leading-[1.1] tracking-[-0.045em] md:text-[2.6rem]">
              If you want clarity, we can help.
            </h2>

            <p className="mt-5 leading-[1.8] text-[#6f675f]">
              Light performance is often what people respond to first, even when
              they are not sure how to describe it. Seeing it in person is where
              it usually becomes unmistakable.
            </p>

            <div className="mt-8">
              <Link
                href="/concierge"
                className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
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