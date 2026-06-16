"use client";

import React from "react";
import Link from "next/link";
import Header from "../../shared-components/Header";
import CTAGlimmer from "../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../shared-components/motion/RevealOnScroll";

const beginHereGuides = [
  {
    title: "What is a Diamond Certificate",
    href: "/diamond-guide/what-is-a-diamond-certificate",
    description:
      "A clear explanation of what a certificate is and what it actually tells you.",
  },
  {
    title: "GIA Diamond Certification Explained",
    href: "/diamond-guide/gia-diamond-certification-explained",
    description:
      "Why GIA is considered the standard and how their grading works.",
  },
  {
    title: "How to Read a Diamond Certificate",
    href: "/diamond-guide/how-to-read-a-diamond-certificate",
    description:
      "How to interpret the details on a report in a practical way.",
  },
];

const mostReadGuides = [
  {
    title: "IGI Diamond Certification Explained",
    href: "/diamond-guide/igi-diamond-certification-explained",
    description:
      "How IGI compares and where it tends to be used most often.",
  },
  {
    title: "AGS Diamond Certification Explained",
    href: "/diamond-guide/ags-diamond-certification-explained",
    description:
      "What made AGS different and how it is viewed today.",
  },
  {
    title: "HRD Diamond Certification Explained",
    href: "/diamond-guide/hrd-diamond-certification-explained",
    description:
      "Where HRD fits globally and when it appears in the market.",
  },
  {
    title: "Do Lab Grown Diamonds Have Certificates",
    href: "/diamond-guide/do-lab-grown-diamonds-have-certificates",
    description:
      "How certification works for lab grown diamonds compared to natural.",
  },
];

const articleGroups = [
  {
    title: "Understanding Certification",
    description:
      "What a diamond certificate represents and why it matters when comparing stones.",
    articles: [
      {
        title: "What is a Diamond Certificate",
        href: "/diamond-guide/what-is-a-diamond-certificate",
      },
      {
        title: "How to Read a Diamond Certificate",
        href: "/diamond-guide/how-to-read-a-diamond-certificate",
      },
      {
        title: "What is a Diamond Report Number",
        href: "/diamond-guide/what-is-a-diamond-report-number",
      },
    ],
  },
  {
    title: "Major Labs",
    description:
      "How different grading labs compare, and why consistency matters more than name alone.",
    articles: [
      {
        title: "GIA Diamond Certification Explained",
        href: "/diamond-guide/gia-diamond-certification-explained",
      },
      {
        title: "IGI Diamond Certification Explained",
        href: "/diamond-guide/igi-diamond-certification-explained",
      },
      {
        title: "AGS Diamond Certification Explained",
        href: "/diamond-guide/ags-diamond-certification-explained",
      },
      {
        title: "HRD Diamond Certification Explained",
        href: "/diamond-guide/hrd-diamond-certification-explained",
      },
    ],
  },
  {
    title: "Practical Considerations",
    description:
      "How certification affects buying decisions, value, and long-term confidence.",
    articles: [
      {
        title: "Do Lab Grown Diamonds Have Certificates",
        href: "/diamond-guide/do-lab-grown-diamonds-have-certificates",
      },
      {
        title: "Why Diamond Certification Matters",
        href: "/diamond-guide/why-diamond-certification-matters",
      },
      {
        title: "Are All Diamond Certificates the Same",
        href: "/diamond-guide/are-all-diamond-certificates-the-same",
      },
      {
        title: "GCAL 8X Diamond Certification Explained",
        href: "/diamond-guide/gcal-8x-diamond-certification-explained",
      },
    ],
  },
];

const relatedTopics = [
  {
    title: "Diamond Cut",
    href: "/diamond-guide/diamond-cut",
    description:
      "How cut grading appears on certificates and influences appearance.",
  },
  {
    title: "Diamond Clarity",
    href: "/diamond-guide/diamond-clarity",
    description:
      "How clarity is documented and how to interpret inclusions on reports.",
  },
  {
    title: "Buying Strategy",
    href: "/diamond-guide/buying-strategy",
    description:
      "How certification fits into the broader decision-making process.",
  },
];

export default function CertificationPage() {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[84px] pt-[82px] md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Diamond Guide / Certification
            </div>

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              A certificate is only as useful as how you read it.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              Diamond certification provides a standardized way to evaluate a
              stone, but understanding what those grades mean in real terms is
              where the value actually comes from.{" "}
              <Link
                href="/diamond-intelligence"
                className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
              >
                Diamond Intelligence
              </Link>{" "}
              can help translate a report into practical insight. For why
              trained judgment still matters beyond the grades, read{" "}
              <Link
                href="/diamond-guide/why-work-with-a-graduate-gemologist"
                className="text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
              >
                Why Work With a Graduate Gemologist?
              </Link>
              . The report remains a tool, not the final decision.
            </p>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
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
                <div className="text-[1.04rem] text-[#1d1b18]">
                  {guide.title}
                </div>
                <p className="mt-4 text-[0.94rem] text-[#6f675f]">
                  {guide.description}
                </p>
              </Link>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#9a9084]">
              Most read
            </div>

            <h2 className="mt-5 text-[2.15rem] text-[#1d1b18]">
              The questions that come up first.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-2">
            {mostReadGuides.map((guide) => (
              <Link key={guide.title} href={guide.href} className="rounded-[30px] bg-white/[0.16] p-7">
                <div className="text-[#1d1b18]">{guide.title}</div>
                <p className="mt-4 text-[#6f675f]">{guide.description}</p>
              </Link>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="py-[96px] md:py-[110px]">
          <div className="mx-auto max-w-[860px] space-y-8">
            {articleGroups.map((group) => (
              <div key={group.title} className="rounded-[30px] bg-white/[0.16] p-8">
                <h3 className="text-[#1d1b18]">{group.title}</h3>
                <p className="mt-3 text-[#6f675f]">{group.description}</p>

                <div className="mt-6 space-y-4">
                  {group.articles.map((article) => (
                    <Link key={article.title} href={article.href} className="block text-[#1d1b18]">
                      {article.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}