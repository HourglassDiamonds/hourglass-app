"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";

const articleGroups = [
  {
    title: "Classic Starting Points",
    articles: [
      {
        title: "Round Diamond Guide",
        href: "/diamond-guide/diamond-shapes/round-diamond-guide",
      },
      {
        title: "Oval Diamond Guide",
        href: "/diamond-guide/diamond-shapes/oval-diamond-guide",
      },
      {
        title: "Oval vs Round Diamond",
        href: "/diamond-guide/diamond-shapes/oval-vs-round-diamond",
      },
    ],
  },
  {
    title: "Distinctive Shape Profiles",
    articles: [
      {
        title: "Pear Diamond Guide",
        href: "/diamond-guide/diamond-shapes/pear-diamond-guide",
      },
      {
        title: "Marquise Diamond Guide",
        href: "/diamond-guide/diamond-shapes/marquise-diamond-guide",
      },
      {
        title: "Asscher Diamond Guide",
        href: "/diamond-guide/diamond-shapes/asscher-diamond-guide",
      },
    ],
  },
  {
    title: "Structured and Modern",
    articles: [
      {
        title: "Emerald Diamond Guide",
        href: "/diamond-guide/diamond-shapes/emerald-diamond-guide",
      },
      {
        title: "Radiant Diamond Guide",
        href: "/diamond-guide/diamond-shapes/radiant-diamond-guide",
      },
      {
        title: "Princess Diamond Guide",
        href: "/diamond-guide/diamond-shapes/princess-diamond-guide",
      },
      {
        title: "Cushion Diamond Guide",
        href: "/diamond-guide/diamond-shapes/cushion-diamond-guide",
      },
    ],
  },
];

export default function DiamondShapesAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Diamond Shapes
            </div>

            <h1 className="mt-5 text-[2.2rem] md:text-[3rem] tracking-[-0.045em]">
              All diamond shape guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering the major diamond shapes, how
              they compare, and how their character changes once worn.
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
              Shape often narrows the search faster than people expect. Seeing
              how it fits the hand and setting is where it usually becomes clear.
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