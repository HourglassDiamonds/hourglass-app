"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "./shared-components/motion/useReducedMotion";

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
    title: "Diamond Size Studio",
    description: "Explore size, shape, and presence.",
    href: "/diamond-studio",
  },
  {
    title: "Diamond Intelligence",
    description: "Analyze performance and report quality.",
    href: "/diamond-intelligence",
  },
  {
    title: "Shape Comparison",
    description: "Compare shapes on your own hand.",
    status: "Coming Soon",
    comingSoon: true,
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

  const itemClass = `block w-full py-2 ${showDivider ? "border-t border-[#dcd2c4]/30 pt-2.5" : ""}`;

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
          status={"status" in tool ? tool.status : undefined}
          href={"href" in tool ? tool.href : undefined}
          comingSoon={"comingSoon" in tool ? tool.comingSoon : false}
          showDivider={index > 0}
        />
      ))}
    </nav>
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

const CTA_SPARKLE_MD_MIN = 768;

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

    const mq = window.matchMedia(`(min-width: ${CTA_SPARKLE_MD_MIN}px)`);
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

    const enableMotion = () => {
      last = performance.now();
      startActive(last);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    const disableMotion = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onViewportChange = () => {
      if (mq.matches) enableMotion();
      else disableMotion();
    };

    onViewportChange();
    mq.addEventListener("change", onViewportChange);

    return () => {
      disableMotion();
      mq.removeEventListener("change", onViewportChange);
    };
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
      <div className="hidden md:contents">
        <StudioCtaSparkleStyles />
        <StudioCtaEdgeSparkle />
      </div>
      <Link
        href="/diamond-studio"
        className="relative z-[1] inline-flex items-center gap-2 rounded-full border border-[#ece4da]/70 bg-[rgba(255,252,248,0.94)] px-6 py-3 text-[11px] uppercase tracking-[0.26em] text-[#5c534a] shadow-[0_2px_10px_rgba(48,36,28,0.04)] backdrop-blur-[6px] transition-colors duration-300 hover:bg-[rgba(255,252,248,0.98)] hover:text-[#2b2723] md:px-5 md:py-2.5 md:text-[10px] md:tracking-[0.28em]"
      >
        Enter →
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

        <div className="absolute bottom-[6.25rem] left-1/2 z-[5] w-full max-w-full -translate-x-1/2 px-5 sm:px-8 md:bottom-12 md:w-auto md:px-0">
          <div className="flex justify-center">
            <StudioCtaButton />
          </div>
        </div>
      </div>
    </div>
  );
}
