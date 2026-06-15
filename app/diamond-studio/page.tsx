"use client";

import Link from "next/link";
import CTAGlimmer from "../shared-components/motion/CTAGlimmer";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  trackDiamondStudioEvent,
  type DiamondStudioEventProperties,
} from "./analytics";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

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

type StoneOrientation = "ns" | "ew";

const FINGER_IMAGE = "/diamond-tech-suite/finger/finger-light.png";

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
  6.0: 11.7,
  7.0: 12.3,
  8.0: 12.9,
  9.0: 13.4,
  10.0: 14.0,
};

function getRoundDiamondMm(carat: number): number {
  const table = ROUND_BRILLIANT_MM_BY_CARAT;
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const loK = keys[0]!;
  const hiK = keys[keys.length - 1]!;
  if (carat <= loK) return table[loK]!;
  if (carat >= hiK) {
    const prevK = keys[keys.length - 2]!;
    const slope = (table[hiK]! - table[prevK]!) / (hiK - prevK);
    return table[hiK]! + slope * (carat - hiK);
  }
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
  10.5: 20.17,
  11.0: 20.57,
  11.5: 20.98,
  12.0: 21.39,
  12.5: 21.79,
  13.0: 22.2,
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
    helper: "Subtle on the hand, with a refined everyday presence.",
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
    helper: "A bold, high-presence look designed to be noticed.",
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

const CARAT_MIN = 1.0;
const CARAT_MAX = 10.0;
const CARAT_STEP = 0.25;

function snapCarat(value: number): number {
  const snapped = Math.round(value / CARAT_STEP) * CARAT_STEP;
  return Math.max(
    CARAT_MIN,
    Math.min(CARAT_MAX, Math.round(snapped * 100) / 100),
  );
}

function caratSliderPct(value: number): number {
  return ((value - CARAT_MIN) / (CARAT_MAX - CARAT_MIN)) * 100;
}

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

/** Main preview stone translateY extra (px): desktop shank optical seat (~8px above prior). */
const DIAMOND_Y_NUDGE_DESKTOP_PX = 4;
/** Mobile preview stone translateY extra (px); negative moves up on band. */
const MOBILE_DIAMOND_Y_NUDGE_PX = -4;
/** Mobile-only on-stage scale; does not affect mm readout or coverage. */
const MOBILE_STONE_RENDER_SCALE = 1.07;

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
  if (carat >= hiK) {
    const prevK = keys[keys.length - 2]!;
    const [wL, lL] = anchors[prevK]!;
    const [wH, lH] = anchors[hiK]!;
    const extra = carat - hiK;
    const slopeW = (wH - wL) / (hiK - prevK);
    const slopeL = (lH - lL) / (hiK - prevK);
    return [wH + slopeW * extra, lH + slopeL * extra];
  }
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

/** Hero headline carat — at most one decimal, no trailing zeros. */
function formatCaratForHeadline(carat: number): string {
  const oneDecimal = Math.round(carat * 10) / 10;
  return Number.isInteger(oneDecimal)
    ? String(oneDecimal)
    : oneDecimal.toFixed(1);
}

/** Hero headline ring size — half sizes preserved; whole sizes drop “.0”. */
function formatRingSizeForHeadline(ringSize: number): string {
  const stepped = Math.round(ringSize * 2) / 2;
  return Number.isInteger(stepped) ? String(stepped) : stepped.toFixed(1);
}

function articleForCarat(carat: number): "A" | "An" {
  const n = Math.round(carat * 10) / 10;
  if (n === 8 || n === 11 || n === 18) return "An";
  if (n > 7 && n < 9) return "An";
  if (n > 10 && n < 12) return "An";
  return "A";
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
        --shadow-1: 0 1px 2px oklch(0.55 0.012 65 / 0.04), 0 4px 14px oklch(0.45 0.012 65 / 0.04);
        --shadow-2: 0 1px 1px oklch(0.55 0.012 65 / 0.03), 0 8px 28px oklch(0.45 0.012 65 / 0.06);
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
          height:100dvh !important;
          max-height:100dvh !important;
        }
        html.diamond-studio-viewport-lock body > div,
        html.diamond-studio-viewport-lock body main{
          min-height:0 !important;
          height:100dvh !important;
          max-height:100dvh !important;
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
        display:grid; grid-template-rows:auto minmax(0, 1fr); }
      @media (min-width: 769px) {
        .dts-shell{
          height:100dvh;
          max-height:100dvh;
          overflow:hidden;
        }
        .dts-app{
          height:100dvh;
          max-height:100dvh;
          overflow:hidden;
          grid-template-rows:auto minmax(0, 1fr);
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
        flex-shrink:0;
        border-bottom:1px solid oklch(from var(--hairline-soft) l c h / 0.76);
        box-shadow:0 1px 0 oklch(from var(--hairline) l c h / 0.05);
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
      .dts-home-link{
        display:flex; align-items:center; background:var(--hairline-soft);
        border:none; cursor:pointer; padding:5px 9px; border-radius:999px;
        font-size:10px; font-weight:500; letter-spacing:0.16em; color:var(--ink-soft);
        text-decoration:none;
        transition:background var(--dt-dur-mid) var(--dt-ease), color var(--dt-dur-mid) var(--dt-ease),
          box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-home-link:hover{
        color:var(--ink);
        background:oklch(from var(--hairline-soft) l c h / 0.92);
        box-shadow:0 1px 0 oklch(from var(--hairline) l c h / 0.35);
      }
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
          gap:18px;
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
          justify-content:flex-start;
        }
        .dts-stage-stack .dts-stage-preview{
          order:1;
          flex:1 1 auto;
          min-height:0;
          min-width:0;
          padding:clamp(16px, 2.2vh, 28px) 0 8px;
          justify-content:flex-start;
          overflow:hidden;
        }
        .dts-stage-stack .dts-shape-strip-wrap{
          order:2;
          flex:0 0 auto;
          align-self:center;
          margin-top:clamp(10px, 1.6vh, 20px);
          margin-bottom:clamp(14px, 2.4vh, 28px);
        }
        .dts-stage-stack .dts-shape-strip{
          position:relative;
          left:auto;
          right:auto;
          bottom:auto;
          inset:auto;
          transform:none;
        }
        .dts-stage-stack .dts-stage-canvas{
          margin-bottom:clamp(4px, 0.8vh, 12px);
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
        padding:13px 14px 14px; box-shadow:var(--shadow-1);
        transition:border-color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-card--coverage{
        padding:16px 16px 18px;
        border-color:oklch(from var(--card-edge) l c h / 0.88);
        box-shadow:var(--shadow-1), 0 0 0 1px oklch(from var(--hairline-soft) l c h / 0.42) inset;
      }
      .dts-card-head{
        display:flex; align-items:center; justify-content:space-between;
        font-size:9.35px; font-weight:500; letter-spacing:0.168em; text-transform:uppercase;
        color:var(--ink-soft); margin:0 0 10px;
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
        margin:2px 0 8px;
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
      .dts-slider{ position:relative; margin:6px 4px 2px; }
      .dts-slider--carat,
      .dts-slider--ring{
        padding:0 8px;
        box-sizing:border-box;
      }
      .dts-slider--carat .dts-track,
      .dts-slider--ring .dts-track{
        margin-left:0;
        margin-right:0;
      }
      .dts-slider .dts-track{
        position:relative; height:1px; background:var(--hairline); margin:11px 8px 9px;
      }
      .dts-slider .dts-track::before{
        content:"";
        position:absolute; left:0; top:0; height:1px;
        background:linear-gradient(90deg, var(--gold-soft), var(--gold-warm));
        opacity:0.55;
        width:var(--dts-fill, 0%);
        pointer-events:none;
        transition:width var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-slider .dts-handle{
        position:absolute; top:50%; width:10px; height:10px; border-radius:50%;
        background:var(--card); border:1px solid oklch(from var(--ink-soft) l c h / 0.72);
        transform:translate(-50%,-50%); cursor:grab;
        box-shadow:0 1px 2px oklch(0 0 0 / 0.06);
        transition:border-color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease),
          background-color var(--dt-dur-mid) var(--dt-ease), transform var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-slider .dts-handle:hover{
        box-shadow:0 1px 4px oklch(0 0 0 / 0.07);
        border-color:oklch(from var(--gold-warm) l c h / 0.55);
        transform:translate(-50%,-50%) scale(1.06);
      }
      .dts-slider .dts-handle:active{
        cursor:grabbing;
        border-color:var(--gold-warm);
        background:var(--pill-active);
      }
      .dts-slider-endpoints{
        display:flex; justify-content:space-between; align-items:center;
        margin:10px 0 0;
        font-size:8.5px; letter-spacing:0.06em;
        color:oklch(from var(--ink-mute) l c h / 0.72);
        font-variant-numeric:tabular-nums;
      }
      .dts-carat-step-hint{
        margin:6px 0 0;
        padding:0 2px;
        font-size:8.5px;
        line-height:1.45;
        letter-spacing:0.04em;
        color:oklch(from var(--ink-mute) l c h / 0.62);
        text-align:center;
      }
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
        position:relative; margin:4px 12px 12px; text-align:center;
        font-family:var(--serif); font-weight:300; font-size:21px; color:var(--ink);
        letter-spacing:0.01em; pointer-events:none; z-index:30; flex:0 0 auto;
        line-height:1.35;
      }
      .dts-mobile-hero{
        flex:0 0 auto;
        width:100%;
      }
      .dts-sentence .dts-article{ font-style:italic; color:var(--ink-soft); }
      @media (min-width: 769px) {
        .dts-sentence-br{ display:none; }
      }
      .dts-stage-trust{
        margin:0 12px 12px; padding:0 8px; text-align:center;
        font-size:11px; line-height:1.65; letter-spacing:0.05em;
        color:var(--ink-soft); font-weight:400;
      }
      .dts-stage-trust-link{
        color:var(--ink-soft);
        border-bottom:1px solid oklch(from var(--hairline) l c h / 0.85);
        text-decoration:none;
        transition:color 0.45s ease, border-color 0.45s ease;
      }
      .dts-stage-trust-link:hover{ color:var(--ink); border-color:var(--ink-soft); }
      .dts-stage-trust .dts-stage-trust-link{
        letter-spacing:0.06em;
        white-space:nowrap;
      }
      .dts-shape-strip-wrap{
        position:relative;
        width:100%;
        flex:0 0 auto;
        display:flex;
        justify-content:center;
      }
      .dts-shape-strip{
        position:relative;
        display:flex; align-items:stretch; gap:7px; padding:7px 11px;
        background:oklch(from var(--card) l c h / 0.74);
        border:1px solid oklch(from var(--card-edge) l c h / 0.42);
        border-radius:16px;
        backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
        box-shadow:0 4px 16px oklch(from var(--hairline) l c h / 0.06),
          0 0 0 1px oklch(from var(--hairline-soft) l c h / 0.22) inset;
        z-index:20; white-space:nowrap;
        opacity:0.88;
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
      @media (min-width: 1200px) and (max-width: 1440px) {
        .dts-topbar{
          padding:0 clamp(16px, 2vw, 24px);
          column-gap:clamp(10px, 1.4vw, 14px);
        }
        .dts-topnav{
          gap:clamp(18px, 2.8vw, 44px);
          margin-left:0;
        }
        .diamond-studio-main.dts-main{
          grid-template-columns:minmax(220px, 260px) minmax(0, 1fr) !important;
          width:100% !important;
          max-width:100% !important;
          min-width:0 !important;
          box-sizing:border-box !important;
        }
        .dts-control-rail{
          min-width:220px;
          max-width:260px;
          padding:16px clamp(12px, 1.4vw, 16px) 16px clamp(16px, 2vw, 24px);
        }
        .dts-stage-stack{
          padding:0 clamp(8px, 1.2vw, 16px);
          box-sizing:border-box;
          min-width:0;
          max-width:100%;
        }
        /* Severe height squeeze: width-limited cover crop — track finger image. */
        @container (aspect-ratio > 7 / 8.5) {
          .dts-layer-finger img{
            object-position:50% calc(42% + clamp(0%, (1 - (7 * 100cqh) / (9 * 100cqw)) * 67%, 26%));
          }
        }
        /* Near-natural aspect: object-position is inert — track diamond anchor. */
        @container (aspect-ratio <= 7 / 8.5) {
          .dts-layer-diamond{
            top:66% !important;
          }
        }
      }
      @media (min-width: 1441px) {
        .dts-stage-stack{
          justify-content:center;
          gap:clamp(8px, 1.2vh, 14px);
        }
        .dts-stage-stack .dts-stage-preview{
          flex:0 1 auto;
          justify-content:center;
          padding:clamp(12px, 1.6vh, 22px) 0 0;
        }
        .dts-stage-stack .dts-shape-strip-wrap{
          flex:0 0 auto;
          align-self:center;
          margin-top:0;
          margin-bottom:clamp(12px, 2vh, 24px);
        }
        .dts-stage-stack .dts-stage-canvas{
          margin-bottom:clamp(2px, 0.5vh, 8px);
        }
      }
      @media (max-width: 768px) {
        .dts-shell{
          overflow-x:hidden;
          overflow-y:auto;
          -webkit-overflow-scrolling:touch;
          scroll-padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 96px);
        }
        .dts-app{
          display:flex;
          flex-direction:column;
          min-height:100%;
          height:auto;
          box-sizing:border-box;
          padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 96px);
        }
        .dts-topbar{
          display:grid;
          grid-template-columns:1fr auto;
          grid-template-rows:auto auto;
          column-gap:14px;
          row-gap:8px;
          padding:12px 20px 10px;
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
          padding:2px 0 3px;
          justify-content:flex-start;
          gap:clamp(16px,4.5vw,28px);
          width:100%;
          min-width:0;
        }
        .dts-main{
          display:flex !important;
          flex-direction:column !important;
          width:100% !important;
          gap:11px;
          grid-template-columns:unset;
          grid-template-rows:unset;
          min-width:0;
          flex:1 1 auto;
          overflow:visible;
        }
        .dts-control-rail{
          display:contents;
        }
        .dts-main .dts-card{
          width:100%;
          max-width:none;
          padding:11px 16px 12px;
          margin-left:20px;
          margin-right:20px;
          width:calc(100% - 40px);
          box-sizing:border-box;
        }
        .dts-main .dts-card--ring-size{ order:5; }
        .dts-main .dts-card--carat{ order:6; }
        .dts-main .dts-card--orientation{ order:7; }
        .dts-main .dts-card--coverage{
          order:11;
          padding-bottom:28px;
        }
        .dts-stage-stack{
          display:contents;
        }
        .dts-stage-preview{
          display:contents;
        }
        .dts-mobile-hero{
          order:2;
          width:100% !important;
          max-width:none !important;
          margin:2px 0 0;
          padding:0 20px;
          box-sizing:border-box;
          display:flex;
          flex-direction:column;
          align-items:center;
        }
        .dts-mobile-visual{
          order:4;
          width:100%;
          margin-top:-5px;
          padding:0 20px;
          box-sizing:border-box;
        }
        .dts-shape-strip-wrap{
          order:10;
          width:calc(100% - 40px);
          margin-left:20px;
          margin-right:20px;
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
          line-height:1.28;
          letter-spacing:0.006em;
          margin:0 auto 8px;
          padding:0 2px;
          max-width:260px;
          position:relative !important;
          inset:auto !important;
          transform:none !important;
          width:100%;
        }
        .dts-stage-trust{
          margin:0 auto 9px;
          max-width:260px;
          width:100%;
          font-size:10px;
        }
        .dts-layer-finger img{
          object-position:50% 38%;
          filter:
            saturate(0.96)
            contrast(1.02)
            brightness(1.01)
            drop-shadow(2px 7px 20px oklch(0.42 0.010 62 / 0.10));
        }
        .dts-diamond-face{
          filter:
            saturate(0.96)
            contrast(1.04)
            brightness(1.01)
            drop-shadow(0 2px 4px rgba(0,0,0,0.14))
            drop-shadow(0 1px 1px rgba(0,0,0,0.06));
        }
        .dts-viewer{
          width:100%;
          max-width:260px;
          min-width:0;
          margin:0 auto;
          max-height:min(48vh,352px);
          aspect-ratio:7 / 9.15;
        }
        .dts-shape-strip-wrap{
          margin:4px 0 8px;
          -webkit-mask-image:linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
          mask-image:linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
        }
        .dts-shape-strip{
          position:relative !important;
          left:auto !important;
          right:auto !important;
          bottom:auto !important;
          inset:auto !important;
          transform:none !important;
          margin:0;
          width:100%;
          max-width:none !important;
          min-width:0;
          justify-content:flex-start;
          flex-wrap:nowrap;
          overflow-x:auto;
          overflow-y:hidden;
          -webkit-overflow-scrolling:touch;
          gap:6px;
          padding:8px 10px 9px;
          scrollbar-width:none;
          -ms-overflow-style:none;
          align-self:stretch;
          opacity:0.92;
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
          min-width:46px;
          min-height:42px;
          padding:6px 7px 5px;
          touch-action:manipulation;
        }
        .dts-shell[data-theme="light"] .dts-card,
        .dts-shell[data-theme="light"] .dts-card--coverage{
          box-shadow:0 1px 2px rgba(49,38,29,0.035), 0 3px 10px rgba(49,38,29,0.04);
        }
        .dts-shell[data-theme="dark"] .dts-card,
        .dts-shell[data-theme="dark"] .dts-card--coverage{
          box-shadow:0 1px 2px rgba(0,0,0,0.30), 0 4px 14px rgba(0,0,0,0.22);
        }
        .dts-card--coverage{
          border-color:oklch(from var(--card-edge) l c h / 0.85);
        }
        .dts-stepper button{
          width:36px;
          height:36px;
          font-size:14px;
        }
        .dts-stepper .dts-step-val{
          font-size:24px;
          min-width:52px;
        }
        .dts-card-head{
          margin-bottom:8px;
        }
        .dts-stepper{
          margin:0 0 6px;
        }
        .dts-skin-pill{
          min-height:36px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:7px 6px;
        }
        .dts-slider{
          touch-action:pan-x;
          -webkit-tap-highlight-color:transparent;
        }
        .dts-slider .dts-track{
          height:40px;
          min-height:40px;
          margin:-10px 8px -9px;
          background:transparent;
          touch-action:pan-x;
          -webkit-user-select:none;
          user-select:none;
          background-image:linear-gradient(var(--hairline),var(--hairline));
          background-size:100% 1px;
          background-position:center;
          background-repeat:no-repeat;
        }
        .dts-slider .dts-track::before{
          top:50%;
          height:1px;
          transform:translateY(-50%);
        }
        .dts-slider .dts-handle{
          width:12px;
          height:12px;
          touch-action:none;
        }
        .dts-slider .dts-handle:hover{
          transform:translate(-50%,-50%) scale(1.04);
        }
        .dts-zone-bar{
          touch-action:pan-x;
          -webkit-tap-highlight-color:transparent;
        }
        .dts-zones{
          height:40px;
          min-height:40px;
          margin:-17.5px 0 calc(11px - 17.5px);
          background:transparent;
          background-image:linear-gradient(var(--hairline-soft),var(--hairline-soft));
          background-size:100% 5px;
          background-position:center;
          background-repeat:no-repeat;
        }
        .dts-zone-active{
          top:calc(50% - 2.5px);
          bottom:auto;
          height:5px;
        }
        .dts-zone-handle{
          width:12px;
          height:12px;
          touch-action:none;
        }
        .dts-cov-helper{
          padding:0 4px;
          margin-top:12px;
        }
      }
      @media (min-width: 769px) and (max-width: 1023px) {
        .diamond-studio-main.dts-main{
          grid-template-columns:minmax(0, 1fr) !important;
          grid-template-rows:auto minmax(0, 1fr) !important;
        }
        .dts-control-rail{
          grid-column:1;
          grid-row:2;
          display:grid !important;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:12px;
          padding:12px 20px 18px;
          max-height:42vh;
          overflow-y:auto;
          align-content:start;
        }
        .dts-control-rail > .dts-card--coverage{
          grid-column:1 / -1;
        }
        .dts-stage-stack{
          grid-column:1;
          grid-row:1;
          min-height:0;
        }
        .dts-viewer{
          width:min(480px, 88%);
          max-height:min(44vh, 400px);
        }
      }
      @media (min-width: 769px) and (max-height: 860px) {
        .dts-stage-stack .dts-stage-preview{
          padding-top:clamp(14px, 2vh, 22px);
          padding-bottom:4px;
        }
        .dts-sentence{
          margin-bottom:10px;
          font-size:clamp(17px, 2.4vh, 20px);
        }
        .dts-stage-trust{
          margin-bottom:8px;
          font-size:10px;
          line-height:1.55;
        }
        .dts-viewer{
          width:min(520px, 90%);
          max-height:min(52vh, 460px);
        }
        .dts-stage-stack .dts-shape-strip-wrap{
          margin-bottom:clamp(12px, 1.8vh, 22px);
        }
      }
      @media (min-width: 769px) and (max-height: 720px) {
        .dts-viewer{
          width:min(480px, 86%);
          max-height:min(46vh, 400px);
        }
        .dts-sentence{
          font-size:clamp(16px, 2.2vh, 18px);
          margin-bottom:8px;
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
        .dts-home-link,
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
/** Optional hi-res stage PNGs (e.g. 3000×3000); thumbs keep using {@link SHAPE_SUITE_CONFIG}.image. */
function stagePreviewImage(shapeId: ShapeId): string {
  return `/diamond-tech-suite/diamonds/stage/${shapeId}.png`;
}

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
  preferHiResStage,
}: {
  shapeId: ShapeId;
  orientation: StoneOrientation;
  preferHiResStage: boolean;
}) {
  const standardSrc = SHAPE_SUITE_CONFIG[shapeId].image;
  const hiResSrc = stagePreviewImage(shapeId);
  const [faceSrc, setFaceSrc] = useState(standardSrc);
  const [useHiRes, setUseHiRes] = useState(false);
  const faceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setUseHiRes(false);
    setFaceSrc(standardSrc);
  }, [standardSrc, shapeId]);

  const pickSrcAfterLoad = useCallback(() => {
    const img = faceRef.current;
    if (!img || !preferHiResStage || useHiRes) return;
    if (img.naturalWidth < 1 || img.naturalHeight < 1) return;
    const dpr = window.devicePixelRatio || 1;
    const needW = img.clientWidth * dpr;
    const needH = img.clientHeight * dpr;
    const upscaling =
      needW > img.naturalWidth * 0.98 || needH > img.naturalHeight * 0.98;
    if (upscaling && faceSrc !== hiResSrc) {
      setUseHiRes(true);
      setFaceSrc(hiResSrc);
    }
  }, [preferHiResStage, useHiRes, faceSrc, hiResSrc]);

  useEffect(() => {
    const img = faceRef.current;
    if (!img) return;
    if (img.complete) pickSrcAfterLoad();
    else img.addEventListener("load", pickSrcAfterLoad);
    window.addEventListener("resize", pickSrcAfterLoad);
    return () => {
      window.removeEventListener("resize", pickSrcAfterLoad);
      img.removeEventListener("load", pickSrcAfterLoad);
    };
  }, [faceSrc, orientation, pickSrcAfterLoad]);

  return (
    <div className="dts-diamond-stack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={faceRef}
        src={faceSrc}
        alt=""
        className={`dts-diamond-face${orientation === "ew" ? " dts-diamond-face--ew" : ""}`}
        onLoad={pickSrcAfterLoad}
        onError={() => {
          if (useHiRes) {
            setUseHiRes(false);
            setFaceSrc(standardSrc);
            return;
          }
          setFaceSrc((prev) =>
            prev === DIAMOND_SHAPE_FALLBACK ? prev : DIAMOND_SHAPE_FALLBACK,
          );
        }}
      />
    </div>
  );
}

function attachHorizontalTrack(
  track: HTMLDivElement,
  draggingRef: React.MutableRefObject<boolean>,
  applyPct: (pct: number) => void,
  onDragEnd?: () => void,
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
    if (draggingRef.current) {
      onDragEnd?.();
    }
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

const STUDIO_HEADER_NAV: {
  label: string;
  active: boolean;
  href?: string;
  soon?: boolean;
}[] = [
  { label: "Diamond Size Studio", active: true },
  { label: "Shape Comparison", active: false, soon: true },
  { label: "Light Performance", active: false, href: "/diamond-intelligence" },
];

export default function DiamondStudioPage() {
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
    ? MOBILE_DIAMOND_Y_NUDGE_PX
    : DIAMOND_Y_NUDGE_DESKTOP_PX;

  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;

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

  const deviceType = isMobileViewport ? "mobile" : "desktop";

  const analyticsProps = useCallback((): DiamondStudioEventProperties => {
    const coveragePercent = Math.round(
      coveragePct(shape, carat, ringSize, stoneOrientation) * 10,
    ) / 10;
    const coverageZone = classifyPresence(
      shape,
      carat,
      ringSize,
      stoneOrientation,
    );
    return {
      shape,
      carat,
      fingerSize: ringSize,
      skinTone: "light",
      orientation: stoneOrientation,
      coveragePercent,
      coverageZone,
      deviceType,
    };
  }, [
    shape,
    carat,
    ringSize,
    stoneOrientation,
    deviceType,
  ]);

  const trackEvent = useCallback(
    (eventName: Parameters<typeof trackDiamondStudioEvent>[0]) => {
      trackDiamondStudioEvent(eventName, analyticsProps());
    },
    [analyticsProps],
  );

  const trackEventRef = useRef(trackEvent);
  trackEventRef.current = trackEvent;

  const sessionEngagedFiredRef = useRef(false);
  const meaningfulInteractionCountRef = useRef(0);

  const tryFireSessionEngaged = useCallback(
    (engagementTrigger: "time" | "interactions") => {
      if (sessionEngagedFiredRef.current) return;
      sessionEngagedFiredRef.current = true;
      trackDiamondStudioEvent("studio_session_engaged", {
        ...analyticsProps(),
        engagementTrigger,
      });
    },
    [analyticsProps],
  );

  const recordMeaningfulInteraction = useCallback(() => {
    if (sessionEngagedFiredRef.current) return;
    meaningfulInteractionCountRef.current += 1;
    if (meaningfulInteractionCountRef.current >= 5) {
      tryFireSessionEngaged("interactions");
    }
  }, [tryFireSessionEngaged]);

  useEffect(() => {
    trackDiamondStudioEvent("diamond_studio_view", analyticsProps());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      tryFireSessionEngaged("time");
    }, 45_000);
    return () => window.clearTimeout(timer);
  }, [tryFireSessionEngaged]);

  const prevZoneRef = useRef(zone);
  useEffect(() => {
    if (prevZoneRef.current === zone) return;
    prevZoneRef.current = zone;
    const timer = window.setTimeout(() => {
      trackEventRef.current("coverage_zone_changed");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [zone]);

  const selectShape = useCallback(
    (s: ShapeId) => {
      if (s === shape) return;
      if (swapTimer.current) clearTimeout(swapTimer.current);
      setShape(s);
      setDiamondSwapping(true);
      swapTimer.current = setTimeout(() => {
        setDiamondVisualShape(s);
        setDiamondSwapping(false);
        swapTimer.current = null;
      }, 200);
      trackDiamondStudioEvent("shape_selected", {
        ...analyticsProps(),
        shape: s,
      });
      recordMeaningfulInteraction();
    },
    [shape, analyticsProps, recordMeaningfulInteraction],
  );

  const selectOrientation = useCallback(
    (o: StoneOrientation) => {
      if (o === stoneOrientation) return;
      setStoneOrientation(o);
      trackDiamondStudioEvent("orientation_changed", {
        ...analyticsProps(),
        orientation: o,
      });
      recordMeaningfulInteraction();
    },
    [stoneOrientation, analyticsProps, recordMeaningfulInteraction],
  );

  const rw = renderStoneWidthMm(diamondVisualShape, carat, stoneOrientation);
  const rh = renderStoneHeightMm(diamondVisualShape, carat, stoneOrientation);
  /** N/S vs E/W: swapped rw/rh on the layer box; E/W also rotates the face img 90deg (see dts-diamond-face--ew). */
  const stoneMmToStage =
    (STONE_VIEWER_WIDTH_FACTOR * renderVisualCompensation(diamondVisualShape)) /
    fingerMm;
  const mobileStoneRenderScale = isMobileViewport ? MOBILE_STONE_RENDER_SCALE : 1;
  const layerWidthCqw = rw * stoneMmToStage * 100 * mobileStoneRenderScale;
  const layerHeightCqw = rh * stoneMmToStage * 100 * mobileStoneRenderScale;

  const zoneShort: Record<ZoneKey, string> = {
    understated: "Quiet",
    balanced: "Balanced",
    noticeable: "Noticed",
    statement: "Statement",
    dramatic: "Dramatic",
  };

  const commitFingerSizeAnalytics = useCallback(
    (nextSize: number) => {
      trackDiamondStudioEvent("finger_size_changed", {
        ...analyticsProps(),
        fingerSize: nextSize,
      });
      recordMeaningfulInteraction();
    },
    [analyticsProps, recordMeaningfulInteraction],
  );

  const commitCaratAnalytics = useCallback(
    (nextCarat: number) => {
      trackDiamondStudioEvent("carat_changed", {
        ...analyticsProps(),
        carat: nextCarat,
      });
      recordMeaningfulInteraction();
    },
    [analyticsProps, recordMeaningfulInteraction],
  );

  const applyRingSize = useCallback(
    (v: number, trackCommit: boolean) => {
      const stepped = Math.round(v * 2) / 2;
      const next = Math.max(4, Math.min(13, stepped));
      setRingSize((prev) => {
        if (prev === next) return prev;
        if (trackCommit) commitFingerSizeAnalytics(next);
        return next;
      });
    },
    [commitFingerSizeAnalytics],
  );

  const applyCarat = useCallback(
    (v: number, trackCommit: boolean) => {
      const next = snapCarat(v);
      setCarat((prev) => {
        if (Math.abs(prev - next) < 0.001) return prev;
        if (trackCommit) commitCaratAnalytics(next);
        return next;
      });
    },
    [commitCaratAnalytics],
  );

  const fsTrackRef = useRef<HTMLDivElement>(null);
  const ctTrackRef = useRef<HTMLDivElement>(null);
  const fsDrag = useRef(false);
  const ctDrag = useRef(false);

  const fsPctToSize = (p: number) => 4 + p * 9;
  const ctPctToCarat = (p: number) => CARAT_MIN + p * (CARAT_MAX - CARAT_MIN);

  const ringSizeRef = useRef(ringSize);
  ringSizeRef.current = ringSize;
  const caratRef = useRef(carat);
  caratRef.current = carat;

  useEffect(() => {
    const el = fsTrackRef.current;
    if (!el) return;
    return attachHorizontalTrack(
      el,
      fsDrag,
      (p) => applyRingSize(fsPctToSize(p), false),
      () => commitFingerSizeAnalytics(ringSizeRef.current),
    );
  }, [applyRingSize, commitFingerSizeAnalytics]);

  useEffect(() => {
    const el = ctTrackRef.current;
    if (!el) return;
    return attachHorizontalTrack(
      el,
      ctDrag,
      (p) => applyCarat(ctPctToCarat(p), false),
      () => commitCaratAnalytics(caratRef.current),
    );
  }, [applyCarat, commitCaratAnalytics]);

  const fsHandleLeft = ((ringSize - 4) / 9) * 100;
  const ctHandleLeft = caratSliderPct(carat);
  return (
    <div className="dts-shell h-full w-full overflow-hidden" data-theme="light">
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
                {item.active || !item.href ? (
                  <span className="dts-topnav-label">{item.label}</span>
                ) : (
                  <Link href={item.href} className="dts-topnav-label">
                    {item.label}
                  </Link>
                )}
                {!item.active && item.soon ? (
                  <span className="dts-topnav-soon">Coming soon</span>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="dts-topbar-actions">
            <Link
              href="/"
              className="dts-home-link"
              aria-label="Home"
              onClick={() => trackEvent("home_clicked")}
            >
              HOME
            </Link>
          </div>
        </header>

        <div className="dts-main diamond-studio-main diamond-studio-grid studio-layout">
          <aside className="dts-control-rail" aria-label="Diamond Studio controls">
            <section
              className="dts-card dts-card--ring-size"
              aria-label="Ring size"
            >
              <div className="dts-card-head">
                <span>Ring Size</span>
                <span className="dts-info" title="US ring size, 4 to 13">
                  i
                </span>
              </div>
              <div className="dts-stepper">
                <button
                  type="button"
                  aria-label="Smaller"
                  disabled={ringSize <= 4}
                  onClick={() => applyRingSize(ringSize - 0.5, true)}
                >
                  ‹
                </button>
                <span className="dts-step-val">{ringSize.toFixed(1)}</span>
                <button
                  type="button"
                  aria-label="Larger"
                  disabled={ringSize >= 13}
                  onClick={() => applyRingSize(ringSize + 0.5, true)}
                >
                  ›
                </button>
              </div>
              <div className="dts-slider dts-slider--ring">
                <div
                  className="dts-track"
                  ref={fsTrackRef}
                  style={{ "--dts-fill": `${fsHandleLeft}%` } as React.CSSProperties}
                >
                  <div
                    className="dts-handle"
                    style={{ left: `${fsHandleLeft}%` }}
                  />
                </div>
                <div className="dts-slider-endpoints" aria-hidden>
                  <span>Size 4</span>
                  <span>Size 13</span>
                </div>
              </div>
              <p className="dts-card-note">
                Finger width: <strong>{fingerMm.toFixed(1)} mm</strong> inside
                diameter
              </p>
            </section>

            <section className="dts-card dts-card--carat" aria-label="Diamond weight">
              <div className="dts-card-head">
                <span>Diamond Weight</span>
                <span className="dts-info" title="Stone weight in carats">
                  i
                </span>
              </div>
              <div className="dts-stepper">
                <button
                  type="button"
                  aria-label="Smaller"
                  disabled={carat <= CARAT_MIN + 0.001}
                  onClick={() => applyCarat(carat - CARAT_STEP, true)}
                >
                  ‹
                </button>
                <span className="dts-step-val">{carat.toFixed(2)}</span>
                <button
                  type="button"
                  aria-label="Larger"
                  disabled={carat >= CARAT_MAX - 0.001}
                  onClick={() => applyCarat(carat + CARAT_STEP, true)}
                >
                  ›
                </button>
              </div>
              <div className="dts-slider dts-slider--carat">
                <div
                  className="dts-track"
                  ref={ctTrackRef}
                  style={{ "--dts-fill": `${ctHandleLeft}%` } as React.CSSProperties}
                >
                  <div
                    className="dts-handle"
                    style={{ left: `${ctHandleLeft}%` }}
                  />
                </div>
                <div className="dts-slider-endpoints" aria-hidden>
                  <span>1 ct</span>
                  <span>10 ct</span>
                </div>
              </div>
              <p className="dts-carat-step-hint">Adjusts in 0.25 ct increments</p>
              <p className="dts-card-note">
                Face-up width: <strong>{diamondReadoutMm.toFixed(1)} mm</strong>
              </p>
            </section>

            <section
              className="dts-card dts-card--orientation"
              aria-label="Stone orientation"
            >
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
                  onClick={() => selectOrientation("ns")}
                >
                  N/S
                </button>
                <button
                  type="button"
                  className={`dts-skin-pill ${stoneOrientation === "ew" ? "is-selected" : ""}`}
                  onClick={() => selectOrientation("ew")}
                >
                  E/W
                </button>
              </div>
            </section>

            <section
              className="dts-card dts-card--coverage"
              aria-label="Finger presence"
            >
              <div className="dts-card-head">
                <span>Finger Presence</span>
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
              className="dts-stage-preview"
              aria-label="Diamond on hand"
            >
              <div className="dts-mobile-hero studio-preview finger-preview">
                <p className="dts-sentence">
                  A {formatCaratForHeadline(carat)}-carat{" "}
                  {SHAPE_LABELS[shape].toLowerCase()} diamond,
                  <br className="dts-sentence-br" aria-hidden="true" />
                  {" "}
                  shown on a size {formatRingSizeForHeadline(ringSize)} finger.
                </p>
                <p className="dts-stage-trust">
                  Thoughtful guidance matters as much as the tools themselves.{" "}
                  <CTAGlimmer variant="text">
                    <Link
                      href="/concierge"
                      className="dts-stage-trust-link"
                      onClick={() =>
                        trackConsultationCtaClicked("diamond_studio:editorial_inline")
                      }
                    >
                      Begin the Conversation →
                    </Link>
                  </CTAGlimmer>
                </p>
              </div>

              <div className="dts-stage-canvas dts-mobile-visual">
                <div className="dts-viewer">
                  <div className="dts-layer-finger" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={FINGER_IMAGE} alt="" />
                  </div>

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
                      preferHiResStage={isMobileViewport}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="dts-shape-strip-wrap">
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
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}
