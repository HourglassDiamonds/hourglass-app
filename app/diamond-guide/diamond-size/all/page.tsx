"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const articleGroups = [
  {
    title: "Understanding Size",
    articles: [
      {
        title: "What is a Carat",
        href: "/diamond-guide/diamond-size/what-is-a-carat",
      },
      {
        title: "Diamond Carat vs Size",
        href: "/diamond-guide/diamond-size/diamond-carat-vs-size",
      },
      {
        title: "Diamond Size Chart",
        href: "/diamond-guide/diamond-size/diamond-size-chart",
      },
    ],
  },
  {
    title: "On Hand Appearance",
    articles: [
      {
        title: "Diamond Size On Hand",
        href: "/diamond-guide/diamond-size/diamond-size-on-hand",
      },
      {
        title: "How Big is a 1 Carat Diamond",
        href: "/diamond-guide/diamond-size/how-big-is-a-1-carat-diamond",
      },
      {
        title: "How Big is a 2 Carat Diamond",
        href: "/diamond-guide/diamond-size/how-big-is-a-2-carat-diamond",
      },
    ],
  },
  {
    title: "Choosing Size",
    articles: [
      {
        title: "Best Carat Size for Engagement Ring",
        href: "/diamond-guide/diamond-size/best-carat-size-for-engagement-ring",
      },
      {
        title: "How to Make a Diamond Look Bigger",
        href: "/diamond-guide/diamond-size/how-to-make-a-diamond-look-bigger",
      },
      {
        title: "Do Elongated Diamonds Look Bigger",
        href: "/diamond-guide/diamond-size/do-elongated-diamonds-look-bigger",
      },
    ],
  },
];

export default function DiamondSizeAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        {/* HERO */}
        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Size
            </div>

            <h1 className="mt-5 text-[2.2rem] md:text-[3rem] tracking-[-0.045em]">
              All diamond size guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering how size is measured, how it
              appears once worn, and how to choose what feels right in
              practice.
            </p>
          </div>
        </section>

        {/* ARTICLE GROUPS */}
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
                      className="flex items-center justify-between py-4 hover:opacity-80 transition"
                    >
                      <span className="text-[0.98rem]">
                        {article.title}
                      </span>
                      <span className="text-[#6f675f]">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-[110px] pt-[40px]">
          <div className="mx-auto max-w-[700px] text-center">
            <h2 className="text-[2rem] md:text-[2.6rem] leading-[1.1] tracking-[-0.045em]">
              If you want clarity, we can help.
            </h2>

            <p className="mt-5 text-[#6f675f] leading-[1.8]">
              Understanding size is one part of the decision. Seeing how it all
              comes together is where things usually become clear.
            </p>

            <div className="mt-8">
              <Link
                href="/concierge"
                className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
                onClick={() => trackConsultationCtaClicked("diamond_guide:diamond_size_all")}
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