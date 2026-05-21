import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ConsultationCtaLink from "../shared-components/ConsultationCtaLink";
import Header from "../shared-components/Header";

export const metadata: Metadata = {
  title: "Whispered Praise",
  description:
    "Quiet reflections from clients who trusted Hourglass Diamonds with proposals, redesigns, heirlooms, and custom pieces.",
  openGraph: {
    title: "Whispered Praise | Hourglass Diamonds",
    description:
      "A private editorial collection of client praise — calm, warm, and considered.",
    type: "website",
  },
};

type Testimonial = {
  src: string;
  alt: string;
  quote: string;
  supporting: string;
  attribution: string;
  /** Brighter scenes need a localized text scrim instead of a heavy full overlay. */
  overlayTone?: "default" | "bright";
  imageObjectPosition?: string;
};

const TESTIMONIALS: Record<string, Testimonial> = {
  "Justin is a godsend.": {
    src: "/whispered-praise/whispered-forest.webp",
    alt: "Forest path in quiet afternoon light",
    quote: "Justin is a godsend.",
    supporting:
      "I trust him with the most delicate piece of jewelry I wear on a daily basis.",
    attribution: "ZK · MS",
  },
  "Would not want to work with anyone else for this process.": {
    src: "/whispered-praise/whispered-shore.webp",
    alt: "Shoreline in soft golden hour light",
    quote: "Would not want to work with anyone else for this process.",
    supporting: "It always felt like I was working with a partner.",
    attribution: "DE · PA",
    overlayTone: "bright",
    imageObjectPosition: "50% 42%",
  },
  "He makes you feel like family, not just another customer.": {
    src: "/whispered-praise/whispered-champagne.webp",
    alt: "Champagne moment in warm candlelight",
    quote: "He makes you feel like family, not just another customer.",
    supporting:
      "The diamond I purchased is absolutely beautiful—honestly even better than I expected.",
    attribution: "DL · NJ",
  },
  "If I could give Justin 10 stars I would.": {
    src: "/whispered-praise/whispered-dock.webp",
    alt: "Wooden dock over still water at dusk",
    quote: "If I could give Justin 10 stars I would.",
    supporting: "He's not just an expert in jewelry, but in customer service.",
    attribution: "AG · CO",
  },
  "If I could leave 100 stars, I would.": {
    src: "/whispered-praise/whispered-beach-run.webp",
    alt: "Movement and laughter along the shoreline",
    quote: "If I could leave 100 stars, I would.",
    supporting:
      "The level of care and attention to detail is unlike anything I've ever experienced.",
    attribution: "KH · CA",
  },
  "He truly brought it to life with care, skill, and attention to detail.": {
    src: "/whispered-praise/whispered-island.webp",
    alt: "Island coastline in open golden light",
    quote: "He truly brought it to life with care, skill, and attention to detail.",
    supporting: "That level of craftsmanship and dedication is rare.",
    attribution: "KBJ · NC",
    overlayTone: "bright",
    imageObjectPosition: "50% 40%",
  },
  "There were zero cons.": {
    src: "/whispered-praise/whispered-street.webp",
    alt: "City street in warm evening light",
    quote: "There were zero cons.",
    supporting: "Truly next-level service.",
    attribution: "KH · CA",
  },
  "This has been one of the best buying experiences I have ever had.": {
    src: "/whispered-praise/whispered-field.webp",
    alt: "Open field beneath a wide soft sky",
    quote: "This has been one of the best buying experiences I have ever had.",
    supporting:
      "He was more interested in taking the time to get it right than he was in making a quick sale.",
    attribution: "BR · NC",
  },
  "One of the best experiences I've ever had with any business.": {
    src: "/whispered-praise/whispered-gazebo.webp",
    alt: "Garden gazebo in gentle afternoon light",
    quote: "One of the best experiences I've ever had with any business.",
    supporting: "Truly exceptional from start to finish.",
    attribution: "NP · IL",
  },
  "He exceeded my expectations.": {
    src: "/whispered-praise/whispered-sand.webp",
    alt: "Sand and shoreline in quiet warm light",
    quote: "He exceeded my expectations.",
    supporting: "I loved how genuine and upfront he was throughout the whole process.",
    attribution: "TB · WI",
    overlayTone: "bright",
    imageObjectPosition: "50% 38%",
  },
  "We couldn't imagine trusting anyone else with something this special.": {
    src: "/whispered-praise/whispered-snow.webp",
    alt: "Snow-covered landscape in still winter light",
    quote: "We couldn't imagine trusting anyone else with something this special.",
    supporting: "They gave us full confidence that we were in expert hands.",
    attribution: "CE · FL",
    overlayTone: "bright",
    imageObjectPosition: "50% 36%",
  },
  "The finished ring blew me away.": {
    src: "/whispered-praise/whispered-staircase.webp",
    alt: "Elegant staircase in warm interior light",
    quote: "The finished ring blew me away.",
    supporting:
      "It's beautifully crafted, totally unique, and gets constant compliments.",
    attribution: "NP · IL",
  },
  "You are missing out if not and it would be a waste of time and money to go through someone else.":
    {
      src: "/whispered-praise/whispered-beach.webp",
      alt: "Couple walking the beach in soft sunlight",
      quote:
        "You are missing out if not and it would be a waste of time and money to go through someone else.",
      supporting: "He over delivered...both with the product and experience.",
      attribution: "DJ · CA",
      overlayTone: "bright",
      imageObjectPosition: "50% 32%",
    },
  "The best in the business!": {
    src: "/whispered-praise/whispered-paris.webp",
    alt: "Paris street scene in cinematic warm tones",
    quote: "The best in the business!",
    supporting: "They can make anything possible.",
    attribution: "CK · VA",
  },
  "Justin and Hourglass Diamonds turned my rambling ideas and mood board into a reality.": {
    src: "/whispered-praise/whispered-mountain.webp",
    alt: "Mountain vista in soft morning light",
    quote:
      "Justin and Hourglass Diamonds turned my rambling ideas and mood board into a reality.",
    supporting:
      "In short, if you need a ring contact Hourglass Diamonds for the care and consideration you deserve.",
    attribution: "JP · NY",
  },
};

const GRID_GAP = "gap-3 md:gap-4";
const SECTION_GAP = "mt-16 md:mt-24";
const HERO_SECTION_GAP = "mt-[5.5rem] md:mt-[7.5rem] lg:mt-[8.5rem]";
const BREATHING_GAP = "mt-[5rem] md:mt-[7rem]";

const IMAGE_CLASS =
  "object-cover contrast-[0.96] brightness-[1.02] saturate-[1.03]";

function HeroSplitCard({
  item,
  imageSide,
  imageTreatment = "default",
}: {
  item: Testimonial;
  imageSide: "left" | "right";
  imageTreatment?: "default" | "couple-closing";
}) {
  const isCoupleClosing = imageTreatment === "couple-closing";
  const imageShellClass = isCoupleClosing
    ? "relative min-h-[280px] md:aspect-[16/11] md:min-h-0 lg:aspect-[16/10]"
    : "relative min-h-[240px] md:min-h-[320px] lg:min-h-[360px]";
  const imageClass = isCoupleClosing
    ? `${IMAGE_CLASS} object-[50%_30%]`
    : IMAGE_CLASS;

  const imageBlock = (
    <div className={imageShellClass}>
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes="(max-width: 768px) 100vw, 65vw"
        className={imageClass}
        priority={imageSide === "left"}
      />
    </div>
  );

  const textBlock = (
    <div className="flex flex-col justify-center bg-[#efe8de] px-9 py-10 md:px-12 md:py-12 lg:px-14 lg:py-14">
      <blockquote>
        <p
          className="max-w-[21ch] font-serif text-[1.45rem] font-normal leading-[1.28] tracking-[-0.022em] text-[#141210] md:max-w-[23ch] md:text-[1.82rem] md:leading-[1.2] lg:text-[2.05rem] lg:leading-[1.16]"
          style={{ textWrap: "balance" }}
        >
          &ldquo;{item.quote}&rdquo;
        </p>
        <p className="mt-6 max-w-[33ch] text-[0.93rem] leading-[1.84] text-[#5e5650] md:mt-7 md:text-[0.95rem] md:leading-[1.88]">
          {item.supporting}
        </p>
        <footer className="mt-6 text-[9px] uppercase tracking-[0.36em] text-[#948a7e] md:mt-7">
          {item.attribution}
        </footer>
      </blockquote>
    </div>
  );

  return (
    <article className="overflow-hidden rounded-sm border border-[#ddd2c4]/90 shadow-[0_1px_0_rgba(255,252,248,0.65)_inset]">
      <div className="flex flex-col md:grid md:grid-cols-[1.62fr_1fr] md:items-stretch">
        {imageSide === "left" ? (
          <>
            {imageBlock}
            {textBlock}
          </>
        ) : (
          <>
            <div className="order-2 md:order-1">{textBlock}</div>
            <div className="order-1 md:order-2">{imageBlock}</div>
          </>
        )}
      </div>
    </article>
  );
}

function TileOverlays({ tone }: { tone: Testimonial["overlayTone"] }) {
  if (tone === "bright") {
    return (
      <>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#2a2620]/8 via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-[radial-gradient(ellipse_125%_90%_at_50%_100%,rgba(28,25,22,0.62)_0%,rgba(28,25,22,0.22)_48%,transparent_72%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#1f1c19]/76 via-[#1f1c19]/34 to-transparent transition-[opacity] duration-[800ms] ease-out group-hover:from-[#1f1c19]/84 group-focus-within:from-[#1f1c19]/84"
          aria-hidden
        />
      </>
    );
  }

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2a2620]/76 via-[#2a2620]/22 to-transparent transition-[opacity] duration-[800ms] ease-out group-hover:from-[#2a2620]/86 group-focus-within:from-[#2a2620]/86"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-[radial-gradient(ellipse_110%_80%_at_50%_100%,rgba(28,25,22,0.35)_0%,transparent_65%)]"
        aria-hidden
      />
    </>
  );
}

function StandardTile({ item }: { item: Testimonial }) {
  const tone = item.overlayTone ?? "default";

  return (
    <article
      className="group relative aspect-[4/5] overflow-hidden rounded-sm border border-[#e4dbcf]/75"
      tabIndex={0}
    >
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes="(max-width: 640px) 50vw, 25vw"
        className={`${IMAGE_CLASS} transition-[filter] duration-[800ms] ease-out group-hover:brightness-[0.7] group-hover:saturate-[0.88] group-focus-within:brightness-[0.7] group-focus-within:saturate-[0.88]`}
        style={
          item.imageObjectPosition
            ? { objectPosition: item.imageObjectPosition }
            : undefined
        }
      />
      <TileOverlays tone={tone} />
      <div
        className="pointer-events-none absolute inset-0 bg-[#d4b896]/0 transition-[background-color] duration-[800ms] ease-out group-hover:bg-[#d4b896]/8 group-focus-within:bg-[#d4b896]/8"
        aria-hidden
      />

      <div className="absolute inset-0 flex flex-col items-center justify-end px-4 pb-4 pt-8 text-center md:px-5 md:pb-5 md:pt-10">
        <p
          className={`whispered-tile-quote max-w-[18ch] font-serif font-normal leading-[1.48] tracking-[-0.01em] md:max-w-[19ch] md:leading-[1.5] ${
            tone === "bright"
              ? "text-[0.84rem] text-[#faf7f2] drop-shadow-[0_1px_14px_rgba(20,18,16,0.45)] md:text-[0.9rem]"
              : "text-[0.84rem] text-[#faf7f2] md:text-[0.9rem]"
          }`}
          style={{ textWrap: "balance" }}
        >
          &ldquo;{item.quote}&rdquo;
        </p>
        <p
          className={`whispered-tile-supporting mt-2.5 max-w-[21ch] text-[0.74rem] leading-[1.58] ${
            tone === "bright" ? "text-[#faf7f2]/94" : "text-[#faf7f2]/89"
          }`}
        >
          {item.supporting}
        </p>
        <p className="whispered-tile-attribution mt-2.5 text-[8px] uppercase tracking-[0.32em] text-[#faf7f2]/70">
          {item.attribution}
        </p>
      </div>

      <span className="sr-only">
        {item.quote} {item.supporting} {item.attribution}
      </span>
    </article>
  );
}

function BreathingQuote({
  quote,
  attribution,
}: {
  quote: string;
  attribution: string;
}) {
  return (
    <figure
      className="border-y border-[#e4dbcf]/50 py-11 md:py-14"
      aria-label={`Client reflection: ${quote}`}
    >
      <blockquote className="mx-auto max-w-[26rem] px-4 text-center md:max-w-[30rem]">
        <p
          className="mx-auto max-w-[22ch] font-serif text-[1.42rem] font-normal leading-[1.32] tracking-[-0.02em] text-[#1a1816] md:max-w-[24ch] md:text-[1.58rem] md:leading-[1.28]"
          style={{ textWrap: "balance" }}
        >
          &ldquo;{quote}&rdquo;
        </p>
      </blockquote>
      <figcaption className="mt-6 flex flex-col items-center gap-5 text-center">
        <span
          className="block h-px w-10 bg-gradient-to-r from-transparent via-[#d4c8ba]/90 to-transparent"
          aria-hidden
        />
        <span className="text-[9px] uppercase tracking-[0.36em] text-[#877d72]">
          {attribution}
        </span>
      </figcaption>
    </figure>
  );
}

function StandardGrid({ quotes }: { quotes: string[] }) {
  return (
    <div className={`grid grid-cols-2 ${GRID_GAP} md:grid-cols-4`}>
      {quotes.map((quote) => (
        <StandardTile key={quote} item={TESTIMONIALS[quote]} />
      ))}
    </div>
  );
}

export default function WhisperedPraisePage() {
  return (
    <div className="whispered-page relative min-h-screen bg-[#efe8de] pb-12 text-[#1c1b1a] md:pb-20">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-b from-transparent via-[#efe8de]/55 to-[#efe8de] md:h-52"
        aria-hidden
      />
      <div className="whispered-grain" aria-hidden />

      <style>{`
        @keyframes whispered-enter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .whispered-enter {
          animation: whispered-enter 1.8s ease-out forwards;
        }
        .whispered-enter-delay {
          animation: whispered-enter 2.1s ease-out 0.25s forwards;
          opacity: 0;
        }
        .whispered-grain {
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 50;
          opacity: 0.028;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .whispered-tile-quote,
        .whispered-tile-supporting,
        .whispered-tile-attribution {
          opacity: 1;
          transform: translateY(0);
        }
        @media (min-width: 768px) {
          .whispered-tile-quote,
          .whispered-tile-supporting,
          .whispered-tile-attribution {
            opacity: 0;
            transform: translateY(10px);
          }
          .whispered-tile-quote {
            transition:
              opacity 400ms ease-out,
              transform 400ms ease-out;
          }
          .whispered-tile-supporting {
            transition:
              opacity 400ms ease-out 150ms,
              transform 400ms ease-out 150ms;
          }
          .whispered-tile-attribution {
            transition:
              opacity 400ms ease-out 300ms,
              transform 400ms ease-out 300ms;
          }
          .group:hover .whispered-tile-quote,
          .group:hover .whispered-tile-supporting,
          .group:hover .whispered-tile-attribution,
          .group:focus-within .whispered-tile-quote,
          .group:focus-within .whispered-tile-supporting,
          .group:focus-within .whispered-tile-attribution {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 md:px-10">
        <div className="whispered-enter">
          <Header />
        </div>

        <section className="border-b border-[#e4dbcf] pb-28 pt-24 md:pb-48 md:pt-32">
          <div className="whispered-enter-delay mx-auto max-w-[860px] text-center">
            <p className="text-[10px] uppercase tracking-[0.36em] text-[#8a8177]">
              Whispered Praise
            </p>
            <h1
              className="mx-auto mt-8 max-w-[17ch] font-serif text-[2.15rem] font-normal leading-[1.14] tracking-[-0.02em] text-[#1f1d1a] md:mt-10 md:max-w-[18ch] md:text-[3rem] md:leading-[1.1]"
              style={{ textWrap: "balance" }}
            >
              Quiet words from people who trusted us with something meaningful.
            </h1>
            <p className="mx-auto mt-10 max-w-[34rem] text-[1.08rem] leading-[2] text-[#5a534c] md:mt-12 md:text-[1.12rem]">
              A collection of client reflections from proposals, redesigns, heirloom
              projects, and custom pieces — shared with the same quiet care that
              shaped the work itself.
            </p>
          </div>
        </section>

        <section className="pb-28 pt-12 md:pb-44 md:pt-16">
          <HeroSplitCard
            item={TESTIMONIALS["If I could leave 100 stars, I would."]}
            imageSide="left"
          />

          <div className={SECTION_GAP}>
            <StandardGrid
              quotes={[
                "Justin is a godsend.",
                "He makes you feel like family, not just another customer.",
                "Would not want to work with anyone else for this process.",
                "If I could give Justin 10 stars I would.",
              ]}
            />
          </div>

          <div className={HERO_SECTION_GAP}>
            <HeroSplitCard
              item={
                TESTIMONIALS[
                  "One of the best experiences I've ever had with any business."
                ]
              }
              imageSide="right"
            />
          </div>

          <div className={`${BREATHING_GAP} mx-auto max-w-[40rem]`}>
            <BreathingQuote
              quote="It always felt like I was working with a partner."
              attribution="DE · PA"
            />
          </div>

          <div className={SECTION_GAP}>
            <StandardGrid
              quotes={[
                "He truly brought it to life with care, skill, and attention to detail.",
                "There were zero cons.",
                "This has been one of the best buying experiences I have ever had.",
                "He exceeded my expectations.",
                "We couldn't imagine trusting anyone else with something this special.",
                "You are missing out if not and it would be a waste of time and money to go through someone else.",
                "The best in the business!",
                "Justin and Hourglass Diamonds turned my rambling ideas and mood board into a reality.",
              ]}
            />
          </div>

          <div className={HERO_SECTION_GAP}>
            <HeroSplitCard
              item={TESTIMONIALS["The finished ring blew me away."]}
              imageSide="left"
              imageTreatment="couple-closing"
            />
          </div>
        </section>

        <section className="relative mt-12 border-t border-[#e4dbcf]/65 pt-40 pb-28 md:mt-16 md:pt-60 md:pb-36">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ddd2c4]/80 to-transparent"
            aria-hidden
          />
          <div className="mx-auto max-w-[600px] text-center">
            <h2
              className="mx-auto max-w-[19ch] font-serif text-[1.7rem] font-normal leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:max-w-[20ch] md:text-[2.25rem] md:leading-[1.1]"
              style={{ textWrap: "balance" }}
            >
              A calmer way to create something lasting.
            </h2>
            <p className="mx-auto mt-10 max-w-[29rem] text-[1.08rem] leading-[2] text-[#585049] md:max-w-[30rem]">
              The right ring should feel considered from every angle — the stone,
              the setting, the story, and the experience around it. Hourglass was
              built for clients who want thoughtful guidance, refined sourcing, and
              a process that feels personal from the first conversation.
            </p>
            <div className="mt-16 flex flex-col items-center justify-center gap-7 sm:flex-row sm:gap-10">
              <ConsultationCtaLink
                location="whispered_praise:footer"
                className="inline-flex rounded-full border border-[#cfc3b4] bg-[#f7f2eb]/30 px-9 py-3.5 text-[10.5px] uppercase tracking-[0.3em] text-[#5f574f] transition-[color,background-color,border-color,box-shadow,transform] duration-700 ease-out hover:-translate-y-px hover:border-[#b8a896] hover:bg-white/70 hover:text-[#3d3832] hover:shadow-[0_10px_32px_rgba(48,36,28,0.08)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9]/70 focus:ring-offset-2 focus:ring-offset-[#efe8de]"
              >
                Begin the Conversation
              </ConsultationCtaLink>
              <Link
                href="/diamond-studio"
                className="rounded-sm px-2 text-[10.5px] uppercase tracking-[0.28em] text-[#756d64] transition-[color,opacity] duration-700 ease-out hover:text-[#1f1d1a] focus:outline-none focus:ring-2 focus:ring-[#cbbda9]/70 focus:ring-offset-2 focus:ring-offset-[#efe8de]"
              >
                Explore the Diamond Studio
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
