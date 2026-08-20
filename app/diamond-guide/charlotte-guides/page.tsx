import Link from "next/link";
import Header from "../../shared-components/Header";
import CTAGlimmer from "../../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../../shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import CategoryPageBreadcrumbs from "../components/CategoryPageBreadcrumbs";
import CategoryGuideJsonLd from "../components/CategoryGuideJsonLd";
import {
  navGroupForSegment,
  orderedArticlesForSegment,
  toSummary,
} from "@/lib/diamond-guide/guide-architecture";

const RELATED_TOPICS = [
  {
    title: "Buying Strategy",
    href: "/diamond-guide/buying-strategy",
    description: "How to balance quality, design, and budget before you buy.",
  },
  {
    title: "Proposal Planning",
    href: "/diamond-guide/proposal-planning",
    description: "How to prepare, propose, and celebrate with confidence.",
  },
  {
    title: "Certification",
    href: "/diamond-guide/certification",
    description: "How to read grading reports with context.",
  },
];

export default function CharlotteGuidesPage() {
  const group = navGroupForSegment("charlotte-guides");
  const articles = orderedArticlesForSegment("charlotte-guides").map(toSummary);
  const beginHere = articles.slice(0, 3);
  const mostRead = articles.slice(3);

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <CategoryGuideJsonLd segment="charlotte-guides" variant="hub" />
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />

        <section className="border-b border-[#e4dbcf] pb-[84px] pt-[82px] md:pb-[100px] md:pt-[98px]">
          <div className="mx-auto max-w-[760px] text-center">
            <CategoryPageBreadcrumbs segment="charlotte-guides" variant="hub" />

            <h1 className="mt-5 text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1d1b18] md:text-[3.15rem]">
              Buying a diamond in Charlotte, with clearer local context.
            </h1>

            <p className="mx-auto mt-7 max-w-[630px] text-[1.01rem] leading-[1.9] text-[#6f675f]">
              {group?.description} These guides cover independent advice, custom
              rings, size, and shape in this market, so a local purchase feels
              considered rather than rushed.
            </p>
          </div>
        </section>

        <RevealOnScroll
          as="section"
          className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]"
        >
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Begin here
            </div>
            <h2 className="mt-5 text-[2.15rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.5rem]">
              A few essentials.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-3">
            {beginHere.map((guide) => (
              <Link
                key={guide.slug}
                href={guide.href}
                className="rounded-[30px] bg-white/[0.26] p-7 text-left transition duration-300 hover:bg-white/[0.4]"
              >
                <div className="text-[1.04rem] text-[#1d1b18]">{guide.title}</div>
                <p className="mt-4 text-[0.94rem] text-[#6f675f]">
                  {guide.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </RevealOnScroll>

        {mostRead.length > 0 ? (
          <RevealOnScroll
            as="section"
            className="border-b border-[#e4dbcf] py-[96px] md:py-[110px]"
          >
            <div className="mx-auto max-w-[760px] text-center">
              <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
                Also in this guide
              </div>
              <h2 className="mt-5 text-[2.15rem] text-[#1d1b18]">
                Size, shape, and custom work in Charlotte.
              </h2>
            </div>

            <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-2">
              {mostRead.map((guide) => (
                <Link
                  key={guide.slug}
                  href={guide.href}
                  className="rounded-[30px] bg-white/[0.16] p-7"
                >
                  <div className="text-[#1d1b18]">{guide.title}</div>
                  <p className="mt-4 text-[#6f675f]">{guide.excerpt}</p>
                </Link>
              ))}
            </div>
          </RevealOnScroll>
        ) : null}

        <RevealOnScroll
          as="section"
          className="border-b border-[#e4dbcf] py-[104px] md:py-[122px]"
        >
          <div className="mx-auto max-w-[760px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Related topics
            </div>
            <h2 className="mt-5 text-[2.15rem] font-normal leading-[1.1] tracking-[-0.042em] text-[#1d1b18] md:text-[2.5rem]">
              Where this naturally leads.
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-5 md:grid-cols-3">
            {RELATED_TOPICS.map((topic) => (
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

        <RevealOnScroll as="section" className="py-[108px] md:py-[128px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              When the search becomes local
            </div>
            <h2 className="mx-auto mt-5 max-w-[14ch] text-[2.2rem] font-normal leading-[1.04] tracking-[-0.048em] text-[#1d1b18] md:text-[3.05rem]">
              Guidance that makes the next step clearer.
            </h2>
            <p className="mx-auto mt-6 max-w-[600px] text-[1rem] leading-[1.88] text-[#6f675f]">
              Once the local market feels legible, the stone decision is usually
              simpler. We can help you compare options in Charlotte at whatever
              pace suits you.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/diamond-guide/charlotte-guides/all"
                className="rounded-full border border-[#d9cec1] bg-white/58 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-[#6e665e] transition duration-300 hover:bg-white"
              >
                View All Guides
              </Link>
              <CTAGlimmer>
                <ConsultationCtaLink
                  location="guide_hub:charlotte_guides"
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
