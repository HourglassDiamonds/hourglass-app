"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isFacetRailRoute } from "./public-motion-routes";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Scroll glint — studio light palette, jewelry-reflection shape.
 *
 * Elongated vertical streak with slight asymmetry — not a four-point star.
 */
const RAIL_HEIGHT = 720;
const RAIL_WIDTH = 35;
const LINE_X = RAIL_WIDTH / 2;

const STUDIO_WHITE = "#FFFFFF";
const STUDIO_CREAM = "#FFFCF7";
const STUDIO_WARM = "#FAF4EC";

const BASE_OPACITY = 0.02;
const PEAK_OPACITY = 0.65;
const MID_OPACITY = 0.14;
const FRINGE_OPACITY = 0.1;

const SPARKLE_SCALE = 1.25;

const GLINT_HEIGHT_PX = 25 * SPARKLE_SCALE;
const GLINT_HALF_PX = GLINT_HEIGHT_PX / 2;

/** Vertical emphasis — narrow horizontally, tall vertically. */
const SPILL_OUTER_RX = 6.25 * SPARKLE_SCALE;
const SPILL_OUTER_RY = 60 * SPARKLE_SCALE;
const SPILL_INNER_RX = 3.125 * SPARKLE_SCALE;
const SPILL_INNER_RY = 30 * SPARKLE_SCALE;

/** Tiny offset specular — a sliver of edge catch, not a cross-arm. */
const EDGE_CATCH_LEN = 4.375 * SPARKLE_SCALE;
const EDGE_CATCH_OPACITY = 0.28;

const GLINT_FADE_IN_MS = 100;
const GLINT_EASING_IN = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const GLINT_FADE_OUT_MS = 850;
const GLINT_EASING_OUT = "cubic-bezier(0.28, 0.11, 0.22, 1)";
const SCROLL_IDLE_MS = 160;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function yOffset(y: number) {
  return clamp01(y / RAIL_HEIGHT);
}

/**
 * Asymmetric band profile — peak sits slightly above center, falloff
 * longer below than above (sunlight sliding downward).
 */
function buildGlintStops(glintCenterY: number) {
  const peakY = glintCenterY - 1.875 * SPARKLE_SCALE;
  const top = glintCenterY - GLINT_HALF_PX * 0.4;
  const bottom = glintCenterY + GLINT_HALF_PX * 0.72;

  return (
    <>
      <stop offset={yOffset(top)} stopColor={STUDIO_WHITE} stopOpacity="0" />
      <stop
        offset={yOffset(top + (peakY - top) * 0.55)}
        stopColor={STUDIO_WHITE}
        stopOpacity={FRINGE_OPACITY}
      />
      <stop
        offset={yOffset(peakY - 2.5 * SPARKLE_SCALE)}
        stopColor={STUDIO_CREAM}
        stopOpacity={MID_OPACITY}
      />
      <stop
        offset={yOffset(peakY)}
        stopColor={STUDIO_WHITE}
        stopOpacity={PEAK_OPACITY}
      />
      <stop
        offset={yOffset(peakY + 5 * SPARKLE_SCALE)}
        stopColor={STUDIO_CREAM}
        stopOpacity={MID_OPACITY * 0.85}
      />
      <stop
        offset={yOffset(bottom - (bottom - peakY) * 0.35)}
        stopColor={STUDIO_WHITE}
        stopOpacity={FRINGE_OPACITY * 0.8}
      />
      <stop offset={yOffset(bottom)} stopColor={STUDIO_WHITE} stopOpacity="0" />
    </>
  );
}

export default function FacetScintillationRail() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [glintActive, setGlintActive] = useState(false);
  const idleTimer = useRef(0);
  const showRail = isFacetRailRoute(pathname);

  useEffect(() => {
    if (!showRail || reduced) return;

    let frame = 0;

    const readProgress = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(clamp01(maxScroll > 0 ? window.scrollY / maxScroll : 0));
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(readProgress);

      setGlintActive(true);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(
        () => setGlintActive(false),
        SCROLL_IDLE_MS,
      );
    };

    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(readProgress);
    };

    readProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [showRail, reduced]);

  if (!showRail || reduced) return null;

  const overshoot = GLINT_HALF_PX;
  const glintCenterY =
    -overshoot + scrollProgress * (RAIL_HEIGHT + 2 * overshoot);

  const glintOpacity = glintActive ? 1 : 0;
  const glintStyle = {
    transition: glintActive
      ? `opacity ${GLINT_FADE_IN_MS}ms ${GLINT_EASING_IN}`
      : `opacity ${GLINT_FADE_OUT_MS}ms ${GLINT_EASING_OUT}`,
  };

  /* Slight organic offset — centers never perfectly aligned. */
  const outerCx = LINE_X + 0.875 * SPARKLE_SCALE;
  const outerCy = glintCenterY + 3.125 * SPARKLE_SCALE;
  const innerCx = LINE_X - 0.625 * SPARKLE_SCALE;
  const innerCy = glintCenterY - 3.75 * SPARKLE_SCALE;

  return (
    <div
      className="pointer-events-none fixed left-3 top-0 z-[35] hidden h-full w-9 md:left-5 md:block lg:left-7 xl:left-9"
      aria-hidden
    >
      <svg
        className="sticky top-[14vh] w-full"
        style={{ height: `min(72vh, ${RAIL_HEIGHT}px)` }}
        viewBox={`0 0 ${RAIL_WIDTH} ${RAIL_HEIGHT}`}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient
            id="hg-rail-glint"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={RAIL_HEIGHT}
          >
            {buildGlintStops(glintCenterY)}
          </linearGradient>

          {/* Focal point offset — not a perfect circle */}
          <radialGradient id="hg-rail-spill-outer" cx="46%" cy="42%" r="50%">
            <stop offset="0%" stopColor={STUDIO_WHITE} stopOpacity="0.65" />
            <stop offset="16%" stopColor={STUDIO_WHITE} stopOpacity="0.14" />
            <stop offset="100%" stopColor={STUDIO_WHITE} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="hg-rail-spill-inner" cx="54%" cy="58%" r="50%">
            <stop offset="0%" stopColor={STUDIO_WHITE} stopOpacity="0.55" />
            <stop offset="45%" stopColor={STUDIO_CREAM} stopOpacity="0.12" />
            <stop offset="100%" stopColor={STUDIO_WARM} stopOpacity="0" />
          </radialGradient>
        </defs>

        <line
          x1={LINE_X}
          y1="0"
          x2={LINE_X}
          y2={RAIL_HEIGHT}
          stroke={STUDIO_WHITE}
          strokeWidth="1"
          opacity={BASE_OPACITY}
        />

        {/* Elongated vertical spill — narrow rx, tall ry */}
        <ellipse
          cx={outerCx}
          cy={outerCy}
          rx={SPILL_OUTER_RX}
          ry={SPILL_OUTER_RY}
          fill="url(#hg-rail-spill-outer)"
          opacity={glintOpacity}
          style={glintStyle}
        />

        <ellipse
          cx={innerCx}
          cy={innerCy}
          rx={SPILL_INNER_RX}
          ry={SPILL_INNER_RY}
          fill="url(#hg-rail-spill-inner)"
          opacity={glintOpacity}
          style={glintStyle}
        />

        {/* Vertical seam — primary axis */}
        <line
          x1={LINE_X}
          y1="0"
          x2={LINE_X}
          y2={RAIL_HEIGHT}
          stroke="url(#hg-rail-glint)"
          strokeWidth={3.75 * SPARKLE_SCALE}
          opacity={glintOpacity * 0.5}
          style={glintStyle}
        />

        <line
          x1={LINE_X}
          y1="0"
          x2={LINE_X}
          y2={RAIL_HEIGHT}
          stroke="url(#hg-rail-glint)"
          strokeWidth={1 * SPARKLE_SCALE}
          opacity={glintOpacity}
          style={glintStyle}
        />

        {/*
         * Micro edge-catch — short, offset, low opacity.
         * Reads as light on a facet edge, not a horizontal star arm.
         */}
        <line
          x1={LINE_X + 0.5 * SPARKLE_SCALE}
          y1={glintCenterY - 1.25 * SPARKLE_SCALE}
          x2={LINE_X + 0.5 * SPARKLE_SCALE + EDGE_CATCH_LEN}
          y2={glintCenterY + 1 * SPARKLE_SCALE}
          stroke={STUDIO_WHITE}
          strokeWidth={0.75 * SPARKLE_SCALE}
          strokeLinecap="round"
          opacity={glintOpacity * EDGE_CATCH_OPACITY}
          style={glintStyle}
        />
      </svg>
    </div>
  );
}
