"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "./shared-components/motion/useReducedMotion";

const STUDIO_HERO_IMAGE = "/homepage/diamond-studio-hero.jpg";

const PILL_BASE =
  "inline-flex max-w-full items-center rounded-full border border-[#ece4da]/80 bg-[rgba(255,252,248,0.74)] px-4 py-2 text-[0.82rem] tracking-[-0.01em] text-[#2b2723] shadow-[0_2px_10px_rgba(48,36,28,0.04)] backdrop-blur-[6px] transition-colors duration-300 max-md:justify-center max-md:whitespace-normal max-md:text-center md:whitespace-nowrap";

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

function BetaSuffix() {
  return (
    <span className="ml-1 font-normal text-[#9a9084] text-[0.78rem]">
      (Beta)
    </span>
  );
}

function ToolPill({
  href,
  locked,
  children,
}: {
  href?: string;
  locked?: boolean;
  children: ReactNode;
}) {
  if (locked) {
    return (
      <span
        className={`${PILL_BASE} cursor-default opacity-65`}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href!} className={`${PILL_BASE} hover:bg-[rgba(255,252,248,0.88)]`}>
      {children}
    </Link>
  );
}

/** Compact eight-point sparkle — studio gold/ivory ray star. */
const STUDIO_WHITE = "#FFFFFF";
const STUDIO_CREAM = "#FFFCF7";
const STUDIO_WARM = "#FAF4EC";
const STUDIO_GOLD = "#E8D4A8";
const STUDIO_GOLD_DEEP = "#C4B08A";

const SPARKLE_CENTER = 10;
const SPARKLE_OUTER_R = 8.2;
const SPARKLE_INNER_R = 1.55;

function buildEightPointRayPath() {
  const points: string[] = [];

  for (let i = 0; i < 16; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 8;
    const radius = i % 2 === 0 ? SPARKLE_OUTER_R : SPARKLE_INNER_R;
    const x = SPARKLE_CENTER + radius * Math.cos(angle);
    const y = SPARKLE_CENTER + radius * Math.sin(angle);
    points.push(
      `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`,
    );
  }

  return `${points.join(" ")} Z`;
}

const EIGHT_POINT_RAY_PATH = buildEightPointRayPath();

function HourglassSparkleStar({ id = "a" }: { id?: string }) {
  const glowId = `hg-cta-sparkle-glow-${id}`;
  const fillId = `hg-cta-sparkle-fill-${id}`;

  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 overflow-visible"
      fill="none"
      aria-hidden
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={STUDIO_CREAM} stopOpacity="0.22" />
          <stop offset="70%" stopColor={STUDIO_WARM} stopOpacity="0.05" />
          <stop offset="100%" stopColor={STUDIO_WARM} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={fillId} x1="4" y1="3" x2="16" y2="17">
          <stop offset="0%" stopColor={STUDIO_WHITE} />
          <stop offset="38%" stopColor={STUDIO_CREAM} />
          <stop offset="100%" stopColor={STUDIO_GOLD} />
        </linearGradient>
      </defs>
      <circle
        cx="10"
        cy="10"
        r="2.6"
        fill={`url(#${glowId})`}
        className="studio-cta-sparkle-glow"
      />
      <path d={EIGHT_POINT_RAY_PATH} fill={`url(#${fillId})`} />
      <path
        d={EIGHT_POINT_RAY_PATH}
        stroke={STUDIO_GOLD_DEEP}
        strokeWidth="0.28"
        strokeOpacity="0.32"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function luxurySparkleLuminance(
  offsetPct: number,
  phaseOffset: number,
  active: boolean,
) {
  const radians = (offsetPct / 100) * Math.PI * 2;
  const wave = 0.5 + 0.5 * Math.sin(radians * 2.4 + phaseOffset);
  const activeFloor = active ? 0.42 : 0.3;
  const activeCeil = active ? 0.94 : 0.48;
  const opacity = activeFloor + (activeCeil - activeFloor) * wave;
  const brightness = 0.86 + 0.18 * wave;

  return { opacity: clamp01(opacity), brightness };
}

const CTA_PERIMETER_MS = 22_000;
const CTA_ACTIVE_BURST_MS = 3_600;
const CTA_IDLE_MIN_MS = 1_800;
const CTA_IDLE_MAX_MS = 3_800;

function StudioCtaSparkleStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .studio-cta-sparkle-on-edge {
            position: absolute;
            width: 20px;
            height: 20px;
            offset-path: inset(0 round 9999px);
            offset-anchor: center;
            offset-rotate: 0deg;
            will-change: offset-distance, opacity, filter;
          }
          @media (prefers-reduced-motion: reduce) {
            .studio-cta-sparkle-on-edge {
              offset-distance: 68% !important;
            }
            .studio-cta-sparkle-on-edge--opposite {
              offset-distance: 18% !important;
            }
            .studio-cta-sparkle-glow {
              opacity: 0.55;
            }
          }
        `,
      }}
    />
  );
}

function StudioCtaEdgeSparkle() {
  const reduced = useReducedMotion();
  const [offsetPct, setOffsetPct] = useState(0);
  const [travelActive, setTravelActive] = useState(true);
  const motionRef = useRef({
    offset: 0,
    phase: "active" as "active" | "idle",
    phaseEnd: 0,
  });

  useEffect(() => {
    if (reduced) return;

    let raf = 0;
    let last = performance.now();

    const startActive = (now: number) => {
      motionRef.current.phase = "active";
      motionRef.current.phaseEnd = now + CTA_ACTIVE_BURST_MS;
      setTravelActive(true);
    };

    const startIdle = (now: number) => {
      const idleDuration =
        CTA_IDLE_MIN_MS + Math.random() * (CTA_IDLE_MAX_MS - CTA_IDLE_MIN_MS);
      motionRef.current.phase = "idle";
      motionRef.current.phaseEnd = now + idleDuration;
      setTravelActive(false);
    };

    startActive(performance.now());

    const tick = (now: number) => {
      const dt = Math.min(now - last, 48);
      last = now;
      const motion = motionRef.current;

      if (motion.phase === "active") {
        motion.offset += (dt / CTA_PERIMETER_MS) * 100;
        if (motion.offset >= 100) motion.offset -= 100;
        setOffsetPct(motion.offset);
        if (now >= motion.phaseEnd) startIdle(now);
      } else if (now >= motion.phaseEnd) {
        startActive(now);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const oppositeOffsetPct = (offsetPct + 50) % 100;
  const primaryLuminance = luxurySparkleLuminance(offsetPct, 0, travelActive);
  const oppositeLuminance = luxurySparkleLuminance(offsetPct, Math.PI, travelActive);

  const sparkleStyle = (
    distance: number,
    luminance: { opacity: number; brightness: number },
  ) =>
    ({
      offsetDistance: `${distance}%`,
      opacity: luminance.opacity,
      filter: `brightness(${luminance.brightness})`,
    }) as const;

  if (reduced) {
    return (
      <div
        className="studio-cta-edge-track pointer-events-none absolute -inset-[2px] z-[2] rounded-full"
        aria-hidden
      >
        <div
          className="studio-cta-sparkle-on-edge"
          style={sparkleStyle(68, { opacity: 0.55, brightness: 1 })}
        >
          <HourglassSparkleStar id="a" />
        </div>
        <div
          className="studio-cta-sparkle-on-edge studio-cta-sparkle-on-edge--opposite"
          style={sparkleStyle(18, { opacity: 0.55, brightness: 1 })}
        >
          <HourglassSparkleStar id="b" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="studio-cta-edge-track pointer-events-none absolute -inset-[2px] z-[2] rounded-full"
      aria-hidden
    >
      <div
        className="studio-cta-sparkle-on-edge"
        style={sparkleStyle(offsetPct, primaryLuminance)}
      >
        <HourglassSparkleStar id="a" />
      </div>
      <div
        className="studio-cta-sparkle-on-edge studio-cta-sparkle-on-edge--opposite"
        style={sparkleStyle(oppositeOffsetPct, oppositeLuminance)}
      >
        <HourglassSparkleStar id="b" />
      </div>
    </div>
  );
}

function StudioCtaButton() {
  return (
    <div className="relative inline-flex items-center justify-center">
      <StudioCtaSparkleStyles />
      <StudioCtaEdgeSparkle />
      <Link
        href="/diamond-studio"
        className="relative z-[1] inline-flex items-center gap-2 rounded-full border border-[#ece4da]/70 bg-[rgba(255,252,248,0.94)] px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] text-[#5c534a] shadow-[0_2px_10px_rgba(48,36,28,0.04)] backdrop-blur-[6px] transition-colors duration-300 hover:bg-[rgba(255,252,248,0.98)] hover:text-[#2b2723]"
      >
        Enter the Studio
        <IconArrow className="h-3 w-3 opacity-70" />
      </Link>
    </div>
  );
}

/**
 * Homepage Diamond Studio — atmospheric panel with floating ivory overlays.
 */
export default function HomeStudioPortal() {
  return (
    <div className="w-full min-w-0" data-hourglass-home="diamond-studio">
      <div
        className="group relative min-h-[460px] overflow-hidden rounded-[32px] border border-[#dcd2c4]/72 shadow-[0_10px_28px_rgba(49,38,29,0.032)] md:min-h-[440px]"
        onMouseMove={trackPanelLight}
      >
        <Image
          src={STUDIO_HERO_IMAGE}
          alt=""
          fill
          priority={false}
          sizes="(max-width: 768px) 100vw, 1200px"
          className="object-cover object-center"
        />

        {/* Lighter center so diamond reads; ivory on flanks for copy/pills */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden
          style={{
            background: `
              linear-gradient(to right,
                rgba(250,246,241,0.9) 0%,
                rgba(250,246,241,0.72) 14%,
                rgba(250,246,241,0.22) 34%,
                rgba(250,246,241,0.06) 50%,
                rgba(250,246,241,0.22) 66%,
                rgba(250,246,241,0.68) 86%,
                rgba(250,246,241,0.88) 100%
              ),
              linear-gradient(to bottom, rgba(255,252,248,0.08), transparent 36%)
            `,
          }}
        />

        <StudioPortalCursorGlow />

        <div className="relative z-[4] flex min-h-[inherit] flex-col pb-24 md:flex-row md:pb-20">
          {/* Left — vertically centered, left-aligned */}
          <div className="flex flex-1 items-center justify-start px-5 py-10 sm:px-8 md:px-12 md:py-12 lg:pl-14 lg:pr-8">
            <div className="max-w-[320px] text-left">
              <p className="text-[11px] tracking-[0.34em] text-[#8d8275]">
                DIAMOND STUDIO
              </p>

              <h2 className="mt-4 font-serif text-[1.65rem] font-normal leading-[1.12] tracking-[-0.028em] text-[#27231f] md:text-[1.9rem]">
                Understand the diamond before you choose it.
              </h2>

              <p className="mt-3 max-w-[30ch] text-[0.88rem] leading-[1.7] text-[#756d64]">
                Professional tools for scale, light performance, and report
                quality.
              </p>
            </div>
          </div>

          {/* Right — vertically centered, right-aligned pill stack */}
          <div className="flex flex-1 items-center justify-end px-5 pb-6 sm:px-8 md:px-12 md:py-12 lg:pr-14 lg:pl-8">
            <div className="flex w-full min-w-0 max-w-full flex-col items-end gap-2 max-md:items-center">
              <ToolPill href="/diamond-studio">Diamond Size Studio</ToolPill>
              <ToolPill href="/diamond-intelligence">
                Diamond Intelligence
                <BetaSuffix />
              </ToolPill>
              <ToolPill locked>
                <span className="text-[#6a635c]">Shape Comparison</span>
                <span className="mx-1.5 text-[#c4b8a8]" aria-hidden>
                  /
                </span>
                <span className="text-[0.78rem] text-[#9a9084]">Coming Soon</span>
              </ToolPill>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-[5] w-full max-w-full -translate-x-1/2 px-5 sm:px-8 md:bottom-9 md:w-auto md:px-0">
          <div className="flex justify-center">
            <StudioCtaButton />
          </div>
        </div>
      </div>
    </div>
  );
}
