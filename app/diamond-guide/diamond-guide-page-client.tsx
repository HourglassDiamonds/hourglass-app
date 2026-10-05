"use client";

import Image from "next/image";
import Link from "next/link";
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
      </div>

      <section className="pb-0 pt-20 md:pt-28">
        <div className="mx-auto max-w-[700px] px-6 text-center md:px-10">
          <div className="text-[11px] uppercase tracking-[0.36em] text-[#6d655e]">
            Diamond Guide
          </div>

          <h1
            className="mt-5 font-serif text-[2.45rem] font-normal leading-[1.05] tracking-[-0.045em] text-[#1d1b18] md:text-[3.45rem]"
            style={{ textWrap: "balance" }}
          >
            Clarity, before anything else.
          </h1>

          <p className="mx-auto mt-6 max-w-[36rem] text-[1rem] leading-[1.75] text-[#625b54] md:text-[1.04rem]">
            Choosing a diamond can feel overwhelming at first. This guide
            brings together the details that matter most, from how a diamond
            looks on the hand to how it handles light, so you can move forward
            with clarity and confidence.
          </p>

          <div className="relative z-20 mx-auto mt-9 max-w-[560px] text-left md:mt-10">
            <GuideSearch records={searchRecords} showPopular />
          </div>
        </div>

        <div className="mx-auto mt-12 w-full max-w-[1380px] px-4 sm:px-6 md:mt-16 md:px-10">
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/8] md:aspect-[1916/821]">
            <Image
              src="/diamond-guide/guide-hero-top.png"
              alt="A curated library of books on diamonds, gemstones, jewelry, optics, proportion, and design"
              fill
              priority
              sizes="(max-width: 640px) 100vw, (max-width: 1440px) 94vw, 1380px"
              className="object-cover object-center"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <RevealOnScroll as="section" className="pb-24 pt-16 md:pb-32 md:pt-20">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_13rem] md:items-end md:gap-16">
            <div className="max-w-[38rem]">
              <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
                Essential Reading
              </div>
              <h2
                id="buying-path-heading"
                className="mt-4 font-serif text-[2.2rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#1d1b18] md:text-[3rem]"
                style={{ textWrap: "balance" }}
              >
                A calm order to learn in.
              </h2>
              <p className="mt-4 max-w-[34rem] text-[1rem] leading-[1.75] text-[#6f675f]">
                Ten foundational guides to help you understand diamonds with
                confidence.
              </p>
            </div>

            <p className="hidden border-l border-[#cfc3b5] pl-6 font-serif text-[0.96rem] italic leading-[1.55] text-[#756b61] md:block">
              Better questions make for more meaningful choices.
            </p>
          </div>

          <ol className="mt-10 grid border-b border-[#d8cec2] md:mt-12 md:grid-flow-col md:grid-cols-2 md:grid-rows-5 md:gap-x-16 md:border-b-0">
            {BUYING_PATH.map((step, index) => (
              <li key={step.href} className="border-t border-[#d8cec2]">
                <Link
                  href={step.href}
                  className="group grid min-h-[7rem] grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-x-3 py-5 transition-colors duration-300 md:min-h-[7.5rem] md:grid-cols-[3rem_minmax(0,1fr)_2rem]"
                >
                  <span className="self-start pt-1 font-serif text-[1.35rem] leading-none tracking-[-0.02em] text-[#ac8153] md:text-[1.5rem]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-[1.15rem] leading-[1.2] tracking-[-0.02em] text-[#1d1b18] transition-colors duration-300 group-hover:text-[#9a6f42] md:text-[1.25rem]">
                      {step.title}
                    </span>
                    <span className="mt-1.5 block max-w-[42ch] text-[0.86rem] leading-[1.55] text-[#6f675f]">
                      {step.note}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-full border border-[#bdae9d]/55 text-[0.72rem] text-[#998774]/75 transition duration-300 group-hover:border-[#9f8a74]/75 group-hover:text-[#806b55]"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </RevealOnScroll>
      </div>

      <RevealOnScroll
        as="section"
        className="border-y border-[#ddd3c6] bg-[#e4d9cb]"
      >
        <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-28">
          <div className="max-w-[38rem]">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6d655e]">
              Browse the Guide
            </div>
            <h2
              id="explore-heading"
              className="mt-4 font-serif text-[2.2rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#1d1b18] md:text-[3rem]"
              style={{ textWrap: "balance" }}
            >
              Explore what matters most.
            </h2>
            <p className="mt-4 max-w-[35rem] text-[1rem] leading-[1.75] text-[#6f675f]">
              Go deeper with focused resources on the questions clients ask
              about most.
            </p>
          </div>

          <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 md:mt-16 lg:grid-cols-3 lg:gap-x-14 lg:gap-y-14">
            {categoryPreviews.map((section) => {
              const title = categoryEditorialTitle(section.group);
              const description = getCategoryConfig(section.group.id).description;
              const curated = section.articles.slice(0, 3);

              return (
                <section
                  key={section.group.id}
                  className="border-t border-[#cdbfae] pt-6"
                >
                  <h3 className="font-serif text-[1.45rem] font-normal leading-[1.15] tracking-[-0.025em] text-[#1d1b18]">
                    <Link
                      href={section.group.href}
                      className="transition-colors duration-300 hover:text-[#93683e]"
                    >
                      {title}
                    </Link>
                  </h3>
                  <p className="mt-3 max-w-[38ch] text-[0.86rem] leading-[1.65] text-[#6f675f]">
                    {description}
                  </p>
                  <ul className="mt-5">
                    {curated.map((article) => (
                      <li key={article.slug}>
                        <Link
                          href={article.href}
                          className="group flex min-h-10 items-baseline justify-between gap-5 border-b border-[#d2c5b6]/80 py-2.5 text-[0.88rem] leading-[1.4] text-[#615950] transition-colors duration-300 hover:text-[#1d1b18]"
                        >
                          <span>{article.title}</span>
                          <span
                            aria-hidden
                            className="shrink-0 text-[0.78rem] text-[#9c8e7f] opacity-45 transition duration-300 group-hover:opacity-75"
                          >
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    <Link
                      href={section.group.href}
                      className="text-[0.82rem] tracking-[0.01em] text-[#756b61] underline decoration-[#c8b9a8] underline-offset-[0.3em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
                    >
                      Explore {title}{" "}
                      <span
                        aria-hidden
                        className="text-[#9c8e7f] opacity-60 transition-opacity duration-300 group-hover:opacity-90"
                      >
                        →
                      </span>
                    </Link>
                  </p>
                </section>
              );
            })}
          </div>

          <div className="mt-14 grid grid-cols-[minmax(0,1fr)] overflow-hidden border-y border-[#cdbfae]/60 md:mt-16 md:grid-cols-[1.55fr_0.75fr]">
            <div className="relative aspect-[16/9] min-h-[260px] md:aspect-auto">
              <Image
                src="/diamond-guide/how-to-read-a-diamond-certificate-hero.png"
                alt="A diamond grading report reviewed with a loupe and jeweler's tweezers"
                fill
                sizes="(max-width: 768px) 100vw, 760px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-between border-t border-[#cdbfae]/45 bg-[#e4d9cb] p-7 sm:p-8 md:border-t-0 md:p-10 md:pl-11">
              <div className="text-[10px] uppercase tracking-[0.32em] text-[#756b61]">
                Knowledge in practice
              </div>
              <p className="mt-12 max-w-[18rem] font-serif text-[1.55rem] leading-[1.2] tracking-[-0.025em] text-[#28231f] md:mt-24">
                Learn what the report says. Then learn what the diamond shows.
              </p>
            </div>
          </div>

          <p className="mt-10 text-right">
            <Link
              href="/diamond-guide/all"
              className="text-[0.9rem] text-[#5c534a] underline decoration-[#c8b9a8] underline-offset-[0.32em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
            >
              View the complete index →
            </Link>
          </p>
        </div>
      </RevealOnScroll>

      <div className="mx-auto max-w-[1380px] px-4 sm:px-6 md:px-10">
        <RevealOnScroll
          as="section"
          className="grid grid-cols-[minmax(0,1fr)] border-x border-b border-[#ddd3c6] bg-[#f3ede5] md:grid-cols-[0.9fr_1.45fr]"
        >
          <div className="relative aspect-[4/3] min-h-[340px] md:aspect-auto md:min-h-[560px]">
            <Image
              src="/diamond-guide/diamond-cut-hero.png"
              alt="A round diamond beside a jeweler's loupe and tweezers"
              fill
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-cover"
            />
          </div>

          <div className="flex min-w-0 items-center px-7 py-16 sm:px-10 md:px-16 md:py-20 lg:px-20">
            <div className="min-w-0 max-w-[640px]">
              <div className="max-w-[28rem] text-[10px] uppercase leading-[1.7] tracking-[0.25em] text-[#6d655e] sm:text-[11px] sm:tracking-[0.34em]">
                A More Confident Way to Purchase
              </div>

              <h2
                className="mt-5 max-w-[15ch] font-serif text-[2.3rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#1d1b18] md:text-[3.2rem]"
                style={{ textWrap: "balance" }}
              >
                Guidance that makes the next step feel clear.
              </h2>

              <p className="mt-6 max-w-[580px] text-[1rem] leading-[1.8] text-[#6f675f]">
                Whether you’re comparing options, reviewing a certificate, or
                planning a custom design, we’re here to help you make a
                confident, informed decision.
              </p>

              <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <CTAGlimmer>
                  <ConsultationCtaLink
                    location="guide_hub:index"
                    tool="diamond-guide"
                    className="rounded-full border border-[#2b2621] bg-[#2b2621] px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-white transition duration-300 hover:opacity-90"
                  >
                    Begin the Conversation
                  </ConsultationCtaLink>
                </CTAGlimmer>

                <Link
                  href="/diamond-studio"
                  className="text-[0.92rem] text-[#5c534a] underline decoration-[#d4cbc0] underline-offset-[0.28em] transition-colors duration-300 hover:text-[#1d1b18] hover:decoration-[#1d1b18]"
                >
                  Explore Diamond Studio →
                </Link>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
