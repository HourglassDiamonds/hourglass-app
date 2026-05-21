"use client";

import React from "react";
import Link from "next/link";
import Header from "../../../shared-components/Header";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const articleGroups = [
  {
    title: "Understanding Certification",
    articles: [
      {
        title: "What is a Diamond Certificate",
        href: "/diamond-guide/certification/what-is-a-diamond-certificate",
      },
      {
        title: "Why Diamond Certification Matters",
        href: "/diamond-guide/certification/why-diamond-certification-matters",
      },
      {
        title: "What is a Diamond Report Number",
        href: "/diamond-guide/certification/what-is-a-diamond-report-number",
      },
    ],
  },
  {
    title: "Comparing Laboratories",
    articles: [
      {
        title: "GIA Diamond Certification Explained",
        href: "/diamond-guide/certification/gia-diamond-certification-explained",
      },
      {
        title: "IGI Diamond Certification Explained",
        href: "/diamond-guide/certification/igi-diamond-certification-explained",
      },
      {
        title: "AGS Diamond Certification Explained",
        href: "/diamond-guide/certification/ags-diamond-certification-explained",
      },
      {
        title: "HRD Diamond Certification Explained",
        href: "/diamond-guide/certification/hrd-diamond-certification-explained",
      },
    ],
  },
  {
    title: "Reading Reports Practically",
    articles: [
      {
        title: "How to Read a Diamond Certificate",
        href: "/diamond-guide/certification/how-to-read-a-diamond-certificate",
      },
      {
        title: "Are All Diamond Certificates the Same",
        href: "/diamond-guide/certification/are-all-diamond-certificates-the-same",
      },
      {
        title: "Do Lab Grown Diamonds Have Certificates",
        href: "/diamond-guide/certification/do-lab-grown-diamonds-have-certificates",
      },
    ],
  },
];

export default function CertificationAllPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[70px] pt-[80px] md:pb-[90px] md:pt-[95px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Certification
            </div>

            <h1 className="mt-5 text-[2.2rem] tracking-[-0.045em] md:text-[3rem]">
              All certification guides.
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.85] text-[#6f675f]">
              A complete set of guides covering grading reports, how to read
              them, how laboratories differ, and how to use certification
              clearly when comparing diamonds.
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
              A grading report is a useful tool, but understanding how to
              interpret it is what makes it valuable in practice.
            </p>

            <div className="mt-8">
              <Link
                href="/concierge"
                className="rounded-full bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white"
                onClick={() => trackConsultationCtaClicked("diamond_guide:certification_all")}
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