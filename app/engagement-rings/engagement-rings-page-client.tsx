"use client";

import React from "react";
import Link from "next/link";
import Header from "../shared-components/Header";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import RevealOnScroll from "../shared-components/motion/RevealOnScroll";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import SectionHeading from "../shared-components/SectionHeading";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";
import { ENGAGEMENT_RINGS_FAQS } from "@/lib/seo/engagement-rings-educational";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

export default function EngagementRingsPageClient() {
  const process = [
    "We begin with a conversation around style, shape, budget, and how the ring will actually be worn.",
    "Diamonds are sourced with clear visual guidance, honest recommendations, and no pressure to choose before it feels right.",
    "The design is refined through proportion, reference imagery, and small adjustments until the direction feels natural.",
    "The finished piece is created, reviewed, and presented with the same care that shaped the process from the start.",
  ];

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="engagement-rings" />

        <section className="border-b border-[#e4dbcf] pb-[58px] pt-[54px] md:pb-[66px] md:pt-[62px]">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              Engagement Rings
            </div>

            <h1
              className="mt-5 text-[2.08rem] font-light leading-[1.06] tracking-[-0.025em] text-[#1f1d1a] md:text-[2.8rem]"
              style={{ textWrap: "balance" }}
            >
              Designed Around You
            </h1>

            <p className="mx-auto mt-6 max-w-[35rem] text-[1rem] leading-[1.85] text-[#625b54]">
              A private, guided process for creating a ring that feels
              considered, balanced, and unmistakably yours. These are just a few visuals to get the wheels turning.
            </p>

            <p className="mx-auto mt-4 max-w-[35rem] text-[0.98rem] leading-[1.9] text-[#6f6b66]">
              For those still refining direction, the{" "}
              <Link href="/diamond-guide" className={editorialLink}>
                Diamond Guide
              </Link>{" "}
              offers a clear foundation, and{" "}
              <Link href="/diamond-guide/buying-strategy" className={editorialLink}>
                Buying Strategy
              </Link>{" "}
              is a sensible place to understand expertise and how guidance should work
              before comparing specific designs.
            </p>

            <p className="mx-auto mt-5 max-w-[36rem] text-[0.96rem] leading-[1.88] text-[#6a635c]">
              Hourglass works with couples across Charlotte, South Charlotte, Waxhaw,
              Weddington, Ballantyne, Matthews, and nearby Union County communities,
              as well as clients nationwide by appointment. The process is private,
              deliberate, and led by a{" "}
              <Link href="/the-house" className={editorialLink}>
                Graduate Gemologist
              </Link>
              , not a sales floor.
            </p>

          </div>
        </section>
      </div>

      <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[72px] md:py-[84px]">
        <div className="mx-auto max-w-[820px] px-6 text-center md:px-10">
          <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
            Private Guidance
          </div>
          <h2
            className="mt-5 text-[1.85rem] font-light leading-[1.1] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.35rem]"
            style={{ textWrap: "balance" }}
          >
            A private jeweler model built for clarity, not urgency.
          </h2>
          <div className="mx-auto mt-8 max-w-[42rem] space-y-5 text-left text-[0.98rem] leading-[1.88] text-[#5f5851] md:text-[1rem] md:leading-[1.9]">
            <p>
              Most engagement ring shopping still begins in a case or a cart.
              That can work when you already know what you want. It becomes
              harder when you are comparing grades, shapes, and settings for the
              first time, or when two stones look similar on paper but different
              in person.
            </p>
            <p>
              Hourglass is structured differently. There is no showroom floor to
              browse and no pressure to choose from what is already on hand.
              Diamonds are sourced for your priorities. Design is refined with
              proportion and wear in mind. Guidance follows{" "}
              <Link href="/our-approach" className={editorialLink}>
                our approach
              </Link>
              : performance and judgment first, letters on a report second.
            </p>
            <p>
              For local context on how to evaluate advisors and jewelers in the
              Charlotte market, the{" "}
              <Link
                href="/diamond-guide/charlotte-diamond-advisor-guide"
                className={editorialLink}
              >
                Charlotte diamond advisor guide
              </Link>{" "}
              is a useful companion to this page.
            </p>
          </div>
        </div>
      </RevealOnScroll>

      <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[72px] md:py-[84px]">
        <div className="px-3 md:px-4 xl:px-6">
          <div className="overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,rgba(255,255,255,0.38),rgba(246,240,232,0.58))] shadow-[0_22px_70px_rgba(48,36,28,0.045)] ring-1 ring-[#e6ddd1]/70">
            <div className="md:hidden">
              <div className="px-6 py-8 text-center">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  Ring Studio
                </div>
                <p className="mx-auto mt-3 max-w-[26rem] text-[0.98rem] leading-[1.75] text-[#5f5851]">
                  Open the Ring Studio in a full-screen view for the best mobile
                  experience.
                </p>
                <a
                  href="/ring-studio/ring-studio-embed.html"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#f6f2eb]"
                >
                  Open Ring Studio
                </a>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[30px] md:block">
            <iframe
              src="/ring-studio/ring-studio-embed.html"
              className="h-[760px] w-full border-0 xl:h-[820px]"
              loading="lazy"
            />
          </div>
        </div>
      </RevealOnScroll>

      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[92px] md:py-[104px]">
          <div className="mx-auto max-w-[820px] text-center">
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              Custom Design Process
            </div>

            <h2
              className="mt-5 text-[1.95rem] font-light leading-[1.09] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.55rem]"
              style={{ textWrap: "balance" }}
            >
              A bespoke process designed to feel calm, clear, and deeply
              personal.
            </h2>

            <p className="mx-auto mt-6 max-w-[43rem] text-[1rem] leading-[1.9] text-[#5f5851] md:text-[1.03rem]">
              Each project moves one step at a time, with enough guidance to
              make the decisions clear and enough room for the piece to become
              personal.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[980px] gap-4 md:grid-cols-2">
            {process.map((step, index) => (
              <div
                key={step}
                className="h-full rounded-[22px] border border-[#e4dbcf] bg-white/58 px-6 py-6 shadow-[0_10px_26px_rgba(48,36,28,0.04)] md:px-7 md:py-7"
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                  Step {index + 1}
                </div>

                <p className="mt-3 text-[0.95rem] leading-[1.75] text-[#5f5851]">
                  {step}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-16 max-w-[42rem] space-y-5 text-left md:mt-20">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
                Diamond Sourcing
              </div>
              <h3
                className="mt-4 font-serif text-[1.35rem] font-normal leading-[1.25] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.5rem]"
                style={{ textWrap: "balance" }}
              >
                Sourced with judgment, not inventory pressure.
              </h3>
            </div>
            <p className="text-[0.98rem] leading-[1.88] text-[#5f5851] md:text-[1rem] md:leading-[1.9]">
              Natural and lab-grown diamonds can both be excellent when cut
              quality and transparency are prioritized. We help you understand
              the tradeoffs, read grading reports with context, and compare
              stones that actually fit your setting and budget. If you are
              weighing origin, our guide to{" "}
              <Link
                href="/diamond-guide/natural-vs-lab-diamonds"
                className={editorialLink}
              >
                natural vs lab diamonds
              </Link>{" "}
              explains the practical differences without hype.
            </p>
            <p className="text-[0.98rem] leading-[1.88] text-[#5f5851] md:text-[1rem] md:leading-[1.9]">
              When you already have a report,{" "}
              <Link href="/diamond-intelligence" className={editorialLink}>
                Diamond Intelligence
              </Link>{" "}
              can help interpret proportions and light performance before you
              buy. To preview size on the hand, the{" "}
              <Link href="/diamond-studio" className={editorialLink}>
                Diamond Size Studio
              </Link>{" "}
              offers a calm way to compare carat, shape, and finger coverage.
              For how to read a certificate line by line, see{" "}
              <Link
                href="/diamond-guide/how-to-read-a-diamond-certificate"
                className={editorialLink}
              >
                how to read a diamond certificate
              </Link>
              .
            </p>
          </div>

          <blockquote className="mx-auto mt-16 max-w-[30rem] border-t border-[#e4dbcf]/60 pt-12 text-center md:mt-20 md:max-w-[32rem] md:pt-14">
            <p
              className="font-serif text-[1.2rem] font-normal leading-[1.42] tracking-[-0.02em] text-[#252220] md:text-[1.32rem] md:leading-[1.38]"
              style={{ textWrap: "balance" }}
            >
              &ldquo;It always felt like I was working with a partner.&rdquo;
            </p>
            <footer className="mt-6">
              <WhisperedPraiseLink
                variant="arrow"
                className="text-[10.5px] tracking-[0.12em]"
              >
                Whispered Praise &rarr;
              </WhisperedPraiseLink>
            </footer>
          </blockquote>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[80px] md:py-[92px]">
          <div className="mx-auto max-w-[42rem]">
            <h2
              className="text-center font-serif text-[1.45rem] font-normal leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.65rem]"
              style={{ textWrap: "balance" }}
            >
              Common questions
            </h2>
            <dl className="mt-10 space-y-9 md:mt-12">
              {ENGAGEMENT_RINGS_FAQS.map(({ question, answer }) => (
                <div key={question}>
                  <dt className="font-serif text-[1.05rem] font-normal leading-[1.35] tracking-[-0.015em] text-[#1f1d1a] md:text-[1.1rem]">
                    {question}
                  </dt>
                  <dd className="mt-2.5 text-[0.96rem] leading-[1.84] text-[#5f5851] md:text-[1rem] md:leading-[1.88]">
                    {answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </RevealOnScroll>

        <RevealOnScroll as="section" className="py-[86px] text-center md:py-[96px]">
          <SectionHeading
            title="A calmer way to begin."
            description="Start with a private conversation. We’ll understand the direction, then shape the right next step together."
          />

          <CTAGlimmer>
            <Link
              href="/concierge"
              className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#f6f2eb]"
              onClick={() => trackConsultationCtaClicked("engagement_rings:footer")}
            >
              Begin the Conversation
            </Link>
          </CTAGlimmer>
        </RevealOnScroll>
      </div>
    </div>
  );
}