"use client";

import Image from "next/image";
import Link from "next/link";
import HomeStudioPortal from "./home-studio-portal";
import Header from "./shared-components/Header";
import CTAGlimmer from "./shared-components/motion/CTAGlimmer";
import RevealOnScroll from "./shared-components/motion/RevealOnScroll";
import WhisperedPraiseLink from "./shared-components/WhisperedPraiseLink";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

/** Observatory plinth crop — same asset as Diamond Studio portal. */
const HERO_OBSERVATORY_IMAGE = "/homepage/diamond-studio-hero.jpg";

const HERO_OBSERVATORY_GRADIENT = `
  linear-gradient(to right,
    rgba(239,232,222,0.72) 0%,
    rgba(239,232,222,0.34) 14%,
    rgba(239,232,222,0.06) 32%,
    transparent 48%
  ),
  linear-gradient(to bottom,
    rgba(239,232,222,0.42) 0%,
    rgba(239,232,222,0.1) 12%,
    transparent 26%
  ),
  linear-gradient(to left,
    rgba(239,232,222,0.22) 0%,
    transparent 16%
  ),
  linear-gradient(to top,
    rgba(239,232,222,0.96) 0%,
    rgba(239,232,222,0.62) 6%,
    rgba(239,232,222,0.18) 12%,
    transparent 20%
  )
`;

function HeroRingStage() {
  return (
    <div className="relative min-h-[460px] w-[calc(100%+1rem)] md:min-h-[560px] lg:-mr-8 lg:min-h-[620px] lg:w-[calc(100%+2.25rem)]">
      <div className="relative min-h-[inherit] overflow-hidden [mask-image:linear-gradient(to_left,transparent,black_5%,black_92%,transparent),linear-gradient(to_bottom,transparent,black_5%,black_94%,transparent)] [-webkit-mask-image:linear-gradient(to_left,transparent,black_5%,black_92%,transparent),linear-gradient(to_bottom,transparent,black_5%,black_94%,transparent)]">
        <Image
          src={HERO_OBSERVATORY_IMAGE}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 680px"
          priority
          className="object-cover object-[40%_56%] origin-[40%_62%] scale-[1.22] max-md:object-[44%_54%] max-md:scale-[1.18] md:scale-[1.3]"
        />

        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{ background: HERO_OBSERVATORY_GRADIENT }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-[11%] md:pb-[12%]">
        <div
          className="absolute bottom-[8.5%] left-1/2 h-[16px] w-[54%] max-w-[340px] -translate-x-1/2 rounded-[50%] bg-[rgba(38,32,26,0.12)] blur-[16px] md:bottom-[9.5%] md:h-[20px] md:w-[50%]"
          aria-hidden
        />
        <div
          className="absolute bottom-[8%] left-1/2 h-[7px] w-[36%] max-w-[220px] -translate-x-1/2 rounded-[50%] bg-[rgba(32,28,24,0.16)] blur-[6px] md:bottom-[9%]"
          aria-hidden
        />
        <Image
          src="/homepage/hero/homepage-hero-bezel-ring.png"
          alt="Oval bezel pavé engagement ring"
          width={900}
          height={900}
          priority
          className="relative h-auto max-h-[380px] w-auto object-contain drop-shadow-[0_22px_36px_rgba(42,34,28,0.16)] [filter:brightness(0.95)_contrast(1.02)_saturate(0.88)_sepia(0.09)] md:max-h-[510px]"
        />
      </div>
    </div>
  );
}

function TrustTransitionStrip() {
  const pillars = [
    {
      title: "Graduate Gemologist",
      description: "Professional expertise that protects your decision.",
    },
    {
      title: "Global Diamond Sourcing",
      description:
        "Access to the world's best diamonds without the middle layers.",
    },
    {
      title: "Personal Guidance",
      description: "One dedicated expert from first idea to final ring.",
    },
  ] as const;

  return (
    <RevealOnScroll
      as="section"
      className="border-b border-[#e4dbcf]/60 py-[52px] md:py-[60px]"
      data-hourglass-home="trust-strip"
    >
      <div className="grid gap-12 md:grid-cols-3 md:gap-0">
        {pillars.map((pillar, index) => (
          <div
            key={pillar.title}
            className={`text-center md:px-8 lg:px-10 ${
              index > 0 ? "md:border-l md:border-[#e4dbcf]/70" : ""
            }`}
          >
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              {pillar.title}
            </div>
            <p className="mx-auto mt-3.5 max-w-[28ch] text-[0.9rem] leading-[1.82] text-[#615a53] md:mx-0">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>
    </RevealOnScroll>
  );
}

function FeaturedRingSection() {
  const galleryDesigns = [
    {
      title: "Antique Oval Three-Stone",
      meta: "An antique-cut oval framed by step-cut half moons, balancing softness with quiet structure in a two-tone composition.",
      href: "https://gembox.app/s/FxdrPMp29F",
      image: "/rings/antique-oval-3.png",
    },
    {
      title: "Sculptural Marquise",
      meta: "An elongated marquise shaped with sculptural intent, balancing vintage lineage with a more modern, directional presence.",
      href: "https://gembox.app/s/TjcdwamqR8",
      image: "/rings/mq.png",
    },
    {
      title: "Emerald Ring",
      meta: "A large emerald diamond framed by graduated emerald-cut diamonds along the shank, composed with quiet structure and presence.",
      href: "https://gembox.app/s/Y2DyzAZKFL",
      image: "/rings/em-ring.png",
    },
    {
      title: "Dagger & Pearls",
      meta: "A personal motif translated into form, sharp geometry softened by detail and carrying both edge and meaning.",
      href: "https://gembox.app/s/spQVCIRCEs",
      image: "/rings/dagger.png",
    },
    {
      title: "Aviary Bloom",
      meta: "A nature-driven composition where form and symbolism meet, layered, expressive, and quietly distinctive.",
      href: "https://gembox.app/s/dmCewPgmju",
      image: "/rings/aviary.png",
    },
    {
      title: "Sculpted Diamond Band",
      meta: "A continuous line of sculpted form and light, minimal, textural, and quietly expressive.",
      href: "https://gembox.app/s/s5vaECnCJN",
      image: "/rings/sculpt.png",
    },
  ] as const;

  function GalleryDesignCard({
    title,
    meta,
    image,
    href,
  }: {
    title: string;
    meta: string;
    image: string;
    href: string;
  }) {
    return (
      <div className="group w-[72vw] shrink-0 sm:w-[46vw] md:w-auto">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image
              src={image}
              alt={`${title} ring`}
              fill
              sizes="(max-width: 768px) 72vw, 16vw"
              className="object-cover object-[50%_46%]"
            />
          </div>
        </a>
        <div className="pt-5 md:pt-6">
          <div className="text-[0.96rem] tracking-[-0.02em] text-[#1f1d1a]">
            {title}
          </div>
          <p className="mt-2.5 max-w-[22ch] text-[0.76rem] leading-[1.78] text-[#6a635c]">
            {meta}
          </p>
        </div>
      </div>
    );
  }

  return (
    <RevealOnScroll
      as="section"
      className="border-b border-[#e4dbcf]/60 py-[120px] md:py-[140px]"
      data-hourglass-home="house-designs"
    >
      <div className="mb-14 flex flex-col gap-8 md:mb-16 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
            House Designs
          </div>
          <h2 className="mt-5 text-[2rem] font-normal leading-[1.1] tracking-[-0.045em] text-[#1f1d1a] md:text-[2.5rem]">
            Signature directions, followed by more individual expressions.
          </h2>
        </div>
        <Link
          href="/engagement-rings"
          className="shrink-0 text-[10px] uppercase tracking-[0.32em] text-[#7a7167] transition-colors duration-300 hover:text-[#2b2723]"
        >
          Explore All Designs →
        </Link>
      </div>

      <div className="-mx-6 overflow-x-auto px-6 pb-1 md:mx-0 md:overflow-visible md:px-0">
        <div className="flex w-max gap-5 md:grid md:w-full md:grid-cols-6 md:gap-4 lg:gap-6">
          {galleryDesigns.map((design) => (
            <GalleryDesignCard key={design.title} {...design} />
          ))}
        </div>
      </div>
    </RevealOnScroll>
  );
}

function ClosingValueSection() {
  return (
    <RevealOnScroll
      as="section"
      className="border-b border-[#e4dbcf]/60 py-[120px] md:py-[140px]"
      data-hourglass-home="thoughtful-way"
    >
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
          Our Approach
        </div>

        <h2 className="mt-5 text-[2rem] leading-[1.1] tracking-[-0.045em] text-[#1f1d1a] md:text-[2.65rem]">
          A more thoughtful way to choose something that matters.
        </h2>

        <p className="mx-auto mt-7 max-w-[44rem] text-[1rem] leading-[1.92] text-[#5f5851]">
          Traditional retail often prioritizes inventory and margin. Online
          platforms prioritize scale and speed. Hourglass is built around a
          calmer path: clear guidance, selective sourcing, and a more personal
          way forward.
        </p>
      </div>

      <div className="mx-auto mt-20 grid max-w-5xl gap-12 text-center md:mt-24 md:grid-cols-3 md:gap-10">
        <div>
          <h3 className="text-[1.08rem] tracking-[-0.02em] text-[#1f1d1a]">
            Personal Guidance
          </h3>
          <p className="mt-3.5 text-[0.92rem] leading-[1.88] text-[#6a635c]">
            One-to-one guidance from a trained gemologist, not a sales floor or
            an algorithm.
          </p>
        </div>

        <div>
          <h3 className="text-[1.08rem] tracking-[-0.02em] text-[#1f1d1a]">
            Selective Sourcing
          </h3>
          <p className="mt-3.5 text-[0.92rem] leading-[1.88] text-[#6a635c]">
            Diamonds chosen individually for beauty and presence, not pulled
            from a mass listing.
          </p>
        </div>

        <div>
          <h3 className="text-[1.08rem] tracking-[-0.02em] text-[#1f1d1a]">
            Designed With Intent
          </h3>
          <p className="mt-3.5 text-[0.92rem] leading-[1.88] text-[#6a635c]">
            Each ring shaped around proportion, comfort, and longevity, not
            pre-set templates.
          </p>
        </div>
      </div>
    </RevealOnScroll>
  );
}

const WHISPERED_PRAISE_ARCH = "/whispered-praise/whispered-staircase.webp";

function TestimonialSection() {
  return (
    <RevealOnScroll
      as="section"
      className="py-[120px] md:py-[140px]"
      data-hourglass-home="whispered-praise"
    >
      <div className="overflow-hidden rounded-[28px] bg-[#ece4da] md:rounded-[32px]">
        <div className="grid md:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col justify-center px-8 py-14 md:px-11 md:py-[72px] lg:px-14">
            <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
              Whispered Praise
            </div>

            <p className="mt-8 text-[1.45rem] leading-[1.42] tracking-[-0.03em] text-[#1f1d1a] md:text-[1.72rem] lg:text-[1.85rem]">
              “If I could leave 100 stars, I would. The entire process felt
              thoughtful, transparent, and genuinely personal from start to finish.
              Every detail was considered, and nothing ever felt rushed. It’s rare
              to find this level of care.”
            </p>

            <div className="mt-6 text-[10px] uppercase tracking-[0.28em] text-[#7d746a]">
              Google Review · KH, California
            </div>

            <div className="mt-12">
              <Link
                href="/concierge"
                className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-white transition-all duration-500 ease-out hover:-translate-y-[1px] hover:opacity-90"
                onClick={() => trackConsultationCtaClicked("home:testimonial")}
              >
                Begin the Conversation
              </Link>
            </div>
          </div>

          <div className="relative min-h-[240px] md:min-h-[420px]">
            <Image
              src={WHISPERED_PRAISE_ARCH}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 520px"
              className="object-cover object-[58%_42%]"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(236,228,218,0.98)_0%,rgba(236,228,218,0.72)_18%,rgba(236,228,218,0.18)_48%,transparent_72%)] md:bg-[linear-gradient(to_right,rgba(236,228,218,0.98)_0%,rgba(236,228,218,0.55)_22%,rgba(236,228,218,0.08)_52%,transparent_78%)]"
              aria-hidden
            />
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-[10px] leading-[1.85] tracking-[0.14em] text-[#8a8176]">
        Trusted quietly by clients across the country.{" "}
        <WhisperedPraiseLink variant="arrow" className="text-[10px] tracking-[0.14em]">
          Whispered Praise
        </WhisperedPraiseLink>
      </p>
    </RevealOnScroll>
  );
}

export default function HomePageClient() {
  return (
    <main
      className="min-h-screen bg-[#efe8de] text-[#1c1b1a]"
      data-hourglass-home="atmospheric-house-pass"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="home" />

        <section className="border-b border-[#e4dbcf]/60 pb-[112px] pt-[88px] md:pb-[128px] md:pt-[104px]">
          <div className="grid items-center gap-14 lg:grid-cols-[0.98fr_1.02fr] lg:gap-16">
            <div className="min-w-0 max-w-[440px]">
              <div className="text-[11px] uppercase tracking-[0.34em] text-[#8d8275]">
                Hourglass Diamonds
              </div>

              <h1
                className="mt-4 max-w-[12ch] text-[2.25rem] font-normal leading-[1.05] tracking-[-0.048em] text-[#1f1d1a] md:text-[3.15rem]"
                style={{ textWrap: "balance" }}
              >
                Designing a ring should feel different than buying one.
              </h1>

              <p className="mt-5 max-w-[30rem] text-[1rem] leading-[1.9] text-[#5e5852]">
                Most people never get that experience. Hourglass was built
                around something more deliberate: guidance over pressure,
                proportion over inventory, and a process that feels as
                considered as the piece itself.
              </p>

              <div className="mt-8">
                <CTAGlimmer>
                  <Link
                    href="/concierge"
                    className="inline-flex rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-[#2b2723] transition-all duration-500 ease-out hover:-translate-y-[1px] hover:bg-white"
                    onClick={() => trackConsultationCtaClicked("home:hero")}
                  >
                    Begin the Conversation
                  </Link>
                </CTAGlimmer>

                <p className="mt-5 max-w-[28rem] text-[0.78rem] leading-[1.75] tracking-[0.015em] text-[#8a8176]">
                  Guided by Graduate Gemologist Justin Smith.
                </p>
              </div>
            </div>

            <div className="min-w-0 overflow-visible">
              <HeroRingStage />
            </div>
          </div>
        </section>

        <TrustTransitionStrip />

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[92px] md:py-[108px]">
          <HomeStudioPortal />
        </RevealOnScroll>

        <ClosingValueSection />
        <FeaturedRingSection />
        <TestimonialSection />
      </div>
    </main>
  );
}