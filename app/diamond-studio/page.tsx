"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/* -------------------------------------------------------------------------- */
/* Types & tables                                                             */
/* -------------------------------------------------------------------------- */

type ShapeId =
  | "round"
  | "oval"
  | "cushion"
  | "princess"
  | "marquise"
  | "pear"
  | "emerald"
  | "radiant"
  | "asscher";

type ThemeId = "light" | "dark";
type SkinToneId = "light" | "medium" | "dark";
type StoneOrientation = "ns" | "ew";

const FINGER_IMAGES: Record<SkinToneId, string> = {
  light: "/diamond-tech-suite/finger/finger-light.png",
  medium: "/diamond-tech-suite/finger/finger-medium.png",
  dark: "/diamond-tech-suite/finger/finger-dark.png",
};

/** Round brilliant face-up diameter (mm) — industry-style anchors, linear interpolation */
const ROUND_BRILLIANT_MM_BY_CARAT: Record<number, number> = {
  0.5: 5.1,
  1.0: 6.5,
  1.5: 7.3,
  2.0: 8.1,
  2.5: 8.8,
  3.0: 9.3,
  4.0: 10.2,
  5.0: 11.0,
};

function getRoundDiamondMm(carat: number): number {
  const table = ROUND_BRILLIANT_MM_BY_CARAT;
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const loK = keys[0]!;
  const hiK = keys[keys.length - 1]!;
  if (carat <= loK) return table[loK]!;
  if (carat >= hiK) return table[hiK]!;
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i]!;
    const hi = keys[i + 1]!;
    if (carat >= lo && carat <= hi) {
      const t = (carat - lo) / (hi - lo);
      const a = table[lo]!;
      const b = table[hi]!;
      return a + (b - a) * t;
    }
  }
  return table[hiK]!;
}

const RING_SIZE_TO_MM: Record<number, number> = {
  4.0: 14.86,
  4.5: 15.27,
  5.0: 15.7,
  5.5: 16.1,
  6.0: 16.51,
  6.5: 16.92,
  7.0: 17.32,
  7.5: 17.73,
  8.0: 18.14,
  8.5: 18.54,
  9.0: 18.95,
  9.5: 19.35,
  10.0: 19.76,
};

const SHAPE_ANCHORS: Record<
  ShapeId,
  Record<number, [number, number]>
> = {
  round: {
    0.5: [5.15, 5.15],
    0.75: [5.9, 5.9],
    1.0: [6.5, 6.5],
    1.5: [7.4, 7.4],
    2.0: [8.1, 8.1],
    2.5: [8.7, 8.7],
    3.0: [9.3, 9.3],
    4.0: [10.2, 10.2],
    5.0: [11.0, 11.0],
  },
  oval: {
    0.5: [4.2, 6.0],
    0.75: [4.8, 6.9],
    1.0: [5.3, 7.7],
    1.5: [6.1, 8.8],
    2.0: [6.8, 9.8],
    2.5: [7.3, 10.5],
    3.0: [7.8, 11.3],
    4.0: [8.6, 12.5],
    5.0: [9.3, 13.5],
  },
  cushion: {
    0.5: [4.8, 4.95],
    0.75: [5.5, 5.7],
    1.0: [6.0, 6.2],
    1.5: [6.8, 7.0],
    2.0: [7.5, 7.75],
    2.5: [8.1, 8.4],
    3.0: [8.6, 8.9],
    4.0: [9.5, 9.8],
    5.0: [10.2, 10.55],
  },
  princess: {
    0.5: [4.5, 4.5],
    0.75: [5.2, 5.2],
    1.0: [5.5, 5.5],
    1.5: [6.3, 6.3],
    2.0: [7.0, 7.0],
    2.5: [7.5, 7.5],
    3.0: [8.0, 8.0],
    4.0: [8.8, 8.8],
    5.0: [9.5, 9.5],
  },
  marquise: {
    0.5: [3.5, 7.0],
    0.75: [4.0, 8.0],
    1.0: [4.5, 9.0],
    1.5: [5.2, 10.4],
    2.0: [5.8, 11.6],
    2.5: [6.3, 12.6],
    3.0: [6.8, 13.6],
    4.0: [7.5, 15.0],
    5.0: [8.1, 16.2],
  },
  pear: {
    0.5: [4.3, 6.5],
    0.75: [4.9, 7.4],
    1.0: [5.4, 8.1],
    1.5: [6.2, 9.3],
    2.0: [6.9, 10.4],
    2.5: [7.4, 11.2],
    3.0: [7.9, 11.9],
    4.0: [8.7, 13.1],
    5.0: [9.4, 14.1],
  },
  emerald: {
    0.5: [4.1, 5.8],
    0.75: [4.7, 6.6],
    1.0: [5.2, 7.3],
    1.5: [5.9, 8.3],
    2.0: [6.5, 9.2],
    2.5: [7.0, 9.8],
    3.0: [7.4, 10.4],
    4.0: [8.2, 11.5],
    5.0: [8.8, 12.3],
  },
  radiant: {
    0.5: [4.5, 5.4],
    0.75: [5.1, 6.1],
    1.0: [5.6, 6.7],
    1.5: [6.4, 7.7],
    2.0: [7.1, 8.5],
    2.5: [7.6, 9.1],
    3.0: [8.1, 9.7],
    4.0: [8.9, 10.7],
    5.0: [9.6, 11.5],
  },
  asscher: {
    0.5: [4.4, 4.4],
    0.75: [5.0, 5.0],
    1.0: [5.5, 5.5],
    1.5: [6.3, 6.3],
    2.0: [7.0, 7.0],
    2.5: [7.5, 7.5],
    3.0: [8.0, 8.0],
    4.0: [8.8, 8.8],
    5.0: [9.5, 9.5],
  },
};

const SHAPE_LABELS: Record<ShapeId, string> = {
  round: "Round",
  oval: "Oval",
  cushion: "Cushion",
  princess: "Princess",
  marquise: "Marquise",
  pear: "Pear",
  emerald: "Emerald",
  radiant: "Radiant",
  asscher: "Asscher",
};

const COVERAGE_ZONES = {
  understated: {
    min: 0,
    max: 40,
    label: "Understated Presence",
    helper: "Quiet on the hand, with a refined and discreet scale.",
  },
  balanced: {
    min: 40,
    max: 52,
    label: "Balanced Presence",
    helper: "A natural everyday range with visible presence and restraint.",
  },
  noticeable: {
    min: 52,
    max: 62,
    label: "Noticeable Presence",
    helper: "Clearly present on the hand while still feeling wearable.",
  },
  statement: {
    min: 62,
    max: 75,
    label: "Statement Presence",
    helper: "A confident look with strong visual impact.",
  },
  dramatic: {
    min: 75,
    max: 100,
    label: "Dramatic Presence",
    helper: "A bold, high-impact scale that becomes the center of attention.",
  },
} as const;

type ZoneKey = keyof typeof COVERAGE_ZONES;

const ZONE_ORDER: ZoneKey[] = [
  "understated",
  "balanced",
  "noticeable",
  "statement",
  "dramatic",
];

const SHAPE_PRESENCE_MOD: Partial<Record<ShapeId, number>> = {
  marquise: 6,
  pear: 5,
  oval: 5,
  emerald: 2,
  radiant: 1,
  round: 0,
  cushion: 0,
  princess: -2,
  asscher: -2,
};

const CARAT_MIN = 0.5;
const CARAT_MAX = 5.0;

/** Width on viewer = (mm / finger mm) * factor; +3% vs original 0.46 for truer visual coverage */
const STONE_VIEWER_WIDTH_FACTOR = 0.46 * 1.03;
/** Render-only: on-stage diamond scale; does not affect mm readout or coverage */
const DIAMOND_VISUAL_COMPENSATION = 1.06;

/**
 * On-stage scale per shape (layer cqw only). Readout/coverage use mm from
 * {@link faceAxesForSizing} / {@link getRoundDiamondMm} — not these factors.
 */
const SHAPE_RENDER_VISUAL_COMP: Record<ShapeId, number> = {
  round: DIAMOND_VISUAL_COMPENSATION,
  oval: 1.58,
  cushion: 1.12,
  princess: 1.12,
  marquise: 2.15,
  pear: 1.66,
  emerald: 1.48,
  radiant: 1.28,
  asscher: 1.14,
};

function renderVisualCompensation(shapeId: ShapeId): number {
  return SHAPE_RENDER_VISUAL_COMP[shapeId];
}

/** Diamond stack vertical anchor (% of viewer height) */
const RING_CLUSTER_TOP_PCT = 63.5;

/** Main preview stone translateY extra (px): desktop shank seat. */
const DIAMOND_Y_NUDGE_DESKTOP_PX = 12;
/** Additional translateY (px) on viewports <=768px only (target band ~14–20px). */
const mobileDiamondYOffset = 18;

function subscribeMaxWidth768(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(max-width: 768px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function snapshotMaxWidth768() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

function serverSnapshotMaxWidth768() {
  return false;
}

const DIAMOND_SHAPE_FALLBACK = "/diamond-tech-suite/diamonds/round.png";

function ShapeStripThumb({ imageUrl }: { imageUrl: string }) {
  const [src, setSrc] = useState(imageUrl);
  useEffect(() => {
    setSrc(imageUrl);
  }, [imageUrl]);
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      className="dts-shape-thumb-img"
      onError={() =>
        setSrc((p) => (p === DIAMOND_SHAPE_FALLBACK ? p : DIAMOND_SHAPE_FALLBACK))
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Math                                                                       */
/* -------------------------------------------------------------------------- */

function interpAnchors(
  anchors: Record<number, [number, number]>,
  carat: number,
): [number, number] {
  const keys = Object.keys(anchors)
    .map(Number)
    .sort((a, b) => a - b);
  const loK = keys[0]!;
  const hiK = keys[keys.length - 1]!;
  if (carat <= loK) return anchors[loK]!;
  if (carat >= hiK) return anchors[hiK]!;
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i]!;
    const hi = keys[i + 1]!;
    if (carat >= lo && carat <= hi) {
      const t = (carat - lo) / (hi - lo);
      const [wL, lL] = anchors[lo]!;
      const [wH, lH] = anchors[hi]!;
      return [wL + (wH - wL) * t, lL + (lH - lL) * t];
    }
  }
  return anchors[hiK]!;
}

function shapeDimensionsMm(shape: ShapeId, carat: number): [number, number] {
  return interpAnchors(SHAPE_ANCHORS[shape] ?? SHAPE_ANCHORS.round, carat);
}

function caratToWidthMm(shape: ShapeId, carat: number): number {
  return shapeDimensionsMm(shape, carat)[0];
}

/** Face-up width × length (mm), shorter × longer; linear interpolation between carats. */
const OVAL_FACE_MM_BY_CARAT: Record<number, [number, number]> = {
  0.5: [4.0, 6.0],
  1.0: [5.5, 8.0],
  1.5: [6.5, 9.0],
  2.0: [7.0, 10.0],
  2.5: [7.5, 10.5],
  3.0: [8.0, 11.5],
  4.0: [9.0, 12.5],
  5.0: [10.0, 14.0],
};

function ovalFaceDimensionsMm(carat: number): [width: number, length: number] {
  return interpAnchors(OVAL_FACE_MM_BY_CARAT, carat);
}

function ovalLengthOverWidthAt1ct(): number {
  const [w, l] = ovalFaceDimensionsMm(1);
  return l / Math.max(w, 1e-9);
}

/** Cushion MVP: square face-up, slightly under round-brilliant spread. */
const CUSHION_SPREAD_FACTOR = 0.96;

function cushionFaceDimensionsMm(carat: number): [number, number] {
  const d = getRoundDiamondMm(carat) * CUSHION_SPREAD_FACTOR;
  return [d, d];
}

/** Princess MVP: square, round spread × factor. */
const PRINCESS_SPREAD_FACTOR = 0.92;
function princessFaceDimensionsMm(carat: number): [number, number] {
  const d = getRoundDiamondMm(carat) * PRINCESS_SPREAD_FACTOR;
  return [d, d];
}

const RADIANT_WIDTH_FACTOR = 0.95;
const RADIANT_LENGTH_RATIO = 1.3;
function radiantFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * RADIANT_WIDTH_FACTOR;
  const l = w * RADIANT_LENGTH_RATIO;
  return [w, l];
}

const EMERALD_WIDTH_FACTOR = 0.93;
const EMERALD_LENGTH_RATIO = 1.4;
function emeraldFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * EMERALD_WIDTH_FACTOR;
  const l = w * EMERALD_LENGTH_RATIO;
  return [w, l];
}

const MARQUISE_WIDTH_FACTOR = 0.75;
const MARQUISE_LENGTH_RATIO = 2.0;
function marquiseFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * MARQUISE_WIDTH_FACTOR;
  const l = w * MARQUISE_LENGTH_RATIO;
  return [w, l];
}

const PEAR_WIDTH_FACTOR = 0.82;
const PEAR_LENGTH_RATIO = 1.55;
function pearFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * PEAR_WIDTH_FACTOR;
  const l = w * PEAR_LENGTH_RATIO;
  return [w, l];
}

/** Asscher MVP: square, round spread × factor. */
const ASSCHER_SPREAD_FACTOR = 0.9;
function asscherFaceDimensionsMm(carat: number): [number, number] {
  const d = getRoundDiamondMm(carat) * ASSCHER_SPREAD_FACTOR;
  return [d, d];
}

function faceAxesForSizing(
  shape: ShapeId,
  carat: number,
): [width: number, length: number] {
  switch (shape) {
    case "oval":
      return ovalFaceDimensionsMm(carat);
    case "cushion":
      return cushionFaceDimensionsMm(carat);
    case "princess":
      return princessFaceDimensionsMm(carat);
    case "radiant":
      return radiantFaceDimensionsMm(carat);
    case "emerald":
      return emeraldFaceDimensionsMm(carat);
    case "marquise":
      return marquiseFaceDimensionsMm(carat);
    case "pear":
      return pearFaceDimensionsMm(carat);
    case "asscher":
      return asscherFaceDimensionsMm(carat);
    default:
      return shapeDimensionsMm(shape, carat);
  }
}

/** Horizontal stone span (mm) for coverage % — round stays on anchor width; others use N/S vs E/W. */
function coverageStoneWidthMm(
  shape: ShapeId,
  carat: number,
  orientation: StoneOrientation,
): number {
  if (shape === "round") return caratToWidthMm(shape, carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return orientation === "ns" ? Math.min(w, l) : Math.max(w, l);
}

/** Horizontal span (mm) for on-stage width % — round uses round-brilliant table (unchanged). */
function renderStoneWidthMm(
  shape: ShapeId,
  carat: number,
  orientation: StoneOrientation,
): number {
  if (shape === "round") return getRoundDiamondMm(carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return orientation === "ns" ? Math.min(w, l) : Math.max(w, l);
}

/** Vertical span (mm) for layer aspect ratio — round unchanged; elongated stones swap with orientation. */
function renderStoneHeightMm(
  shape: ShapeId,
  carat: number,
  orientation: StoneOrientation,
): number {
  if (shape === "round") return getRoundDiamondMm(carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return orientation === "ns" ? Math.max(w, l) : Math.min(w, l);
}

function coveragePct(
  shape: ShapeId,
  carat: number,
  ringSize: number,
  orientation: StoneOrientation,
): number {
  const w = coverageStoneWidthMm(shape, carat, orientation);
  const d = RING_SIZE_TO_MM[ringSize] ?? 16.51;
  return Math.round((w / d) * 100);
}

function classifyZone(pct: number): ZoneKey {
  for (const k of ZONE_ORDER) {
    if (pct < COVERAGE_ZONES[k].max) return k;
  }
  return "dramatic";
}

function caratTierFloor(carat: number): number {
  if (carat >= 5.0) return 78;
  if (carat >= 4.0) return 65;
  if (carat >= 3.0) return 55;
  if (carat >= 2.0) return 42;
  if (carat >= 1.0) return 30;
  return 0;
}

function getPresenceScore(
  shape: ShapeId,
  carat: number,
  ringSize: number,
  orientation: StoneOrientation,
): number {
  return Math.max(
    coveragePct(shape, carat, ringSize, orientation) +
      (SHAPE_PRESENCE_MOD[shape] ?? 0),
    caratTierFloor(carat),
  );
}

function classifyPresence(
  shape: ShapeId,
  carat: number,
  ringSize: number,
  orientation: StoneOrientation,
): ZoneKey {
  return classifyZone(getPresenceScore(shape, carat, ringSize, orientation));
}

function articleFor(shape: ShapeId): "A" | "An" {
  return /^[aeiou]/i.test(SHAPE_LABELS[shape]) ? "An" : "A";
}

/* -------------------------------------------------------------------------- */
/* Scoped styles (theme + pieces that need raw CSS)                           */
/* -------------------------------------------------------------------------- */

function SuiteStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .dts-shell[data-theme="light"]{
        --gold: oklch(0.74 0.090 70);
        --gold-soft: oklch(0.84 0.060 75);
        --gold-warm: oklch(0.68 0.110 65);
        --topnav-active: oklch(0.41 0.032 58);
        --topnav-idle: oklch(0.36 0.012 60);
        --bg: oklch(0.965 0.008 75);
        --bg-deep: oklch(0.945 0.010 70);
        --card: oklch(0.985 0.006 78);
        --card-edge: oklch(0.93 0.006 72);
        --ink: oklch(0.28 0.012 60);
        --ink-soft: oklch(0.46 0.011 62);
        --ink-mute: oklch(0.62 0.010 65);
        --hairline: oklch(0.86 0.008 70);
        --hairline-soft: oklch(0.92 0.006 72);
        --pill-active: oklch(0.94 0.024 75);
        --pill-edge: oklch(0.82 0.040 70);
        --shadow-1: 0 1px 2px oklch(0.55 0.012 65 / 0.05), 0 8px 22px oklch(0.45 0.012 65 / 0.05);
        --shadow-2: 0 1px 1px oklch(0.55 0.012 65 / 0.04), 0 12px 40px oklch(0.45 0.012 65 / 0.09);
        --sb-thumb: oklch(0.62 0.006 72 / 0.09);
        --sb-thumb-hover: oklch(0.48 0.008 68 / 0.22);
      }
      .dts-shell[data-theme="dark"]{
        --gold: oklch(0.74 0.090 70);
        --gold-soft: oklch(0.84 0.060 75);
        --gold-warm: oklch(0.68 0.110 65);
        --topnav-active: oklch(0.74 0.044 72);
        --topnav-idle: oklch(0.82 0.011 70);
        --bg: oklch(0.18 0.010 60);
        --bg-deep: oklch(0.15 0.010 60);
        --card: oklch(0.22 0.012 62);
        --card-edge: oklch(0.27 0.011 64);
        --ink: oklch(0.94 0.012 75);
        --ink-soft: oklch(0.78 0.012 70);
        --ink-mute: oklch(0.58 0.012 65);
        --hairline: oklch(0.34 0.012 65);
        --hairline-soft: oklch(0.26 0.010 62);
        --pill-active: oklch(0.30 0.030 70);
        --pill-edge: oklch(0.46 0.060 70);
        --shadow-1: 0 1px 2px oklch(0 0 0 / 0.26), 0 8px 24px oklch(0 0 0 / 0.34);
        --shadow-2: 0 1px 1px oklch(0 0 0 / 0.22), 0 12px 40px oklch(0 0 0 / 0.46);
        --sb-thumb: oklch(0.36 0.006 64 / 0.12);
        --sb-thumb-hover: oklch(0.48 0.008 65 / 0.28);
      }
      @media (min-width: 769px) {
        html.diamond-studio-viewport-lock,
        html.diamond-studio-viewport-lock body{
          overflow:hidden !important;
          height:100vh !important;
          max-height:100vh !important;
        }
        html.diamond-studio-viewport-lock body > div,
        html.diamond-studio-viewport-lock body main{
          min-height:0 !important;
          height:100vh !important;
          max-height:100vh !important;
          overflow:hidden !important;
        }
      }
      .dts-shell{
        --dt-ease: cubic-bezier(0.28, 0.11, 0.22, 1);
        --dt-dur: 260ms;
        --dt-dur-mid: 300ms;
        --dt-dur-slow: 340ms;
        --grot: var(--font-geist-sans), system-ui, sans-serif;
        --serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--grot);
        font-weight: 400;
        font-feature-settings: "liga", "lnum", "tnum";
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        transition: background 600ms ease, color 600ms ease;
      }
      .dts-shell::before{
        content:"";
        position:fixed; inset:0;
        pointer-events:none;
        background: radial-gradient(ellipse 60% 55% at 50% 38%,
          oklch(from var(--bg) calc(l + 0.02) c h) 0%,
          var(--bg) 60%,
          var(--bg-deep) 100%);
        z-index:0;
        transition: background 600ms ease;
      }
      .dts-app{ position:relative; z-index:1; width:100%; height:100%;
        display:grid; grid-template-rows:minmax(60px,auto) 1fr; }
      @media (min-width: 769px) {
        .dts-shell{
          height:100vh;
          max-height:100vh;
          overflow:hidden;
        }
        .dts-app{
          height:100vh;
          max-height:100vh;
          overflow:hidden;
          grid-template-rows:var(--dts-topbar-h, 60px) minmax(0, 1fr);
        }
        .dts-main{
          min-height:0;
          overflow:hidden;
        }
      }
      .dts-topbar{
        display:grid;
        grid-template-columns: minmax(108px, auto) 1fr auto;
        align-items:stretch;
        column-gap:14px;
        row-gap:0;
        padding:0 28px;
        min-height:60px;
        border-bottom:1px solid oklch(from var(--hairline-soft) l c h / 0.76);
        box-shadow:0 1px 0 oklch(from var(--hairline) l c h / 0.06),
          0 14px 28px oklch(from var(--bg-deep) l c h / 0.04);
      }
      .dts-topbar-brand{
        display:flex; align-items:center; align-self:center;
        padding-right:2px;
      }
      .dts-brand-name{
        font-size:9px; font-weight:500; letter-spacing:0.125em; color:var(--ink-soft);
        line-height:1.35;
        opacity:0.88;
        transition:opacity var(--dt-dur-mid) var(--dt-ease), color var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-topbar-brand:hover .dts-brand-name{
        opacity:0.94;
        color:oklch(from var(--ink-soft) calc(l - 0.03) c h);
      }
      .dts-topnav{
        display:flex; align-items:flex-end; justify-content:center;
        gap:clamp(30px, 5.6vw, 72px);
        min-width:0;
        margin-left:-6px;
        overflow-x:auto;
        overflow-y:hidden;
        padding:10px 4px 0;
        scrollbar-width:none;
        -ms-overflow-style:none;
      }
      .dts-topnav::-webkit-scrollbar{ display:none; }
      .dts-topnav-item{
        display:flex; flex-direction:column; align-items:center; justify-content:flex-end;
        gap:5px;
        flex:0 0 auto;
        min-width:0;
        text-align:center;
        user-select:none;
        position:relative;
        padding:0 2px 10px;
      }
      .dts-topnav-item.is-active .dts-topnav-label{
        color:oklch(from var(--ink) calc(l - 0.024) calc(c + 0.006) h);
        font-weight:600;
        letter-spacing:0.105em;
      }
      .dts-topnav-item.is-active::after{
        content:"";
        position:absolute;
        left:50%;
        bottom:2px;
        transform:translateX(-50%);
        width:min(100%, 172px);
        height:1px;
        background:linear-gradient(90deg, transparent,
          oklch(from var(--gold-warm) calc(l - 0.04) c h / 0.62) 18%,
          oklch(from var(--gold-warm) calc(l - 0.04) c h / 0.62) 82%, transparent);
        opacity:0.98;
      }
      .dts-topnav-label{
        font-size:10px; font-weight:500; letter-spacing:0.11em;
        text-transform:uppercase; color:var(--topnav-idle);
        white-space:nowrap;
        line-height:1.28;
        transition:color var(--dt-dur-mid) var(--dt-ease), opacity var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-topnav-item:not(.is-active):hover .dts-topnav-label{
        color:oklch(from var(--topnav-idle) calc(l - 0.04) c h);
      }
      .dts-topnav-soon{
        font-size:6.5px; font-weight:400; letter-spacing:0.12em;
        text-transform:uppercase; color:var(--ink-mute);
        opacity:0.38;
        line-height:1.18;
        margin-top:1px;
        transition:opacity var(--dt-dur-slow) var(--dt-ease), color var(--dt-dur-slow) var(--dt-ease);
      }
      .dts-topnav-item:not(.is-active):hover .dts-topnav-soon{
        opacity:0.46;
      }
      .dts-topbar-actions{
        display:flex; align-items:center; align-self:center; justify-content:flex-end;
        gap:10px;
      }
      .dts-theme-toggle{
        display:flex; align-items:center; gap:7px; background:var(--hairline-soft);
        border:none; cursor:pointer; padding:5px 9px; border-radius:999px;
        font-size:10px; font-weight:500; letter-spacing:0.16em; color:var(--ink-soft);
        transition:background var(--dt-dur-mid) var(--dt-ease), color var(--dt-dur-mid) var(--dt-ease),
          box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-theme-toggle:hover{
        color:var(--ink);
        background:oklch(from var(--hairline-soft) l c h / 0.92);
        box-shadow:0 1px 0 oklch(from var(--hairline) l c h / 0.35);
      }
      .dts-theme-toggle svg{
        width:14px; height:14px; stroke:var(--ink-soft); fill:none; stroke-width:1.4;
        transition:stroke var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-theme-toggle:hover svg{ stroke:var(--ink); }
      .dts-main{
        display:grid;
        grid-template-columns:256px minmax(0, 1fr);
        grid-template-rows:minmax(0, 1fr);
        overflow:visible;
        min-height:0;
        flex:1 1 auto;
      }
      @media (min-width: 769px) {
        .diamond-studio-main.dts-main{
          display:grid !important;
          grid-template-columns:256px minmax(0, 1fr) !important;
          grid-template-rows:minmax(0, 1fr) !important;
          gap:0 !important;
          width:auto !important;
          flex-direction:unset !important;
        }
        .dts-control-rail{
          grid-column:1;
          grid-row:1;
          align-self:stretch;
          min-height:0;
          min-width:0;
          overflow-x:hidden;
          overflow-y:auto;
          overscroll-behavior:contain;
          padding:16px 18px 16px 22px;
          display:flex;
          flex-direction:column;
          gap:16px;
          scrollbar-width:none;
          -ms-overflow-style:none;
        }
        .dts-control-rail::-webkit-scrollbar{
          width:0;
          height:0;
        }
        .dts-control-rail > *{
          flex-shrink:0;
          overflow:visible;
          height:auto;
          max-height:none;
          position:static;
          margin:0;
        }
        .dts-stage-stack{
          grid-column:2;
          grid-row:1;
          align-self:stretch;
          min-width:0;
          min-height:0;
          display:flex;
          flex-direction:column;
          overflow:hidden;
        }
        .dts-stage-stack .dts-stage-preview{
          flex:1 1 auto;
          min-height:0;
          min-width:0;
          padding:14px 0 92px;
          justify-content:center;
        }
      }
      .dts-stage-stack{
        position:relative;
        display:flex;
        flex-direction:column;
        min-width:0;
        min-height:0;
        flex:1 1 auto;
      }
      .dts-stage-preview{
        position:relative;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        overflow:visible;
        padding:14px 0 22px;
        min-height:0;
        min-width:0;
      }
      .dts-card{
        background:var(--card); border:1px solid var(--card-edge); border-radius:12px;
        padding:14px 15px 15px; box-shadow:var(--shadow-1);
      }
      .dts-card--coverage{
        padding:16px 16px 18px;
        border-color:oklch(from var(--card-edge) l c h / 0.88);
        box-shadow:var(--shadow-1), 0 0 0 1px oklch(from var(--hairline-soft) l c h / 0.42) inset;
      }
      .dts-card-head{
        display:flex; align-items:center; justify-content:space-between;
        font-size:9.35px; font-weight:500; letter-spacing:0.168em; text-transform:uppercase;
        color:var(--ink-soft); margin:1px 0 12px;
      }
      .dts-info{
        width:13px; height:13px; border-radius:50%; border:1px solid oklch(from var(--ink-mute) l c h / 0.75);
        color:var(--ink-mute); font-family:var(--serif); font-style:italic; font-size:9px;
        display:grid; place-items:center; cursor:help; line-height:1;
        opacity:0.92;
        transition:border-color var(--dt-dur-mid) var(--dt-ease), opacity var(--dt-dur-mid) var(--dt-ease), color var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-info:hover{
        border-color:oklch(from var(--ink-mute) l c h / 0.95);
        opacity:1;
      }
      .dts-stepper{
        display:flex; align-items:center; justify-content:center; gap:14px;
        margin:4px 0 10px;
      }
      .dts-stepper button{
        width:24px; height:24px; border-radius:50%; border:1px solid var(--hairline);
        background:var(--card); color:var(--ink-soft); cursor:pointer;
        display:grid; place-items:center;
        transition:border-color var(--dt-dur-mid) var(--dt-ease), color var(--dt-dur-mid) var(--dt-ease),
          background-color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease);
        font-size:13px; line-height:1; padding:0;
      }
      .dts-stepper button:hover:not(:disabled){
        border-color:var(--ink-soft); color:var(--ink);
        background:oklch(from var(--card) l c h / 0.98);
        box-shadow:0 1px 2px oklch(from var(--hairline) l c h / 0.5);
      }
      .dts-stepper button:disabled{ opacity:0.35; cursor:default; }
      .dts-stepper .dts-step-val{
        font-family:var(--serif); font-weight:400; font-size:28px; line-height:1;
        color:var(--ink); font-variant-numeric:tabular-nums lining-nums;
        min-width:56px; text-align:center;
      }
      .dts-slider{ position:relative; margin:8px 4px 4px; }
      .dts-slider .dts-track{
        position:relative; height:1px; background:var(--hairline); margin:12px 8px 10px;
      }
      .dts-slider .dts-handle{
        position:absolute; top:50%; width:12px; height:12px; border-radius:50%;
        background:var(--card); border:1px solid var(--ink-soft);
        transform:translate(-50%,-50%); cursor:grab;
        box-shadow:0 1px 3px oklch(0 0 0 / 0.10);
        transition:border-color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease),
          background-color var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-slider .dts-handle:hover{
        box-shadow:0 2px 6px oklch(0 0 0 / 0.08);
        border-color:oklch(from var(--ink-soft) l c h / 0.95);
      }
      .dts-slider .dts-handle:active{ cursor:grabbing; border-color:var(--gold-warm); }
      .dts-ticks{
        display:flex; justify-content:space-between; margin:8px 0 2px; padding:0 2px;
        font-size:10px; color:var(--ink-mute); font-variant-numeric:tabular-nums;
      }
      .dts-ticks span{ width:16px; text-align:center; transition:color var(--dt-dur-mid) var(--dt-ease); cursor:pointer; }
      .dts-ticks span.is-current{ color:var(--ink); font-weight:500; }
      .dts-ticks-carat{
        position:relative; display:block; margin:8px 8px 2px; height:16px;
        font-size:10px; color:var(--ink-mute); font-variant-numeric:tabular-nums;
      }
      .dts-ticks-carat span{
        position:absolute; top:0; left:0;
        transform:translateX(-50%);
        width:auto; min-width:18px; text-align:center;
        transition:color var(--dt-dur-mid) var(--dt-ease);
        cursor:pointer;
      }
      .dts-ticks-carat span.is-current{ color:var(--ink); font-weight:500; }
      .dts-card .dts-card-note{
        margin:8px 0 0;
        padding:0 2px;
        font-size:10.5px;
        line-height:1.45;
        color:var(--ink-soft);
        letter-spacing:0.01em;
        text-align:center;
        text-transform:none;
      }
      .dts-card .dts-card-note strong{
        font-family:var(--serif);
        font-size:12.5px;
        font-weight:400;
        color:var(--ink);
        font-variant-numeric:tabular-nums;
      }
      .dts-skin-row{
        display:flex; gap:6px; flex-wrap:wrap; justify-content:stretch;
      }
      .dts-skin-pill{
        flex:1 1 0; min-width:0;
        padding:7px 6px; border-radius:8px;
        border:1px solid var(--hairline);
        background:var(--hairline-soft);
        font-size:8.5px; font-weight:500; letter-spacing:0.16em; text-transform:uppercase;
        color:var(--ink-soft); cursor:pointer;
        transition:background var(--dt-dur-mid) var(--dt-ease), border-color var(--dt-dur-mid) var(--dt-ease),
          color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-skin-pill:hover{
        border-color:var(--ink-soft); color:var(--ink);
        background:oklch(from var(--hairline-soft) l c h / 0.88);
        box-shadow:0 1px 0 oklch(from var(--hairline) l c h / 0.25);
      }
      .dts-skin-pill.is-selected{
        background:var(--pill-active);
        border-color:var(--pill-edge);
        color:var(--ink);
        transition:background var(--dt-dur-slow) var(--dt-ease), border-color var(--dt-dur-slow) var(--dt-ease),
          color var(--dt-dur-slow) var(--dt-ease), box-shadow var(--dt-dur-slow) var(--dt-ease);
      }
      .dts-cov-pct{
        text-align:center; margin:8px 0 8px;
        font-family:var(--serif); font-size:32px; color:var(--ink); line-height:1.08; font-variant-numeric:tabular-nums;
      }
      .dts-cov-label{
        font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:var(--ink-soft); margin-top:6px; text-align:center;
      }
      .dts-zone-bar{ margin-top:17px; }
      .dts-zones{ position:relative; height:5px; border-radius:3px; background:var(--hairline-soft); margin:0 0 11px; }
      .dts-zone-active{
        position:absolute; top:0; bottom:0; background:var(--gold); border-radius:2px;
        transition:left var(--dt-dur-slow) var(--dt-ease), width var(--dt-dur-slow) var(--dt-ease);
      }
      .dts-zone-handle{
        position:absolute; top:50%; width:10px; height:10px; border-radius:50%;
        background:var(--card); border:1px solid var(--gold-warm);
        transform:translate(-50%,-50%);
        transition:left var(--dt-dur-slow) var(--dt-ease), border-color var(--dt-dur-mid) var(--dt-ease),
          box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-zone-labels{
        display:flex; justify-content:space-between; align-items:center; margin-top:10px;
        font-size:7.5px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-mute);
      }
      .dts-zone-labels .dts-endcap{ flex:0 0 auto; opacity:0.55; }
      .dts-zone-labels .dts-active-lbl{ flex:1 1 auto; text-align:center; color:var(--gold-warm); font-weight:600; letter-spacing:0.18em; }
      .dts-cov-helper{
        font-family:var(--serif); font-style:italic; font-size:12.5px; line-height:1.42;
        color:var(--ink-soft); margin:14px 2px 0; text-align:center; text-wrap:pretty;
      }
      .dts-stage-canvas{
        position:relative;
        display:flex;
        justify-content:center;
        width:100%;
        min-width:0;
        flex:0 0 auto;
      }
      .dts-viewer{
        position:relative; width:min(578px,93.5%); aspect-ratio:7/9; max-height:96%;
        container-type:size;
        overflow:visible;
      }
      .dts-layer-finger{
        position:absolute; inset:0; z-index:1; overflow:hidden;
        isolation:isolate;
      }
      .dts-layer-finger img{
        position:relative; z-index:0;
        width:100%; height:100%; object-fit:cover; object-position:50% 42%;
        filter:
          blur(0.42px)
          saturate(0.93)
          hue-rotate(-1.5deg)
          drop-shadow(2px 7px 20px oklch(0.42 0.010 62 / 0.14));
      }
      .dts-layer-finger::before{
        content:"";
        position:absolute; inset:0; z-index:1; pointer-events:none;
        background:linear-gradient(180deg,
          oklch(1 0 0 / 0.04) 0%,
          transparent 40%,
          oklch(0.38 0.012 58 / 0.05) 78%,
          oklch(0.32 0.014 55 / 0.09) 100%);
        mix-blend-mode:soft-light;
      }
      .dts-layer-finger::after{
        content:"";
        position:absolute; inset:0; z-index:1; pointer-events:none;
        background:
          linear-gradient(90deg,
            oklch(0.22 0.03 42 / 0.11) 0%,
            transparent 10%,
            transparent 90%,
            oklch(0.22 0.03 42 / 0.11) 100%),
          radial-gradient(ellipse 95% 48% at 50% 100%,
            oklch(0.28 0.02 55 / 0.14) 0%,
            transparent 52%),
          radial-gradient(ellipse 72% 30% at 50% 64%,
            oklch(0 0 0 / 0.092) 0%,
            transparent 62%),
          linear-gradient(180deg,
            transparent 52%,
            oklch(0.18 0.02 58 / 0.065) 100%);
        mix-blend-mode:multiply;
        opacity:0.9;
      }
      .dts-layer-diamond{
        position:absolute; left:50%; z-index:2; pointer-events:none;
        isolation:isolate;
        box-sizing:border-box;
        overflow:visible;
        transition:width var(--dt-dur-slow) var(--dt-ease),
          height var(--dt-dur-slow) var(--dt-ease),
          top var(--dt-dur-slow) var(--dt-ease),
          opacity 200ms var(--dt-ease);
      }
      .dts-diamond-stack{
        position:relative; width:100%; height:100%;
        overflow:visible;
      }
      .dts-diamond-stack::before{
        content:"";
        position:absolute;
        left:50%;
        bottom:clamp(0px, 1.1cqw, 10px);
        width:56%;
        height:24%;
        transform:translate(-50%, 26%);
        background:radial-gradient(ellipse 50% 34% at 50% 26%,
          oklch(0 0 0 / 0.21) 0%,
          transparent 72%);
        filter:blur(4px);
        pointer-events:none;
        z-index:0;
      }
      .dts-diamond-stack .dts-diamond-face{
        position:absolute; inset:0;
        width:100%; height:100%;
        z-index:1;
      }
      .dts-diamond-face{
        display:block; object-fit:contain;
        filter:
          blur(0.18px)
          saturate(0.94)
          contrast(1.01)
          brightness(1.01)
          drop-shadow(0 2px 4px rgba(0,0,0,0.14))
          drop-shadow(0 1px 1px rgba(0,0,0,0.06));
      }
      .dts-diamond-face.dts-diamond-face--ew{
        transform:rotate(90deg);
        transform-origin:center center;
      }
      .dts-layer-diamond.is-swapping{ opacity:0; }
      .dts-sentence{
        position:relative; margin:6px 12px 14px; text-align:center;
        font-family:var(--serif); font-weight:300; font-size:21px; color:var(--ink);
        letter-spacing:0.01em; pointer-events:none; z-index:30; flex:0 0 auto;
        line-height:1.35;
      }
      .dts-sentence .dts-article{ font-style:italic; color:var(--ink-soft); }
      .dts-shape-strip{
        position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
        display:flex; align-items:stretch; gap:7px; padding:7px 11px;
        background:oklch(from var(--card) l c h / 0.74);
        border:1px solid oklch(from var(--card-edge) l c h / 0.42);
        border-radius:16px;
        backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
        box-shadow:0 8px 28px oklch(from var(--hairline) l c h / 0.08),
          0 0 0 1px oklch(from var(--hairline-soft) l c h / 0.26) inset;
        z-index:20; white-space:nowrap;
        opacity:0.86;
      }
      .dts-shape-chip{
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
        padding:7px 6px 6px; border-radius:11px; border:1px solid transparent; cursor:pointer;
        background:transparent;
        transform-origin:center center;
        transition:background var(--dt-dur-slow) var(--dt-ease),
          border-color var(--dt-dur-slow) var(--dt-ease),
          box-shadow var(--dt-dur-slow) var(--dt-ease),
          transform var(--dt-dur-slow) var(--dt-ease);
        min-width:49px; flex:0 0 auto;
      }
      .dts-shape-chip{ background:oklch(from var(--hairline-soft) l c h / 0.72); }
      .dts-shape-chip:hover{
        transform:scale(1.01);
        background:oklch(from var(--hairline-soft) calc(l + 0.006) c h / 0.88);
        box-shadow:0 2px 8px oklch(from var(--hairline) l c h / 0.12);
      }
      .dts-shape-chip.is-selected:hover{
        transform:scale(1.004);
      }
      .dts-shape-chip.is-selected{
        background:oklch(from var(--pill-active) l c h / 0.52);
        border-color:oklch(from var(--pill-edge) l c h / 0.16);
        box-shadow:0 0 0 1px oklch(from var(--hairline) l c h / 0.16),
          0 2px 10px oklch(from var(--gold) l c h / 0.018);
        transition:background var(--dt-dur-slow) var(--dt-ease),
          border-color var(--dt-dur-slow) var(--dt-ease),
          box-shadow var(--dt-dur-slow) var(--dt-ease),
          transform var(--dt-dur-slow) var(--dt-ease);
      }
      .dts-shape-chip .dts-thumb{
        height:24.5px;
        max-height:26.5px;
        min-height:20px;
        width:26.5px;
        max-width:26.5px;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .dts-shape-thumb-img{
        max-height:24.5px;
        max-width:26.5px;
        width:auto;
        height:auto;
        object-fit:contain;
        display:block;
      }
      .dts-shape-chip .dts-name{
        font-size:7px; font-weight:500; letter-spacing:0.11em; text-transform:uppercase; color:var(--ink-soft);
        transition:color var(--dt-dur-slow) var(--dt-ease), opacity var(--dt-dur-slow) var(--dt-ease);
      }
      .dts-shape-chip.is-selected .dts-name{
        color:var(--ink);
        font-weight:500;
        opacity:0.9;
      }
      @media (max-width: 768px) {
        .dts-shell{
          overflow-x:hidden;
          overflow-y:auto;
          -webkit-overflow-scrolling:touch;
        }
        .dts-app{
          display:flex;
          flex-direction:column;
          min-height:100%;
          height:auto;
        }
        .dts-topbar{
          display:grid;
          grid-template-columns:1fr auto;
          grid-template-rows:auto auto;
          column-gap:14px;
          row-gap:10px;
          padding:12px 20px 14px;
          align-items:center;
          min-height:0;
        }
        .dts-topbar-brand{
          grid-column:1;
          grid-row:1;
          padding-right:0;
        }
        .dts-topbar-actions{
          grid-column:2;
          grid-row:1;
          justify-self:end;
          align-self:start;
        }
        .dts-topnav{
          grid-column:1 / -1;
          grid-row:2;
          margin-left:0;
          padding:2px 0 6px;
          justify-content:flex-start;
          gap:clamp(16px,4.5vw,28px);
          width:100%;
          min-width:0;
        }
        .dts-main{
          display:flex !important;
          flex-direction:column !important;
          width:100% !important;
          gap:32px;
          grid-template-columns:unset;
          grid-template-rows:unset;
          min-width:0;
          flex:1 1 auto;
          overflow:visible;
        }
        .dts-control-rail{
          display:contents;
        }
        .dts-main .dts-card[aria-label="Finger size"],
        .dts-main .dts-card[aria-label="Skin tone"],
        .dts-main .dts-card[aria-label="Stone orientation"]{
          order:1;
          width:100%;
          max-width:none;
          padding-left:20px;
          padding-right:20px;
          box-sizing:border-box;
        }
        .dts-main .dts-card[aria-label="Finger size"]{
          padding-top:20px;
        }
        .dts-main .dts-card[aria-label="Finger coverage"]{
          padding-bottom:36px;
        }
        .dts-stage-stack{
          width:100%;
          max-width:none;
          position:relative;
          transform:none;
          flex:0 0 auto;
          min-width:0;
          padding:0 20px 0;
          display:flex;
          flex-direction:column;
          align-items:stretch;
          gap:0;
          order:2;
        }
        .dts-main .dts-card[aria-label="Carat weight"],
        .dts-main .dts-card[aria-label="Finger coverage"]{
          order:3;
          width:100%;
          max-width:none;
          padding-left:20px;
          padding-right:20px;
          box-sizing:border-box;
        }
        .dts-stage-preview{
          width:100%;
          max-width:none;
          position:relative;
          transform:none;
          flex:0 0 auto;
          margin-top:0;
          padding:4px 0 8px;
          align-items:center;
          overflow-x:hidden;
          display:flex;
          flex-direction:column;
        }
        .dts-stage-canvas{
          display:flex;
          flex-direction:column;
          align-items:center;
          width:100%;
          min-width:0;
        }
        .dts-sentence{
          font-size:clamp(16.5px,4.4vw,18.5px);
          line-height:1.24;
          letter-spacing:0.006em;
          margin:0 auto 16px;
          padding:0 2px;
          max-width:min(22rem,100%);
          position:relative !important;
          inset:auto !important;
          transform:none !important;
          width:100%;
        }
        .dts-mobile-debug-725{
          margin:0 auto 12px;
          padding:10px 14px;
          max-width:100%;
          box-sizing:border-box;
          text-align:center;
          font:800 15px/1.2 system-ui,sans-serif;
          letter-spacing:0.06em;
          color:#fff;
          background:#b00020;
          border:2px solid #ff0;
          border-radius:8px;
        }
        .dts-viewer{
          width:100%;
          max-width:260px;
          min-width:0;
          margin:0 auto;
          max-height:min(50vh,360px);
          aspect-ratio:7 / 9.45;
        }
        .dts-layer-finger img{
          object-position:50% 40%;
        }
        .dts-shape-strip{
          position:relative !important;
          left:auto !important;
          right:auto !important;
          bottom:auto !important;
          inset:auto !important;
          transform:none !important;
          margin-top:24px;
          margin-bottom:24px;
          width:100%;
          max-width:none !important;
          min-width:0;
          justify-content:flex-start;
          flex-wrap:nowrap;
          overflow-x:auto;
          overflow-y:hidden;
          -webkit-overflow-scrolling:touch;
          gap:8px;
          padding:10px 12px 12px;
          scrollbar-width:none;
          -ms-overflow-style:none;
          align-self:stretch;
        }
        .dts-shape-strip::-webkit-scrollbar{ display:none; }
        .diamond-studio-main,
        .diamond-studio-grid,
        .studio-layout{
          display:flex !important;
          flex-direction:column !important;
          width:100% !important;
        }
        .shape-selector,
        .finger-preview,
        .studio-preview,
        .control-column{
          position:relative !important;
          inset:auto !important;
          transform:none !important;
          width:100% !important;
          max-width:none !important;
        }
        .dts-shape-chip{
          flex:0 0 auto;
          min-width:52px;
          min-height:48px;
          padding:8px 8px 7px;
          touch-action:manipulation;
        }
        .dts-shell[data-theme="light"] .dts-card,
        .dts-shell[data-theme="light"] .dts-card--coverage{
          box-shadow:0 1px 2px rgba(49,38,29,0.04), 0 5px 14px rgba(49,38,29,0.045);
        }
        .dts-shell[data-theme="dark"] .dts-card,
        .dts-shell[data-theme="dark"] .dts-card--coverage{
          box-shadow:0 1px 2px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.28);
        }
        .dts-card, .dts-card--coverage{
          padding:16px 17px 17px;
        }
        .dts-card--coverage{
          border-color:oklch(from var(--card-edge) l c h / 0.85);
        }
        .dts-stepper button{
          width:40px;
          height:40px;
          font-size:15px;
        }
        .dts-stepper .dts-step-val{
          font-size:26px;
        }
        .dts-skin-pill{
          min-height:40px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:9px 8px;
        }
        .dts-zone-handle{
          width:12px;
          height:12px;
        }
        .dts-cov-helper{
          padding:0 4px;
          margin-top:12px;
        }
      }
      @media (prefers-reduced-motion: reduce){
        .dts-shape-chip,
        .dts-shape-chip:hover,
        .dts-shape-chip.is-selected:hover{
          transform:none;
        }
        .dts-shape-chip,
        .dts-layer-diamond,
        .dts-zone-active,
        .dts-zone-handle,
        .dts-topnav-label,
        .dts-topnav-soon,
        .dts-skin-pill,
        .dts-stepper button,
        .dts-theme-toggle,
        .dts-slider .dts-handle,
        .dts-control-rail{
          transition-duration:0.01ms;
        }
      }
    `}} />
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const SHAPES: ShapeId[] = [
  "round",
  "oval",
  "cushion",
  "princess",
  "marquise",
  "pear",
  "emerald",
  "radiant",
  "asscher",
];

/**
 * Per-shape PNG, label, nominal length÷width (MVP), and face-up mm helper.
 * Stage sizing uses {@link faceAxesForSizing}; render-only boost uses
 * {@link SHAPE_RENDER_VISUAL_COMP}.
 */
const SHAPE_SUITE_CONFIG: Record<
  ShapeId,
  {
    id: ShapeId;
    label: string;
    image: string;
    aspectRatio: number;
    caratToFaceMm: (carat: number) => [number, number];
  }
> = {
  round: {
    id: "round",
    label: SHAPE_LABELS.round,
    image: "/diamond-tech-suite/diamonds/round.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => {
      const d = getRoundDiamondMm(carat);
      return [d, d];
    },
  },
  oval: {
    id: "oval",
    label: "Oval",
    image: "/diamond-tech-suite/diamonds/oval.png",
    aspectRatio: ovalLengthOverWidthAt1ct(),
    caratToFaceMm: (carat) => ovalFaceDimensionsMm(carat),
  },
  cushion: {
    id: "cushion",
    label: "Cushion",
    image: "/diamond-tech-suite/diamonds/cushion.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => cushionFaceDimensionsMm(carat),
  },
  princess: {
    id: "princess",
    label: SHAPE_LABELS.princess,
    image: "/diamond-tech-suite/diamonds/princess.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => princessFaceDimensionsMm(carat),
  },
  marquise: {
    id: "marquise",
    label: SHAPE_LABELS.marquise,
    image: "/diamond-tech-suite/diamonds/marquise.png",
    aspectRatio: MARQUISE_LENGTH_RATIO,
    caratToFaceMm: (carat) => marquiseFaceDimensionsMm(carat),
  },
  pear: {
    id: "pear",
    label: SHAPE_LABELS.pear,
    image: "/diamond-tech-suite/diamonds/pear.png",
    aspectRatio: PEAR_LENGTH_RATIO,
    caratToFaceMm: (carat) => pearFaceDimensionsMm(carat),
  },
  emerald: {
    id: "emerald",
    label: SHAPE_LABELS.emerald,
    image: "/diamond-tech-suite/diamonds/emerald.png",
    aspectRatio: EMERALD_LENGTH_RATIO,
    caratToFaceMm: (carat) => emeraldFaceDimensionsMm(carat),
  },
  radiant: {
    id: "radiant",
    label: SHAPE_LABELS.radiant,
    image: "/diamond-tech-suite/diamonds/radiant.png",
    aspectRatio: RADIANT_LENGTH_RATIO,
    caratToFaceMm: (carat) => radiantFaceDimensionsMm(carat),
  },
  asscher: {
    id: "asscher",
    label: SHAPE_LABELS.asscher,
    image: "/diamond-tech-suite/diamonds/asscher.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => asscherFaceDimensionsMm(carat),
  },
};

function DiamondStageFace({
  shapeId,
  orientation,
}: {
  shapeId: ShapeId;
  orientation: StoneOrientation;
}) {
  const targetSrc = SHAPE_SUITE_CONFIG[shapeId].image;
  const [faceSrc, setFaceSrc] = useState(targetSrc);

  useEffect(() => {
    setFaceSrc(targetSrc);
  }, [targetSrc]);

  return (
    <div className="dts-diamond-stack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faceSrc}
        alt=""
        className={`dts-diamond-face${orientation === "ew" ? " dts-diamond-face--ew" : ""}`}
        onError={() =>
          setFaceSrc((prev) =>
            prev === DIAMOND_SHAPE_FALLBACK ? prev : DIAMOND_SHAPE_FALLBACK,
          )
        }
      />
    </div>
  );
}

function attachHorizontalTrack(
  track: HTMLDivElement,
  draggingRef: React.MutableRefObject<boolean>,
  applyPct: (pct: number) => void,
) {
  const readPct = (clientX: number) => {
    const r = track.getBoundingClientRect();
    const x = clientX - r.left;
    return Math.max(0, Math.min(1, x / r.width));
  };
  const down = (ev: MouseEvent | TouchEvent) => {
    draggingRef.current = true;
    const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
    applyPct(readPct(cx));
    ev.preventDefault();
  };
  const move = (ev: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
    applyPct(readPct(cx));
  };
  const up = () => {
    draggingRef.current = false;
  };
  track.addEventListener("mousedown", down);
  track.addEventListener("touchstart", down, { passive: false });
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("mouseup", up);
  window.addEventListener("touchend", up);
  return () => {
    track.removeEventListener("mousedown", down);
    track.removeEventListener("touchstart", down);
    window.removeEventListener("mousemove", move);
    window.removeEventListener("touchmove", move);
    window.removeEventListener("mouseup", up);
    window.removeEventListener("touchend", up);
  };
}

const STUDIO_HEADER_NAV: { label: string; active: boolean }[] = [
  { label: "Diamond Size Studio", active: true },
  { label: "Shape Comparison", active: false },
  { label: "Light Performance", active: false },
];

export default function DiamondStudioPage() {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [skinTone, setSkinTone] = useState<SkinToneId>("light");
  const [ringSize, setRingSize] = useState(6.0);
  const [carat, setCarat] = useState(2.5);
  const [shape, setShape] = useState<ShapeId>("round");
  const [diamondVisualShape, setDiamondVisualShape] =
    useState<ShapeId>("round");
  const [diamondSwapping, setDiamondSwapping] = useState(false);
  const [stoneOrientation, setStoneOrientation] =
    useState<StoneOrientation>("ns");

  const isMobileViewport = useSyncExternalStore(
    subscribeMaxWidth768,
    snapshotMaxWidth768,
    serverSnapshotMaxWidth768,
  );
  const diamondOverlayYExtraPx = isMobileViewport
    ? mobileDiamondYOffset
    : DIAMOND_Y_NUDGE_DESKTOP_PX;

  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;

  const selectShape = useCallback((s: ShapeId) => {
    if (s === shape) return;
    if (swapTimer.current) clearTimeout(swapTimer.current);
    setShape(s);
    setDiamondSwapping(true);
    swapTimer.current = setTimeout(() => {
      setDiamondVisualShape(s);
      setDiamondSwapping(false);
      swapTimer.current = null;
    }, 200);
  }, [shape]);

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (swapTimer.current) {
      clearTimeout(swapTimer.current);
      swapTimer.current = null;
    }
    setDiamondSwapping(false);
    setDiamondVisualShape(shapeRef.current);
  }, [carat, ringSize]);

  const fingerMm = RING_SIZE_TO_MM[ringSize] ?? 16.51;
  const diamondReadoutMm =
    shape === "round"
      ? getRoundDiamondMm(carat)
      : renderStoneWidthMm(shape, carat, stoneOrientation);
  const cov = coveragePct(shape, carat, ringSize, stoneOrientation);
  const zone = classifyPresence(shape, carat, ringSize, stoneOrientation);
  const zoneMeta = COVERAGE_ZONES[zone];

  const rw = renderStoneWidthMm(diamondVisualShape, carat, stoneOrientation);
  const rh = renderStoneHeightMm(diamondVisualShape, carat, stoneOrientation);
  /** N/S vs E/W: swapped rw/rh on the layer box; E/W also rotates the face img 90deg (see dts-diamond-face--ew). */
  const stoneMmToStage =
    (STONE_VIEWER_WIDTH_FACTOR * renderVisualCompensation(diamondVisualShape)) /
    fingerMm;
  const layerWidthCqw = rw * stoneMmToStage * 100;
  const layerHeightCqw = rh * stoneMmToStage * 100;

  const zoneShort: Record<ZoneKey, string> = {
    understated: "Quiet",
    balanced: "Balanced",
    noticeable: "Noticed",
    statement: "Statement",
    dramatic: "Dramatic",
  };

  const setRingSizeClamped = useCallback((v: number) => {
    const stepped = Math.round(v * 2) / 2;
    const next = Math.max(4, Math.min(10, stepped));
    setRingSize((prev) => (prev === next ? prev : next));
  }, []);

  const setCaratClamped = useCallback((v: number) => {
    const step = v < 2 ? 0.05 : 0.1;
    const snapped = Math.round(v / step) * step;
    const next = Math.max(
      CARAT_MIN,
      Math.min(CARAT_MAX, Math.round(snapped * 100) / 100),
    );
    setCarat((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
  }, []);

  const fsTrackRef = useRef<HTMLDivElement>(null);
  const ctTrackRef = useRef<HTMLDivElement>(null);
  const fsDrag = useRef(false);
  const ctDrag = useRef(false);

  const fsPctToSize = (p: number) => 4 + p * 6;
  const ctPctToCarat = (p: number) => CARAT_MIN + p * (CARAT_MAX - CARAT_MIN);

  useEffect(() => {
    const el = fsTrackRef.current;
    if (!el) return;
    return attachHorizontalTrack(el, fsDrag, (p) =>
      setRingSizeClamped(fsPctToSize(p)),
    );
  }, [setRingSizeClamped]);

  useEffect(() => {
    const el = ctTrackRef.current;
    if (!el) return;
    return attachHorizontalTrack(el, ctDrag, (p) =>
      setCaratClamped(ctPctToCarat(p)),
    );
  }, [setCaratClamped]);

  const fsHandleLeft = ((ringSize - 4) / 6) * 100;
  const ctHandleLeft = ((carat - CARAT_MIN) / (CARAT_MAX - CARAT_MIN)) * 100;

  const themeIcon =
    theme === "light" ? (
      <path d="M 12 9.5 A 4.5 4.5 0 1 1 6.5 4 A 3.6 3.6 0 0 0 12 9.5 Z" />
    ) : (
      <>
        <circle cx="8" cy="8" r="3" />
        <line x1="8" y1="1" x2="8" y2="3" strokeLinecap="round" />
        <line x1="8" y1="13" x2="8" y2="15" strokeLinecap="round" />
        <line x1="1" y1="8" x2="3" y2="8" strokeLinecap="round" />
        <line x1="13" y1="8" x2="15" y2="8" strokeLinecap="round" />
        <line x1="3.2" y1="3.2" x2="4.6" y2="4.6" strokeLinecap="round" />
        <line x1="11.4" y1="11.4" x2="12.8" y2="12.8" strokeLinecap="round" />
        <line x1="3.2" y1="12.8" x2="4.6" y2="11.4" strokeLinecap="round" />
        <line x1="11.4" y1="4.6" x2="12.8" y2="3.2" strokeLinecap="round" />
      </>
    );

  return (
    <div className="dts-shell h-full w-full overflow-hidden" data-theme={theme}>
      <SuiteStyles />
      <div className="dts-app">
        <header className="dts-topbar">
          <div className="dts-topbar-brand">
            <span className="dts-brand-name">DIAMOND STUDIO</span>
          </div>
          <nav className="dts-topnav" aria-label="Diamond Studio tools">
            {STUDIO_HEADER_NAV.map((item) => (
              <div
                key={item.label}
                className={`dts-topnav-item ${item.active ? "is-active" : "is-idle"}`}
              >
                <span className="dts-topnav-label">{item.label}</span>
                {!item.active ? (
                  <span className="dts-topnav-soon">Coming soon</span>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="dts-topbar-actions">
            <button
              type="button"
              className="dts-theme-toggle"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              aria-label="Toggle theme"
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                {themeIcon}
              </svg>
              <span>{theme === "light" ? "LIGHT ON" : "LIGHT OFF"}</span>
            </button>
          </div>
        </header>

        <div className="dts-main diamond-studio-main diamond-studio-grid studio-layout">
          <aside className="dts-control-rail" aria-label="Diamond Studio controls">
            <section className="dts-card" aria-label="Finger size">
              <div className="dts-card-head">
                <span>Finger Size</span>
                <span className="dts-info" title="US ring size, 4 to 10">
                  i
                </span>
              </div>
              <div className="dts-stepper">
                <button
                  type="button"
                  aria-label="Smaller"
                  disabled={ringSize <= 4}
                  onClick={() => setRingSizeClamped(ringSize - 0.5)}
                >
                  ‹
                </button>
                <span className="dts-step-val">{ringSize.toFixed(1)}</span>
                <button
                  type="button"
                  aria-label="Larger"
                  disabled={ringSize >= 10}
                  onClick={() => setRingSizeClamped(ringSize + 0.5)}
                >
                  ›
                </button>
              </div>
              <div className="dts-slider">
                <div className="dts-track" ref={fsTrackRef}>
                  <div
                    className="dts-handle"
                    style={{ left: `${fsHandleLeft}%` }}
                  />
                </div>
                <div className="dts-ticks">
                  {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <span
                      key={n}
                      className={
                        Math.abs(n - ringSize) < 0.5 ? "is-current" : undefined
                      }
                      data-v={n}
                      onClick={() => setRingSizeClamped(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setRingSizeClamped(n);
                      }}
                      role="presentation"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <p className="dts-card-note">
                Finger width: <strong>{fingerMm.toFixed(1)} mm</strong> inside
                diameter
              </p>
            </section>

            <section className="dts-card" aria-label="Skin tone">
              <div className="dts-card-head">
                <span>Skin Tone</span>
              </div>
              <div className="dts-skin-row" role="group" aria-label="Skin tone">
                {(["light", "medium", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`dts-skin-pill ${skinTone === t ? "is-selected" : ""}`}
                    onClick={() => setSkinTone(t)}
                  >
                    {t === "light" ? "Light" : t === "medium" ? "Medium" : "Dark"}
                  </button>
                ))}
              </div>
            </section>

            <section className="dts-card" aria-label="Stone orientation">
              <div className="dts-card-head">
                <span>Stone Orientation</span>
              </div>
              <div
                className="dts-skin-row"
                role="group"
                aria-label="Stone orientation"
              >
                <button
                  type="button"
                  className={`dts-skin-pill ${stoneOrientation === "ns" ? "is-selected" : ""}`}
                  onClick={() => setStoneOrientation("ns")}
                >
                  N/S
                </button>
                <button
                  type="button"
                  className={`dts-skin-pill ${stoneOrientation === "ew" ? "is-selected" : ""}`}
                  onClick={() => setStoneOrientation("ew")}
                >
                  E/W
                </button>
              </div>
            </section>

            <section className="dts-card" aria-label="Carat weight">
              <div className="dts-card-head">
                <span>Carat Weight</span>
                <span className="dts-info" title="Stone weight in carats">
                  i
                </span>
              </div>
              <div className="dts-stepper">
                <button
                  type="button"
                  aria-label="Smaller"
                  disabled={carat <= CARAT_MIN + 0.001}
                  onClick={() => setCaratClamped(carat - 0.1)}
                >
                  ‹
                </button>
                <span className="dts-step-val">{carat.toFixed(2)}</span>
                <button
                  type="button"
                  aria-label="Larger"
                  disabled={carat >= CARAT_MAX - 0.001}
                  onClick={() => setCaratClamped(carat + 0.1)}
                >
                  ›
                </button>
              </div>
              <div className="dts-slider">
                <div className="dts-track" ref={ctTrackRef}>
                  <div
                    className="dts-handle"
                    style={{ left: `${ctHandleLeft}%` }}
                  />
                </div>
                <div className="dts-ticks dts-ticks-carat">
                  {[0.5, 1, 2, 3, 4, 5].map((n) => {
                    const tickLeftPct =
                      ((n - CARAT_MIN) / (CARAT_MAX - CARAT_MIN)) * 100;
                    return (
                      <span
                        key={n}
                        className={
                          Math.abs(n - carat) < 0.25 ? "is-current" : undefined
                        }
                        style={{ left: `${tickLeftPct}%` }}
                        onClick={() => setCaratClamped(n)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            setCaratClamped(n);
                        }}
                        role="presentation"
                      >
                        {n === 0.5 ? "0.5" : n}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="dts-card-note">
                Diamond width: <strong>{diamondReadoutMm.toFixed(1)} mm</strong>{" "}
                face-up diameter
              </p>
            </section>

            <section className="dts-card dts-card--coverage" aria-label="Finger coverage">
              <div className="dts-card-head">
                <span>Finger Coverage</span>
                <span
                  className="dts-info"
                  title="Stone width as a percentage of finger inside diameter"
                >
                  i
                </span>
              </div>
              <div>
                <div className="dts-cov-pct">{cov}%</div>
                <div className="dts-cov-label">{zoneMeta.label}</div>
              </div>
              <div className="dts-zone-bar">
                <div className="dts-zones">
                  <div
                    className="dts-zone-active"
                    style={{
                      left: `${zoneMeta.min}%`,
                      width: `${Math.min(zoneMeta.max, 100) - zoneMeta.min}%`,
                    }}
                  />
                  <div
                    className="dts-zone-handle"
                    style={{ left: `${Math.min(100, Math.max(0, cov))}%` }}
                  />
                </div>
                <div className="dts-zone-labels">
                  <span className="dts-endcap">Quiet</span>
                  <span className="dts-active-lbl">{zoneShort[zone]}</span>
                  <span className="dts-endcap">Dramatic</span>
                </div>
              </div>
              <p className="dts-cov-helper">{zoneMeta.helper}</p>
            </section>
          </aside>

          <div className="dts-stage-stack">
            <div
              className="dts-shape-strip shape-selector"
              role="tablist"
              aria-label="Shape"
            >
              {SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`dts-shape-chip ${s === shape ? "is-selected" : ""}`}
                  data-shape={s}
                  onClick={() => selectShape(s)}
                >
                  <div className="dts-thumb">
                    <ShapeStripThumb imageUrl={SHAPE_SUITE_CONFIG[s].image} />
                  </div>
                  <div className="dts-name">{SHAPE_SUITE_CONFIG[s].label}</div>
                </button>
              ))}
            </div>

            <div
              className="dts-stage-preview"
              aria-label="Diamond on hand"
            >
              <div className="studio-preview finger-preview">
                <p className="dts-sentence">
                  <span className="dts-article">{articleFor(shape)}</span>{" "}
                  <span>{SHAPE_LABELS[shape].toLowerCase()}</span>,{" "}
                  <span>{carat.toFixed(2)}</span> carats, on a size{" "}
                  <span>{ringSize.toFixed(0)}</span> finger.
                </p>
              </div>

              <div className="dts-stage-canvas">
                {/*
                  Preview stack (same on mobile and desktop):
                  1) dts-layer-finger — one PNG per skin (/diamond-tech-suite/finger/...). The photograph includes
                     skin + ring metal/band as baked-in pixels (no separate band layer in repo).
                  2) dts-layer-diamond — absolutely positioned box + DiamondStageFace (img.dts-diamond-face) is the
                     only independently movable stone; shape-strip thumbnails are unrelated.
                */}
                <div className="dts-viewer">
                  <div className="dts-layer-finger" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={FINGER_IMAGES[skinTone]} alt="" />
                  </div>

                  {/* Main hand preview: this div positions the large stone; DiamondStageFace renders img.dts-diamond-face (not shape-strip thumbs). */}
                  <div
                    className={`dts-layer-diamond ${diamondSwapping ? "is-swapping" : ""}`}
                    data-dts-stage-diamond-overlay=""
                    style={{
                      width: `${layerWidthCqw}cqw`,
                      height: `${layerHeightCqw}cqw`,
                      top: `${RING_CLUSTER_TOP_PCT}%`,
                      transform: `translate(calc(-50% + 4px), calc(-50% - 4px + ${diamondOverlayYExtraPx}px))`,
                    }}
                  >
                    <DiamondStageFace
                      shapeId={diamondVisualShape}
                      orientation={stoneOrientation}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}
