"use client";

import Image from "next/image";
import Link from "next/link";
import HomeStudioPortal from "./home-studio-portal";
import Header from "./shared-components/Header";
import CTAGlimmer from "./shared-components/motion/CTAGlimmer";
import RevealOnScroll from "./shared-components/motion/RevealOnScroll";
import WhisperedPraiseLink from "./shared-components/WhisperedPraiseLink";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

function HeroRingStage() {
  return (
    <div className="relative flex min-h-[400px] w-full items-center justify-center overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.94),transparent_28%),linear-gradient(145deg,#f4eee6_0%,#efe7dc_52%,#f7f2eb_100%)] shadow-[0_18px_44px_rgba(49,38,29,0.06)] md:min-h-[460px]">
      <div className="pointer-events-none absolute inset-0 rounded-[36px] border border-[#e8dfd4]/60" />
      <div className="pointer-events-none absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_76%_32%,rgba(255,255,255,0.34),transparent_24%),radial-gradient(circle_at_62%_74%,rgba(255,255,255,0.16),transparent_28%)]" />

      <Image
        src="/homepage/hero/homepage-hero-ring.png"
        alt="Oval bezel pavé engagement ring"
        width={900}
        height={900}
        priority
        className="relative z-10 h-auto max-h-[390px] w-auto object-contain md:max-h-[470px]"
      />
    </div>
  );
}

function CredibilityStrip() {
  return (
    <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[28px] md:py-[32px]">
      <div className="grid gap-2 text-center text-[10px] uppercase tracking-[0.34em] text-[#756d64] md:grid-cols-4">
        <div className="opacity-80">GIA Guidance</div>
        <div className="opacity-80">Ethical Sourcing</div>
        <div className="opacity-80">Personal Guidance</div>
        <div className="opacity-80">Ongoing Care</div>
      </div>
      <p className="mt-5 text-center text-[10px] leading-[1.85] tracking-[0.14em] text-[#8a8176]">
        Trusted quietly by clients across the country.{" "}
        <WhisperedPraiseLink variant="arrow" className="text-[10px] tracking-[0.14em]">
          Whispered Praise
        </WhisperedPraiseLink>
      </p>
    </RevealOnScroll>
  );
}

function FeaturedRingSection() {
  const signatureDesigns = [
    {
      title: "Antique Oval Three-Stone",
      meta: "An antique-cut oval framed by step-cut half moons, balancing softness with quiet structure in a two-tone composition.",
      finalLabel: "Completed Piece",
      href: "https://gembox.app/s/FxdrPMp29F",
      image: "/rings/antique-oval-three-stone.png",
    },
    {
      title: "Sculptural Marquise",
      meta: "An elongated marquise shaped with sculptural intent, balancing vintage lineage with a more modern, directional presence.",
      finalLabel: "Completed Piece",
      href: "https://gembox.app/s/TjcdwamqR8",
      image: "/rings/sculptural-marquise.png",
    },
    {
      title: "Emerald Ring",
      meta: "A large emerald diamond framed by graduated emerald-cut diamonds along the shank, composed with quiet structure and presence.",
      finalLabel: "Completed Piece",
      href: "https://gembox.app/s/Y2DyzAZKFL",
      image: "/rings/emerald-ring.png",
    },
  ];

  const atelierDesigns = [
    {
      title: "Dagger & Pearls",
      meta: "A personal motif translated into form, sharp geometry softened by detail and carrying both edge and meaning.",
      finalLabel: "Completed Piece",
      href: "https://gembox.app/s/spQVCIRCEs",
      image: "/rings/dagger-and-pearls.png",
    },
    {
      title: "Aviary Bloom",
      meta: "A nature-driven composition where form and symbolism meet, layered, expressive, and quietly distinctive.",
      finalLabel: "Completed Piece",
      href: "https://gembox.app/s/dmCewPgmju",
      image: "/rings/aviary-bloom.png",
    },
    {
      title: "Sculpted Diamond Band",
      meta: "A continuous line of sculpted form and light, minimal, textural, and quietly expressive.",
      finalLabel: "Completed Piece",
      href: "https://gembox.app/s/s5vaECnCJN",
      image: "/rings/sculpted-diamond-band.png",
    },
  ];

  function DesignCard({
    title,
    meta,
    finalLabel,
    image,
    href,
    featured,
  }: {
    title: string;
    meta: string;
    finalLabel: string;
    image: string;
    href?: string;
    featured?: boolean;
  }) {
    const imageFrame = (
      <div className="overflow-hidden rounded-[20px] border border-[#e4dbcf] bg-[#f3ede4] shadow-[0_6px_18px_rgba(0,0,0,0.03)] transition-all duration-500 ease-out group-hover:-translate-y-[1px] group-hover:border-[#d2c6b4] group-hover:bg-[#fbf7f2]">
        <div
          className={`relative flex items-center justify-center bg-[#f3ede4] ${
            featured ? "aspect-[1.62/1]" : "aspect-[1.72/1]"
          }`}
        >
          <Image
            src={image}
            alt={`${title} ring`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain p-2 scale-110 -translate-y-1"
          />
        </div>
      </div>
    );

    return (
      <div className={`group ${featured ? "md:-translate-y-2" : ""}`}>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left"
          >
            {imageFrame}
          </a>
        ) : (
          <div className="block w-full text-left">{imageFrame}</div>
        )}

        <div className="pt-5 text-center">
          <div className="mx-auto max-w-[24ch] text-[1.02rem] tracking-[-0.02em] text-[#1f1d1a]">
            {title}
          </div>

          <p className="mx-auto mt-2 max-w-[24ch] text-[0.79rem] leading-[1.75] text-[#6a635c]">
            {meta}
          </p>

          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[8.5px] uppercase tracking-[0.32em] text-[#7a7167] transition-colors duration-300 hover:text-[#2b2723]"
            >
              {finalLabel} →
            </a>
          ) : (
            <div className="mt-3 text-[8.5px] uppercase tracking-[0.32em] text-[#8a8178]">
              {finalLabel}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[96px] md:py-[112px]">
      <div className="mx-auto max-w-[760px] text-center">
        <div className="text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
          House Designs
        </div>

        <h2 className="mt-5 text-[2rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#1f1d1a] md:text-[2.75rem]">
          Signature directions, followed by more individual expressions.
        </h2>

        <p className="mx-auto mt-5 max-w-[42rem] text-[1rem] leading-[1.9] text-[#615a53]">
          A refined collection of signature directions and individual atelier
          studies, each shaped around proportion, presence, and meaning.
        </p>
      </div>

      <div className="mt-16">
        <div className="mb-8 text-center">
          <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
            Signature Designs
          </div>
        </div>

        <div className="grid items-start gap-x-6 gap-y-8 md:grid-cols-3">
          {signatureDesigns.map((design, index) => (
            <DesignCard key={design.title} {...design} featured={index === 1} />
          ))}
        </div>
      </div>

      <div className="mt-16">
        <div className="mb-8 text-center">
          <div className="text-[10px] uppercase tracking-[0.34em] text-[#8a8177]">
            Atelier Designs
          </div>
        </div>

        <div className="grid items-start gap-x-6 gap-y-8 md:grid-cols-3">
          {atelierDesigns.map((design, index) => (
            <DesignCard key={design.title} {...design} featured={index === 1} />
          ))}
        </div>
      </div>
    </RevealOnScroll>
  );
}

function ClosingValueSection() {
  return (
    <RevealOnScroll as="section" className="border-b border-[#e8dfd4] py-[96px] md:py-[112px]">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[2rem] leading-[1.12] tracking-[-0.045em] text-[#1f1d1a] md:text-[2.65rem]">
          A more thoughtful way to choose something that matters.
        </h2>

        <p className="mx-auto mt-6 max-w-[46rem] text-[1rem] leading-[1.9] text-[#5f5851]">
          Traditional retail often prioritizes inventory and margin. Online
          platforms prioritize scale and speed. Hourglass is built around a
          calmer path: clear guidance, selective sourcing, and a more personal
          way forward.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-10 text-center md:grid-cols-3">
        <div>
          <h3 className="text-[1.1rem] tracking-[-0.02em]">Personal Guidance</h3>
          <p className="mt-3 text-sm leading-[1.9] text-[#6a635c]">
            One-to-one guidance from a trained gemologist, not a sales floor or
            an algorithm.
          </p>
        </div>

        <div>
          <h3 className="text-[1.1rem] tracking-[-0.02em]">Selective Sourcing</h3>
          <p className="mt-3 text-sm leading-[1.9] text-[#6a635c]">
            Diamonds chosen individually for beauty and presence, not pulled
            from a mass listing.
          </p>
        </div>

        <div>
          <h3 className="text-[1.1rem] tracking-[-0.02em]">
            Designed With Intent
          </h3>
          <p className="mt-3 text-sm leading-[1.9] text-[#6a635c]">
            Each ring shaped around proportion, comfort, and longevity, not
            pre-set templates.
          </p>
        </div>
      </div>
    </RevealOnScroll>
  );
}

function TestimonialSection() {
  return (
    <RevealOnScroll as="section" className="py-[96px] md:py-[112px]">
      <div className="rounded-[36px] bg-[#e9e1d6] px-8 py-[78px] md:px-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[1.55rem] leading-[1.4] tracking-[-0.03em] text-[#1f1d1a] md:text-[1.9rem]">
  “If I could leave 100 stars, I would. The entire process felt thoughtful, transparent, and genuinely personal from start to finish. Every detail was considered, and nothing ever felt rushed. It’s rare to find this level of care.”
</p>

<div className="mt-6 text-[10px] uppercase tracking-[0.28em] text-[#7d746a]">
  Google Review · KH, California
</div>
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/concierge"
            className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-[11px] uppercase tracking-[0.28em] text-white transition-all duration-500 ease-out hover:-translate-y-[1px] hover:opacity-90"
            onClick={() => trackConsultationCtaClicked("home:testimonial")}
          >
            Begin the Conversation
          </Link>
        </div>
      </div>
    </RevealOnScroll>
  );
}

export default function HomePageClient() {
  return (
    <main className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="home" />

        <section className="border-b border-[#e4dbcf] pb-[92px] pt-[82px] md:pb-[108px] md:pt-[98px]">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
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

              <div className="mt-8 flex items-center gap-4">
                <CTAGlimmer>
                  <Link
                    href="/concierge"
                    className="rounded-full border border-[#d9cdbd] bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-[#2b2723] transition-all duration-500 ease-out hover:-translate-y-[1px] hover:bg-white"
                    onClick={() => trackConsultationCtaClicked("home:hero")}
                  >
                    Begin the Conversation
                  </Link>
                </CTAGlimmer>
              </div>
            </div>

            <div className="min-w-0">
              <HeroRingStage />
            </div>
          </div>
        </section>

        <RevealOnScroll as="section" className="border-b border-[#e4dbcf] py-[92px] md:py-[108px]">
          <HomeStudioPortal />
        </RevealOnScroll>

        <CredibilityStrip />
        <FeaturedRingSection />
        <ClosingValueSection />
        <TestimonialSection />
      </div>
    </main>
  );
}