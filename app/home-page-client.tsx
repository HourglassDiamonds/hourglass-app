"use client";

import Image from "next/image";
import Link from "next/link";
import HomeStudioPortal from "./home-studio-portal";
import Button from "./shared-components/Button";
import Eyebrow from "./shared-components/Eyebrow";
import Header from "./shared-components/Header";
import CTAGlimmer from "./shared-components/motion/CTAGlimmer";
import RevealOnScroll from "./shared-components/motion/RevealOnScroll";
import WhisperedPraiseLink from "./shared-components/WhisperedPraiseLink";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

const HERO_IMAGE = "/homepage/hero/hgd-hero-3x.png";

/** Shared luxury radius for homepage card-like containers. */
const HOME_CARD_RADIUS = "overflow-hidden rounded-[28px] md:rounded-[32px]";

/** Wide mask fade — dissolves into page bg; ramp confined to copy/image gap. */
const HERO_DESKTOP_MASK =
  "linear-gradient(to right, transparent 0%, transparent 4%, rgba(0,0,0,0.06) 16%, rgba(0,0,0,0.20) 24%, rgba(0,0,0,0.44) 32%, rgba(0,0,0,0.68) 38%, rgba(0,0,0,0.86) 44%, rgba(0,0,0,0.94) 48%, black 54%, black 100%)";

const heroDesktopMaskStyle: React.CSSProperties = {
  WebkitMaskImage: HERO_DESKTOP_MASK,
  maskImage: HERO_DESKTOP_MASK,
  WebkitMaskSize: "155% 100%",
  maskSize: "155% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

/** Mobile — left ~28% dissolves into ivory page bg; right ~72% stays fully crisp. */
const HERO_MOBILE_MASK =
  "linear-gradient(to right, transparent 0%, transparent 6%, rgba(0,0,0,0.10) 11%, rgba(0,0,0,0.28) 16%, rgba(0,0,0,0.52) 20%, rgba(0,0,0,0.76) 24%, black 28%, black 100%)";

const heroMobileMaskStyle: React.CSSProperties = {
  WebkitMaskImage: HERO_MOBILE_MASK,
  maskImage: HERO_MOBILE_MASK,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

const HERO_MOBILE_LEFT_BLEND =
  "linear-gradient(to right, #efe8de 0%, #efe8de 8%, rgba(239,232,222,0.92) 18%, rgba(239,232,222,0.62) 32%, rgba(239,232,222,0.22) 48%, transparent 68%)";

function TrustTransitionStrip() {
  const pillars = [
    {
      title: "Graduate Gemologist",
      description: "Professional expertise that protects your decision.",
    },
    {
      title: "Global Sourcing",
      description:
        "Access to exceptional diamonds without the middle layers.",
    },
    {
      title: "Personal Guidance",
      description: "One dedicated expert from first idea to final ring.",
    },
  ] as const;

  return (
    <RevealOnScroll
      as="section"
      className="py-[36px] md:py-[56px]"
      data-hourglass-home="trust-strip"
    >
      <div className="grid gap-8 md:grid-cols-3 md:items-start md:gap-0">
        {pillars.map((pillar, index) => (
          <div
            key={pillar.title}
            className={`text-center md:px-8 lg:px-10 ${
              index > 0 ? "md:border-l md:border-[#e4dbcf]/70" : ""
            }`}
          >
            <Eyebrow size="xs">{pillar.title}</Eyebrow>
            <p className="mx-auto mt-2.5 max-w-[28ch] text-center text-[0.9rem] leading-[1.78] text-[#615a53] md:mt-3 md:leading-[1.82]">
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
      title: "Antique Oval",
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
      <div className="group flex w-[calc(100vw-3.5rem)] shrink-0 snap-start flex-col sm:w-[46vw] md:w-auto">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <div className={`relative aspect-[3/4] ${HOME_CARD_RADIUS}`}>
            <Image
              src={image}
              alt={`${title} ring`}
              fill
              /* Display widths are ~90vw / 46vw / ~30vw / ~16vw, but sources are
                 landscape cropped via object-cover into 3:4 (~56% of width kept).
                 Overspecify sizes so selected derivatives still have enough
                 pixels after that crop at 2× DPR (mobile needs ~600px slot → 1200w). */
              sizes="(max-width: 639px) 600px, (max-width: 767px) 85vw, (max-width: 1279px) 55vw, 30vw"
              className="object-cover object-[50%_46%] max-md:origin-center max-md:scale-[0.94]"
            />
          </div>
        </a>
        <div className="flex flex-col pt-5 md:pt-6">
          <div className="text-[0.96rem] tracking-[-0.02em] text-[#1f1d1a] md:text-[1rem] xl:text-[0.96rem]">
            {title}
          </div>
          <p className="mt-2.5 text-[10px] uppercase tracking-[0.32em] text-[#8a8176]">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="hg-tap transition-colors duration-300 hover:text-[#5e5852]"
            >
              Explore in Motion
            </a>
          </p>
          {/* Equal meta height only on the dense 6-up desktop row — tablet
              3-up has wider columns, so forced height creates empty air. */}
          <p className="mt-2.5 max-w-[28ch] text-[0.76rem] leading-[1.78] text-[#6a635c] md:max-w-[32ch] md:text-[0.8rem] xl:min-h-[4.75rem] xl:max-w-[22ch] xl:text-[0.76rem]">
            {meta}
          </p>
        </div>
      </div>
    );
  }

  return (
    <RevealOnScroll
      as="section"
      className="border-b border-[#e4dbcf]/60 py-[64px] md:py-[88px] lg:py-[112px]"
      data-hourglass-home="house-designs"
    >
      <div className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between lg:mb-16 lg:gap-8">
        <div className="max-w-xl">
          <Eyebrow>House Designs</Eyebrow>
          <h2 className="mt-4 text-[1.85rem] font-normal leading-[1.12] tracking-[-0.04em] text-[#1f1d1a] md:mt-5 md:text-[2.15rem] lg:text-[2.5rem]">
            Signature directions, followed by more individual expressions.
          </h2>
        </div>
        <Link
          href="/engagement-rings"
          className="hg-tap shrink-0 text-[10px] uppercase tracking-[0.32em] text-[#7a7167] transition-colors duration-300 hover:text-[#2b2723]"
        >
          Explore Some Designs →
        </Link>
      </div>

      {/* Mobile: snap carousel · tablet through large laptop (md–lg): 3-up —
          six columns still crush at 1024 (~157px) · desktop (xl+): 6-up row. */}
      <div className="-mx-6 snap-x snap-mandatory overflow-x-auto scroll-pl-6 scroll-smooth px-6 pb-1 md:mx-0 md:snap-none md:overflow-visible md:scroll-pl-0 md:px-0">
        <div className="flex w-max gap-4 md:grid md:w-full md:grid-cols-3 md:gap-x-5 md:gap-y-12 xl:grid-cols-6 xl:gap-6 xl:gap-y-6">
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
      className="border-b border-[#e4dbcf]/60 py-[56px] md:py-[80px] lg:py-[100px]"
      data-hourglass-home="thoughtful-way"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <Link
          href="/our-approach"
          className="hg-tap text-[11px] uppercase tracking-[0.34em] text-[#8a8177] transition-colors duration-300 hover:text-[#5e5852]"
        >
          Our Approach →
        </Link>

        <h2 className="mt-4 w-full text-[1.85rem] leading-[1.12] tracking-[-0.04em] text-[#1f1d1a] md:mt-5 md:text-[2.25rem] lg:text-[2.65rem]">
          A more thoughtful way to choose something that matters.
        </h2>

        <p className="mt-7 max-w-[38rem] text-[1rem] leading-[1.92] text-[#5f5851]">
          Traditional retail often prioritizes inventory and margin. Online
          platforms prioritize scale and speed. Hourglass is built around a
          calmer path: clear guidance, selective sourcing, and a more personal
          way forward.
        </p>
      </div>

      <div className="mx-auto mt-16 grid w-full max-w-3xl gap-12 text-center md:mt-20 md:grid-cols-3 md:gap-10">
        <div className="mx-auto flex max-w-[15.5rem] flex-col items-center">
          <h3 className="w-full text-[1.08rem] tracking-[-0.02em] text-[#1f1d1a]">
            Personal Guidance
          </h3>
          <p className="mt-3.5 w-full text-[0.92rem] leading-[1.88] text-[#6a635c]">
            One-to-one guidance from a trained gemologist, not a sales floor or
            an algorithm.
          </p>
        </div>

        <div className="mx-auto flex max-w-[15.5rem] flex-col items-center">
          <h3 className="w-full text-[1.08rem] tracking-[-0.02em] text-[#1f1d1a]">
            Selective Sourcing
          </h3>
          <p className="mt-3.5 w-full text-[0.92rem] leading-[1.88] text-[#6a635c]">
            Diamonds chosen individually for beauty and presence, not pulled
            from a mass listing.
          </p>
        </div>

        <div className="mx-auto flex max-w-[15.5rem] flex-col items-center">
          <h3 className="w-full text-[1.08rem] tracking-[-0.02em] text-[#1f1d1a]">
            Designed With Intent
          </h3>
          <p className="mt-3.5 w-full text-[0.92rem] leading-[1.88] text-[#6a635c]">
            Each ring shaped around proportion, comfort, and longevity, not
            pre-set templates.
          </p>
        </div>
      </div>
    </RevealOnScroll>
  );
}

const TESTIMONIAL_HERO_IMAGE = "/homepage/hero/testimonial-hero-1.png";

/** Card mask fade — dissolves image into quote area; mirrors homepage hero treatment. */
const TESTIMONIAL_DESKTOP_MASK =
  "linear-gradient(to right, transparent 0%, transparent 4%, rgba(0,0,0,0.06) 16%, rgba(0,0,0,0.20) 24%, rgba(0,0,0,0.44) 32%, rgba(0,0,0,0.68) 38%, rgba(0,0,0,0.86) 44%, rgba(0,0,0,0.94) 48%, black 54%, black 100%)";

const testimonialDesktopMaskStyle: React.CSSProperties = {
  WebkitMaskImage: TESTIMONIAL_DESKTOP_MASK,
  maskImage: TESTIMONIAL_DESKTOP_MASK,
  WebkitMaskSize: "155% 100%",
  maskSize: "155% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
};

/** Mobile — face/subject stays opaque; soft fade only along lower edge into card bg. */
const TESTIMONIAL_MOBILE_MASK =
  "linear-gradient(to bottom, black 0%, black 84%, rgba(0,0,0,0.82) 90%, rgba(0,0,0,0.48) 95%, rgba(0,0,0,0.14) 98%, transparent 100%)";

const testimonialMobileMaskStyle: React.CSSProperties = {
  WebkitMaskImage: TESTIMONIAL_MOBILE_MASK,
  maskImage: TESTIMONIAL_MOBILE_MASK,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center bottom",
  maskPosition: "center bottom",
};

function TestimonialSection() {
  return (
    <RevealOnScroll
      as="section"
      className="pb-[56px] pt-[56px] md:pb-[80px] md:pt-[88px] lg:pb-[96px] lg:pt-[104px]"
      data-hourglass-home="whispered-praise"
    >
      <div className={`relative mx-auto max-w-[1040px] bg-[#ece4da] ${HOME_CARD_RADIUS}`}>
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={testimonialDesktopMaskStyle}
        >
          <Image
            src={TESTIMONIAL_HERO_IMAGE}
            alt=""
            fill
            quality={95}
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover object-[58%_42%]"
          />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-8 py-10 md:w-[56%] md:px-11 md:py-12 lg:px-14">
          <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
            Whispered Praise
          </div>

          <p className="mt-6 text-[1.35rem] leading-[1.42] tracking-[-0.03em] text-[#1f1d1a] md:mt-8 md:text-[1.6rem] lg:text-[1.72rem]">
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
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-white transition-all duration-500 ease-out hover:-translate-y-[1px] hover:opacity-90"
              onClick={() => trackConsultationCtaClicked("home:testimonial")}
            >
              Begin the Conversation
            </Link>
          </div>
        </div>

        <div
          aria-hidden
          className="relative aspect-[3/2] w-full md:hidden"
          style={testimonialMobileMaskStyle}
        >
          <Image
            src={TESTIMONIAL_HERO_IMAGE}
            alt=""
            fill
            quality={95}
            sizes="100vw"
            className="object-cover object-[72%_14%]"
          />
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] leading-[1.85] tracking-[0.14em] text-[#8a8176]">
        Trusted quietly by clients across the country.{" "}
        <WhisperedPraiseLink
          variant="arrow"
          className="hg-tap text-[10px] font-medium tracking-[0.14em] text-[#6a635c]"
        >
          Whispered Praise →
        </WhisperedPraiseLink>
      </p>
    </RevealOnScroll>
  );
}

export default function HomePageClient() {
  return (
    <div
      className="min-h-screen bg-hg-ivory pb-6 text-hg-ink"
      data-hourglass-home="atmospheric-house-pass"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="px-6 md:px-10">
          <Header currentPage="home" />
        </div>

        <section className="relative overflow-hidden border-b border-[#e4dbcf]/60 bg-[#efe8de] pb-[56px] pt-[36px] md:min-h-[500px] md:pb-[96px] md:pt-[48px] lg:min-h-[520px]">
          <div
            aria-hidden
            className="absolute inset-0 hidden md:block"
            style={heroDesktopMaskStyle}
          >
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[72%_38%] origin-[72%_38%] scale-[0.88] lg:object-[74%_36%] lg:origin-[74%_36%] lg:scale-[0.87]"
            />
          </div>

          <div className="relative z-10 flex min-h-0 flex-col justify-center px-6 md:min-h-[440px] md:px-10 lg:min-h-[500px]">
            <div className="min-w-0 max-w-[440px]">
              <div className="text-[11px] uppercase tracking-[0.34em] text-[#8d8275]">
                Hourglass Diamonds
              </div>

              <h1
                className="mt-3 max-w-[12ch] text-[2rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1f1d1a] min-[390px]:text-[2.25rem] min-[390px]:leading-[1.05] min-[390px]:tracking-[-0.048em] md:mt-4 md:text-[3.15rem]"
                style={{ textWrap: "balance" }}
              >
                Designing a ring should feel different than buying one.
              </h1>

              <p className="mt-4 max-w-[30rem] text-[0.95rem] leading-[1.85] text-[#5e5852] min-[390px]:text-[1rem] min-[390px]:leading-[1.88] md:mt-5 md:leading-[1.9]">
                Most people never get that experience. Hourglass was built
                around something more deliberate: guidance over pressure,
                proportion over inventory, and a process that feels as
                considered as the piece itself.
              </p>

              <div className="mt-6 md:mt-8">
                <CTAGlimmer>
                  <Button
                    variant="secondary"
                    href="/concierge"
                    onClick={() => trackConsultationCtaClicked("home:hero")}
                  >
                    Begin the Conversation
                  </Button>
                </CTAGlimmer>

                <p className="mt-3.5 max-w-[28rem] text-[0.78rem] leading-[1.75] tracking-[0.015em] text-[#8a8176] md:mt-5">
                  Guided by Graduate Gemologist Justin Smith.
                </p>
              </div>
            </div>

            <div className="relative mt-8 aspect-[3/2] w-full min-h-[260px] max-md:overflow-visible max-md:rounded-none md:hidden">
              <div
                className="absolute inset-0 max-md:overflow-visible max-md:rounded-none overflow-hidden rounded-[28px]"
                style={heroMobileMaskStyle}
              >
                <Image
                  src={HERO_IMAGE}
                  alt="Oval bezel pavé engagement ring on travertine"
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover object-[64%_42%] origin-[66%_40%] scale-[0.90]"
                />
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[38%]"
                style={{ background: HERO_MOBILE_LEFT_BLEND }}
              />
            </div>
          </div>
        </section>

        <div className="px-6 md:px-10">
          <TrustTransitionStrip />

          <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[48px] md:py-[72px] lg:py-[96px]">
            <HomeStudioPortal />
          </RevealOnScroll>

          <ClosingValueSection />
          <FeaturedRingSection />
          <TestimonialSection />
        </div>
      </div>
    </div>
  );
}