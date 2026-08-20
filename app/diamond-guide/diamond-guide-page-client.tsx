"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "../shared-components/Header";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../shared-components/motion/RevealOnScroll";
import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import GuideSearch from "./components/GuideSearch";
import {
  BUYING_PATH,
  type CategoryPreview,
  type GuideNavGroup,
  type GuideSearchRecord,
} from "@/lib/diamond-guide/guide-nav";
import { getCategoryConfig } from "@/lib/seo/diamond-guide-metadata";

const BUYING_PATH_SUBJECTS = [
  "Origin",
  "Certification",
  "Cut",
  "Color",
  "Clarity",
  "Size",
  "Shape",
  "Fluorescence",
  "Value",
  "Studio",
] as const;

type DiamondGuidePageClientProps = {
  searchRecords: GuideSearchRecord[];
  categoryPreviews: CategoryPreview[];
};

function categoryEditorialTitle(group: GuideNavGroup) {
  if (group.id === "buying-strategy") return group.title;
  return group.articleCategory;
}

export default function DiamondGuidePageClient({
  searchRecords,
  categoryPreviews,
}: DiamondGuidePageClientProps) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="diamond-guide" />
      </div>

      <section className="border-b border-[#e4dbcf] pb-[64px] pt-[78px] md:pb-[80px] md:pt-[94px]">
        <div className="mx-auto max-w-[720px] px-6 text-center md:px-10">
          <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
            Diamond Guide
          </div>

          <h1
            className="mt-5 font-serif text-[2.2rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1d1b18] md:text-[3rem]"
            style={{ textWrap: "balance" }}
          >
            Clarity, before anything else.
          </h1>

          <p className="mx-auto mt-7 max-w-[620px] text-[1.03rem] leading-[1.9] text-[#6f675f]">
            Choosing a diamond can feel overwhelming at first. This guide
            brings together the details that matter most, from how a diamond
            looks on the hand to how it handles light, so you can move
            forward with clarity and confidence.
          </p>

          <div className="relative z-20 mx-auto mt-10 max-w-[620px] text-left md:mt-12">
            <GuideSearch records={searchRecords} showPopular />
          </div>
        </div>

        <div className="mx-auto mt-12 w-full max-w-[1380px] px-6 md:mt-16 md:px-10">
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/8] md:aspect-[1916/821]">
            <Image
              src="/diamond-guide/guide-hero-top.png"
              alt="A curated library of books on diamonds, gemstones, jewelry, optics, proportion, and design"
              fill
              priority
              sizes="(max-width: 640px) 100vw, (max-width: 1200px) 92vw, 1380px"
              className="object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[7%] bg-gradient-to-b from-[#efe8de]/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[10%] bg-gradient-to-t from-[#efe8de]/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[4%] bg-gradient-to-r from-[#efe8de]/60 to-transparent md:block" />
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[4%] bg-gradient-to-l from-[#efe8de]/60 to-transparent md:block" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <RevealOnScroll
          as="section"
          className="border-b border-[#e4dbcf] pb-[106px] pt-[72px] md:pb-[124px] md:pt-[88px]"
        >
          <div className="max-w-[640px]">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              I’m Buying a Diamond
            </div>
            <h2
              id="buying-path-heading"
              className="mt-5 font-serif text-[2rem] font-normal leading-[1.12] tracking-[-0.04em] text-[#1d1b18] md:text-[2.5rem]"
              style={{ textWrap: "balance" }}
            >
              A calm order to learn in.
            </h2>
            <p className="mt-6 max-w-[540px] text-[0.98rem] leading-[1.85] text-[#6f675f]">
              If you don’t know where to begin, start here. Ten steps, in a
              sensible order — each one an existing guide, or Diamond Studio.
            </p>
          </div>

          <ol className="mt-14 grid gap-0 md:grid-cols-2 md:gap-x-16">
            {BUYING_PATH.map((step, index) => (
              <li
                key={step.href}
                className="border-t border-[#e4dbcf]/90"
              >
                <Link
                  href={step.href}
                  className="group flex min-h-[7.5rem] flex-col py-8 transition-colors duration-300 md:py-10"
                >
                  <span className="font-serif text-[2.35rem] font-light leading-none tracking-[-0.04em] text-[#d2c8bc] md:text-[2.6rem]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-5 text-[10px] uppercase tracking-[0.28em] text-[#8a8279]">
                    {BUYING_PATH_SUBJECTS[index]}
                  </span>
                  <span className="mt-2 font-serif text-[1.28rem] leading-[1.2] tracking-[-0.03em] text-[#1d1b18] transition-colors duration-300 group-hover:text-[#0f0e0d] md:text-[1.38rem]">
                    {step.title}
                  </span>
                  <span className="mt-2.5 max-w-[36ch] text-[0.94rem] leading-[1.7] text-[#6f675f]">
                    {step.note}
                  </span>
                  <span className="mt-5 text-[0.86rem] tracking-[0.04em] text-[#8a8279] transition-colors duration-300 group-hover:text-[#1d1b18]">
                    Explore →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="border-b border-[#e4dbcf] py-[108px] md:py-[128px]"
        >
          <div className="max-w-[640px]">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Browse the Guide
            </div>
            <h2
              id="explore-heading"
              className="mt-5 font-serif text-[2rem] font-normal leading-[1.12] tracking-[-0.04em] text-[#1d1b18] md:text-[2.5rem]"
              style={{ textWrap: "balance" }}
            >
              Explore what matters most.
            </h2>
          </div>

          <div className="mt-16 grid gap-x-16 gap-y-4 md:mt-20 md:grid-cols-2 md:gap-y-6">
            {categoryPreviews.map((section) => {
              const title = categoryEditorialTitle(section.group);
              const description = getCategoryConfig(section.group.id).description;
              const curated = section.articles.slice(0, 3);

              return (
                <section
                  key={section.group.id}
                  className="border-t border-[#e4dbcf] pt-10 md:pt-12"
                >
                  <h3 className="font-serif text-[1.55rem] font-normal leading-[1.15] tracking-[-0.03em] text-[#1d1b18] md:text-[1.7rem]">
                    {title}
                  </h3>
                  <p className="mt-3 max-w-[42ch] text-[0.96rem] leading-[1.75] text-[#6f675f]">
                    {description}
                  </p>
                  <ul className="mt-6">
                    {curated.map((article) => (
                      <li key={article.slug}>
                        <Link
                          href={article.href}
                          className="group flex min-h-11 items-baseline justify-between gap-4 py-2 text-[0.98rem] leading-[1.45] text-[#2f2b27] transition-colors duration-300 hover:text-[#0f0e0d]"
                        >
                          <span>{article.title}</span>
                          <span
                            aria-hidden
                            className="shrink-0 text-[#c4bbb0] transition-colors duration-300 group-hover:text-[#1d1b18]"
                          >
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5">
                    <Link
                      href={section.group.href}
                      className="text-[0.92rem] tracking-[0.01em] text-[#1d1b18] underline decoration-[#d4cbc0] underline-offset-[0.28em] transition-colors duration-300 hover:decoration-[#1d1b18]"
                    >
                      Explore {title} →
                    </Link>
                  </p>
                </section>
              );
            })}
          </div>

          <p className="mt-16">
            <Link
              href="/diamond-guide/all"
              className="text-[0.95rem] text-[#5c534a] underline decoration-[#d4cbc0] underline-offset-[0.28em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
            >
              View the complete index →
            </Link>
          </p>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="py-[108px] md:py-[128px]">
          <div className="max-w-[640px]">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              A More Considered Way to Research
            </div>

            <h2
              className="mt-5 max-w-[13ch] font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1d1b18] md:text-[3rem]"
              style={{ textWrap: "balance" }}
            >
              Guidance that makes the next step feel clear.
            </h2>

            <p className="mt-6 max-w-[620px] text-[1rem] leading-[1.9] text-[#6f675f]">
              The guide is here to make the process clearer before anything is
              chosen. As the library grows, it will work alongside the tools and
              the private consultation experience, helping each decision feel
              simpler, more informed, and easier to move forward with.
            </p>

            <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Link
                href="/diamond-guide/all"
                className="text-[0.95rem] text-[#5c534a] underline decoration-[#d4cbc0] underline-offset-[0.28em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
              >
                Browse the full library →
              </Link>

              <CTAGlimmer>
                <ConsultationCtaLink
                  location="guide_hub:index"
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
