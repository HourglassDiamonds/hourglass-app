"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const articleGroups = [
  {
    title: "Understanding Color",
    articles: [
      {
        title: "What is Diamond Color",
        href: "/diamond-guide/diamond-color/what-is-diamond-color",
      },
      {
        title: "Diamond Color Chart Explained",
        href: "/diamond-guide/diamond-color/diamond-color-chart-explained",
      },
      {
        title: "Near Colorless Diamonds Explained",
        href: "/diamond-guide/diamond-color/near-colorless-diamonds-explained",
      },
    ],
  },
  {
    title: "Common Comparisons",
    articles: [
      {
        title: "D vs E vs F Diamond Color",
        href: "/diamond-guide/diamond-color/d-vs-e-vs-f-diamond-color",
      },
      {
        title: "G vs H Diamond Color",
        href: "/diamond-guide/diamond-color/g-vs-h-diamond-color",
      },
      {
        title: "Diamond Color vs Clarity",
        href: "/diamond-guide/diamond-color/diamond-color-vs-clarity",
      },
    ],
  },
  {
    title: "Practical Decisions",
    articles: [
      {
        title: "Best Diamond Color for Engagement Ring",
        href: "/diamond-guide/diamond-color/best-diamond-color-for-engagement-ring",
      },
      {
        title: "Does Diamond Color Matter",
        href: "/diamond-guide/diamond-color/does-diamond-color-matter",
      },
      {
        title: "Can You See Diamond Color",
        href: "/diamond-guide/diamond-color/can-you-see-diamond-color",
      },
      {
        title: "Are Colorless Diamonds Worth It",
        href: "/diamond-guide/diamond-color/are-colorless-diamonds-worth-it",
      },
    ],
  },
];

export default function DiamondColorAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Color
            </div>

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              All diamond color guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering how color is graded, where it becomes visible,
              and how to balance appearance with value more thoughtfully.
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
              Color often becomes simpler once you see where it actually changes the way a diamond feels,
              and where it simply becomes preference.
            </p>

            <div className="mt-8">
              <Link
                href="/concierge"
                className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
                onClick={() => trackConsultationCtaClicked("diamond_guide:diamond_color_all")}
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