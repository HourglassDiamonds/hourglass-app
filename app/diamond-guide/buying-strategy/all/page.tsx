"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";

const articleGroups = [
  {
    title: "Starting the Process",
    articles: [
      {
        title: "Diamond Buying Tips from Jewelers",
        href: "/diamond-guide/buying-strategy/diamond-buying-tips-from-jewelers",
      },
      {
        title: "Natural vs Lab Diamonds",
        href: "/diamond-guide/buying-strategy/natural-vs-lab-diamonds",
      },
      {
        title: "Are Lab Diamonds a Good Choice",
        href: "/diamond-guide/buying-strategy/are-lab-diamonds-a-good-choice",
      },
    ],
  },
  {
    title: "Balancing Value",
    articles: [
      {
        title: "Diamond Price vs Quality",
        href: "/diamond-guide/buying-strategy/diamond-price-vs-quality",
      },
      {
        title: "When is the Best Time to Buy a Diamond",
        href: "/diamond-guide/buying-strategy/when-is-the-best-time-to-buy-a-diamond",
      },
    ],
  },
  {
    title: "What Matters Most",
    articles: [
      {
        title: "Diamond Price vs Quality",
        href: "/diamond-guide/buying-strategy/diamond-price-vs-quality",
      },
      {
        title: "Diamond Buying Tips from Jewelers",
        href: "/diamond-guide/buying-strategy/diamond-buying-tips-from-jewelers",
      },
      {
        title: "Natural vs Lab Diamonds",
        href: "/diamond-guide/buying-strategy/natural-vs-lab-diamonds",
      },
    ],
  },
];

export default function BuyingStrategyAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Buying Strategy
            </div>

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              All buying strategy guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering how to compare options, balance
              quality with value, and make decisions without overpaying for what
              adds very little in practice.
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
              A better decision usually comes from knowing what matters, what
              does not, and where the tradeoffs stop feeling worthwhile.
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