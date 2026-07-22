"use client";

import { type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import CTAGlimmer from "./shared-components/motion/CTAGlimmer";

const STUDIO_HERO_IMAGE = "/homepage/diamond-studio-hero.jpg";

const ARCH_PEDESTAL_IMAGE_CLASS =
  "object-cover object-[50%_54%] scale-[1.1] origin-[50%_38%]";

const ARCH_PEDESTAL_GRADIENT = `
              linear-gradient(to right,
                rgba(250,246,241,0.55) 0%,
                rgba(250,246,241,0.28) 16%,
                transparent 42%
              ),
              linear-gradient(to bottom,
                rgba(250,246,241,0.38) 0%,
                rgba(250,246,241,0.08) 14%,
                transparent 28%
              ),
              linear-gradient(to left,
                rgba(250,246,241,0.18) 0%,
                transparent 18%
              )
            `;

const MOBILE_STUDIO_SCRIM = `
              linear-gradient(to bottom,
                rgba(250,246,241,0.78) 0%,
                rgba(250,246,241,0.62) 16%,
                rgba(250,246,241,0.46) 34%,
                rgba(250,246,241,0.30) 52%,
                rgba(250,246,241,0.16) 68%,
                transparent 84%
              ),
              radial-gradient(ellipse 96% 72% at 50% 36%,
                rgba(252,248,243,0.58) 0%,
                rgba(250,246,241,0.34) 46%,
                transparent 76%
              )
            `;

const STUDIO_TOOLS = [
  {
    title: "Size Studio",
    description: "Visualize diamond size and finger coverage.",
    href: "/diamond-studio",
  },
  {
    title: "See It On Your Hand",
    description: "Preview diamond shapes at calibrated scale on your own hand.",
    href: "/diamond-shape-studio",
  },
  {
    title: "Analyze Sparkle",
    description: "Evaluate likely light performance from a grading report.",
    href: "/diamond-intelligence",
  },
] as const;

/** Warm graphite — functional copy only; no pale beige. */
const STUDIO_GRAPHITE = {
  strong: "#1f1d1a",
  body: "#3a3632",
  soft: "#524d48",
} as const;

function StudioPortalCursorGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      aria-hidden
      style={{
        background:
          "radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.28), transparent 64%)",
      }}
    />
  );
}

function trackPanelLight(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M3 8h9M9 5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StudioToolEditorialItem({
  title,
  description,
  status,
  href,
  comingSoon,
  showDivider,
}: {
  title: string;
  description: string;
  status?: string;
  href?: string;
  comingSoon?: boolean;
  showDivider?: boolean;
}) {
  const titleClass =
    "text-[10px] font-medium uppercase tracking-[0.24em] text-[#1f1d1a]";

  const descriptionClass =
    "mt-1 max-w-[22ch] text-[0.74rem] font-normal leading-[1.52] tracking-[0.01em] text-[#3a3632] max-md:mx-auto max-md:text-center md:ml-auto md:text-[0.72rem] md:leading-[1.45] md:text-right";

  const activeDescriptionClass = `${descriptionClass} transition-colors duration-500 group-hover:text-[#1f1d1a]`;

  const body = comingSoon ? (
    <>
      <div className={`${titleClass} text-left max-md:text-center md:text-right`}>{title}</div>
      {status ? (
        <p className="mt-0.5 text-[10px] font-normal tracking-[0.08em] text-[#524d48] text-left max-md:text-center md:ml-auto md:text-right">
          {status}
        </p>
      ) : null}
      <p className={descriptionClass}>{description}</p>
    </>
  ) : (
    <>
      <div
        className={`inline-flex items-center gap-1.5 text-left max-md:justify-center md:ml-auto md:justify-end ${titleClass} transition-colors duration-500 group-hover:text-[#0f0e0d]`}
      >
        <span>{title}</span>
        <IconArrow className="h-2.5 w-2.5 shrink-0 transition-transform duration-500 group-hover:translate-x-0.5" />
      </div>
      <p className={activeDescriptionClass}>{description}</p>
    </>
  );

  const itemClass = `block w-full py-2 ${showDivider ? "border-t border-[#dcd2c4]/30 pt-2.5 transition-colors duration-500 hover:border-[#c8a76e]/45" : ""}`;

  if (href && !comingSoon) {
    return (
      <Link href={href} className={`group ${itemClass}`}>
        {body}
      </Link>
    );
  }

  return (
    <div className={itemClass} aria-disabled={comingSoon ? true : undefined}>
      {body}
    </div>
  );
}

function StudioToolEditorialNav() {
  return (
    <nav
      className="flex w-full min-w-0 max-w-[232px] flex-col text-left max-md:mx-auto max-md:items-center max-md:text-center md:ml-auto md:items-end md:text-right"
      aria-label="Diamond Studio tools"
    >
      {STUDIO_TOOLS.map((tool, index) => (
        <StudioToolEditorialItem
          key={tool.title}
          title={tool.title}
          description={tool.description}
          href={tool.href}
          showDivider={index > 0}
        />
      ))}
    </nav>
  );
}

/**
 * Portal CTA — Pass 3.5 unified glimmer. The former perimeter-sparkle
 * system (continuous rAF loop, eight-point stars) was retired in favor of
 * the one controlled brand signal: this CTA responds to hover/focus with a
 * restrained light pass; the page's single autonomous pass belongs to the
 * hero consultation CTA.
 */
function StudioCtaButton() {
  return (
    <CTAGlimmer>
      <Link
        href="/diamond-studio"
        className="relative z-[1] inline-flex min-h-11 items-center gap-2 rounded-full border border-[#ece4da]/70 bg-[rgba(255,252,248,0.94)] px-6 py-3 text-[11px] uppercase tracking-[0.26em] text-[#5c534a] shadow-[0_2px_10px_rgba(48,36,28,0.04)] backdrop-blur-[6px] transition-colors duration-300 hover:bg-[rgba(255,252,248,0.98)] hover:text-[#2b2723] md:text-[10px] md:tracking-[0.28em]"
      >
        Enter →
      </Link>
    </CTAGlimmer>
  );
}

/**
 * Homepage Diamond Studio — atmospheric panel with floating ivory overlays.
 */
export default function HomeStudioPortal() {
  return (
    <div className="w-full min-w-0" data-hourglass-home="diamond-studio">
      <div
        className="group relative min-h-[460px] overflow-hidden rounded-[28px] md:min-h-[440px] md:rounded-[32px]"
        onMouseMove={trackPanelLight}
      >
        <Image
          src={STUDIO_HERO_IMAGE}
          alt=""
          fill
          priority={false}
          sizes="(max-width: 768px) 100vw, 1200px"
          className={ARCH_PEDESTAL_IMAGE_CLASS}
        />

        {/* Subtle flank washes — lower edge stays open for pedestal branding */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] hidden md:block"
          aria-hidden
          style={{
            background: ARCH_PEDESTAL_GRADIENT,
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 z-[1] md:hidden"
          aria-hidden
          style={{
            background: MOBILE_STUDIO_SCRIM,
          }}
        />

        <StudioPortalCursorGlow />

        {/* Facet-edge highlight — the panel border catches a restrained
            gold light on hover; background gains slight depth. No sparkle,
            no scale, image and text stay stable. */}
        <div
          className="pointer-events-none absolute inset-0 z-[2] rounded-[28px] border border-transparent transition-colors duration-700 group-hover:border-[#ad9164]/35 md:rounded-[32px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          aria-hidden
          style={{
            background:
              "radial-gradient(120% 90% at 50% 112%, rgba(43,39,35,0.10), transparent 58%)",
          }}
        />

        <div className="relative z-[4] flex min-h-[inherit] flex-col pb-28 md:flex-row md:items-center md:pb-24">
          <div className="flex flex-[1_1_0%] items-center justify-start px-5 py-8 max-md:justify-center max-md:text-center sm:px-6 md:px-8 md:py-0 lg:pl-10 lg:pr-4">
            <div className="max-w-[300px] translate-y-2 text-left max-md:mx-auto max-md:translate-y-0 md:translate-y-4">
              <h2
                className="font-serif text-[1.75rem] font-normal leading-[1.18] tracking-[-0.028em] max-md:mx-auto md:text-[1.9rem] md:leading-[1.12]"
                style={{ color: STUDIO_GRAPHITE.strong }}
              >
                Understand the diamond before you choose it.
              </h2>

              <p
                className="mt-4 max-w-[30ch] text-[0.92rem] leading-[1.72] max-md:mx-auto md:mt-3 md:text-[0.88rem] md:leading-[1.65]"
                style={{ color: STUDIO_GRAPHITE.body }}
              >
                Professional tools for scale, light performance, and report
                quality.
              </p>
            </div>
          </div>

          {/* Right — editorial column, anchored right */}
          <div className="flex flex-[1_1_0%] items-center justify-end px-5 pb-4 max-md:justify-center sm:px-6 md:px-8 md:py-0 md:pb-0 lg:pl-4 lg:pr-10">
            <div className="relative translate-y-2 max-md:translate-y-0 md:-translate-x-8 md:translate-y-4">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[300px] w-[280px] -translate-x-1/2 -translate-y-1/2"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(ellipse 58% 62% at 50% 50%, rgba(252,248,243,0.24) 0%, rgba(250,246,241,0.14) 48%, transparent 76%)",
                }}
              />
              <div className="relative z-[1]">
                <StudioToolEditorialNav />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[4.75rem] left-1/2 z-[5] w-full max-w-full -translate-x-1/2 px-5 sm:px-8 md:bottom-12 md:w-auto md:px-0">
          <div className="flex justify-center">
            <StudioCtaButton />
          </div>
        </div>
      </div>
    </div>
  );
}
