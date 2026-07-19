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
import DiamondStudioEditorial from "./components/DiamondStudioEditorial";
import {
  getDiamondCadAsset,
  nextCadFallbackSrc,
} from "./components/diamond-cad-assets";
import DiamondCadScintillation from "./components/DiamondCadScintillation";
import { CAD_ADJUST_HOLD_MS } from "./components/diamond-cad-light";
import type { ShapeId } from "./components/diamond-cad-types";
import {
  EMERALD_LENGTH_RATIO,
  MARQUISE_LENGTH_RATIO,
  PEAR_LENGTH_RATIO,
  RADIANT_LENGTH_RATIO,
  faceAxesForSizing,
  getRoundDiamondMm,
} from "@/lib/diamond-tech-suite/face-dimensions";

export type { ShapeId };

type StoneOrientation = "ns" | "ew";

type SkinTone = "light" | "medium" | "dark";

type BandWidth = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

const BAND_WIDTH_VALUES: BandWidth[] = [2, 2.5, 3, 3.5, 4, 4.5, 5];

const SKIN_TONE_SWATCHES: { id: SkinTone; label: string; color: string }[] = [
  { id: "light", label: "Light", color: "oklch(0.88 0.038 68)" },
  { id: "medium", label: "Medium", color: "oklch(0.72 0.055 58)" },
  { id: "dark", label: "Dark", color: "oklch(0.52 0.048 52)" },
];

function getFingerImageSrc(tone: SkinTone, width: BandWidth): string {
  return `/diamond-tech-suite/finger/band-widths/finger-${tone}-${width}.png`;
}

function bandWidthToIndex(width: BandWidth): number {
  return BAND_WIDTH_VALUES.indexOf(width);
}

function indexToBandWidth(index: number): BandWidth {
  const clamped = Math.max(0, Math.min(BAND_WIDTH_VALUES.length - 1, index));
  return BAND_WIDTH_VALUES[clamped]!;
}

/** Round brilliant face-up diameter — canonical shared module. */
// getRoundDiamondMm imported from @/lib/diamond-tech-suite/face-dimensions

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

/**
 * @deprecated Removed from public calculation paths.
 * Historical SHAPE_ANCHORS previously powered presence-only widths and
 * diverged from getRoundDiamondMm (e.g. 10 ct round → 15.0 mm vs 14.0 mm).
 * All readout / presence / render mm now use getRepresentativeFaceUpDimensions
 * via faceAxesForSizing / getRoundDiamondMm in @/lib/diamond-tech-suite/face-dimensions.
 */

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

/** One-line guidance under Finger Presence meter (desktop + mobile). */
const COVERAGE_ZONE_HELPERS_SHORT: Record<ZoneKey, string> = {
  understated: "Subtle on the hand.",
  balanced: "Visible, with restraint.",
  noticeable: "Present, but wearable.",
  statement: "A stronger visual presence.",
  dramatic: "A stronger visual presence.",
};

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

const DIAMOND_SHAPE_FALLBACK = "/diamond-tech-suite/diamonds-v2/diamond-round-v2.png";

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
/* Math — canonical face-up mm from @/lib/diamond-tech-suite/face-dimensions  */
/* -------------------------------------------------------------------------- */

/** Face-up axes — canonical shared module (Size Studio + Shape Studio). */
function ovalFaceDimensionsMm(carat: number): [width: number, length: number] {
  return faceAxesForSizing("oval", carat);
}

function ovalLengthOverWidthAt1ct(): number {
  const [w, l] = ovalFaceDimensionsMm(1);
  return l / Math.max(w, 1e-9);
}

function cushionFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("cushion", carat);
}

function princessFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("princess", carat);
}

function radiantFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("radiant", carat);
}

function emeraldFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("emerald", carat);
}

function marquiseFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("marquise", carat);
}

function pearFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("pear", carat);
}

function asscherFaceDimensionsMm(carat: number): [number, number] {
  return faceAxesForSizing("asscher", carat);
}

/**
 * Horizontal stone span (mm) for Finger Presence %.
 * Uses the same canonical face-up width as readout/render (not a separate curve).
 * Denominator remains RING_SIZE_TO_MM (standardized inside diameter).
 */
function coverageStoneWidthMm(
  shape: ShapeId,
  carat: number,
  orientation: StoneOrientation,
): number {
  if (shape === "round") return getRoundDiamondMm(carat);
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

/* -------------------------------------------------------------------------- */
/* Scoped styles (theme + pieces that need raw CSS)                           */
/* -------------------------------------------------------------------------- */

function SuiteStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .dts-shell[data-theme="light"]{
        --gold: var(--hg-gold);
        --gold-soft: color-mix(in srgb, var(--hg-gold) 42%, #fff);
        --gold-warm: var(--hg-gold-deep);
        --topnav-active: var(--hg-ink);
        --topnav-idle: var(--hg-muted);
        /* parchment aliases — instrument chrome */
        --bg: var(--hg-ivory);
        --bg-deep: color-mix(in srgb, var(--hg-ivory) 88%, var(--hg-line));
        --card: var(--hg-surface);
        --card-edge: var(--hg-line);
        --ink: var(--hg-ink);
        --ink-soft: var(--hg-muted);
        --ink-mute: var(--hg-eyebrow);
        --hairline: var(--hg-line);
        --hairline-soft: color-mix(in srgb, var(--hg-line) 55%, #fff);
        --pill-active: color-mix(in srgb, var(--hg-surface) 70%, #fff);
        --pill-edge: var(--hg-line-strong);
        --shadow-1: 0 1px 2px rgba(48, 36, 28, 0.03), 0 4px 14px rgba(48, 36, 28, 0.035);
        --shadow-2: 0 1px 1px rgba(48, 36, 28, 0.025), 0 8px 28px rgba(48, 36, 28, 0.05);
        --sb-thumb: color-mix(in srgb, var(--hg-muted) 18%, transparent);
        --sb-thumb-hover: color-mix(in srgb, var(--hg-muted) 32%, transparent);
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
      .dts-app{
        position:relative;
        z-index:1;
        isolation:isolate;
        width:100%;
        height:auto;
        display:flex;
        flex-direction:column;
        min-height:0;
      }
      .dts-app::before{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background:
          radial-gradient(ellipse 60% 55% at 50% 38%,
            color-mix(in srgb, var(--bg) 92%, #fff) 0%,
            var(--bg) 60%,
            var(--bg-deep) 100%);
        z-index:0;
        transition: background 600ms ease;
      }
      @media (min-width: 1024px) {
        .dts-shell{
          height:auto;
          max-height:none;
          overflow:visible;
        }
        .dts-app{
          height: var(--dts-workspace-h, calc(100dvh - 7.5rem - 44px));
          max-height: var(--dts-workspace-h, calc(100dvh - 7.5rem - 44px));
          overflow:hidden;
          flex-shrink:0;
        }
        .dts-main{
          flex:1 1 auto;
          min-height:0;
          overflow:hidden;
        }
        .dts-editorial{
          position:relative;
          z-index:1;
          flex-shrink:0;
        }
      }
      .dts-main{
        position:relative;
        z-index:1;
        display:grid;
        grid-template-columns:256px minmax(0, 1fr);
        grid-template-rows:minmax(0, 1fr);
        overflow:visible;
        min-height:0;
        flex:1 1 auto;
        width:100%;
      }
      @media (min-width: 1024px) {
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
          max-height:100%;
          height:100%;
          min-width:0;
          overflow-x:hidden;
          overflow-y:auto;
          overscroll-behavior:contain;
          padding:12px 16px 12px 20px;
          display:flex;
          flex-direction:column;
          gap:13px;
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
        .dts-finger-stack{
          display:flex;
          flex-direction:column;
          gap:0;
          background:var(--card);
          border:1px solid var(--card-edge);
          border-radius:12px;
          box-shadow:var(--shadow-1);
          flex-shrink:0;
          overflow:visible;
          transition:border-color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease);
        }
        .dts-finger-stack .dts-card--finger,
        .dts-finger-stack .dts-card--band-width{
          background:transparent;
          border:none;
          border-radius:0;
          box-shadow:none;
          margin:0;
          padding:11px 12px 12px;
        }
        .dts-finger-stack .dts-card--finger{
          padding-bottom:0;
        }
        .dts-finger-stack .dts-card--band-width{
          padding-top:0;
          padding-bottom:11px;
        }
        .dts-finger-stack .dts-card--band-width .dts-band-width-block{
          margin-top:10px;
          padding-top:10px;
          border-top:1px solid oklch(from var(--hairline-soft) l c h / 0.85);
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
        padding:12px 0 20px;
        min-height:0;
        min-width:0;
      }
      .dts-card{
        background:var(--card); border:1px solid var(--card-edge); border-radius:12px;
        padding:11px 12px 12px; box-shadow:var(--shadow-1);
        transition:border-color var(--dt-dur-mid) var(--dt-ease), box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-card--coverage{
        padding:11px 12px 12px;
        border-color:oklch(from var(--card-edge) l c h / 0.88);
        box-shadow:var(--shadow-1), 0 0 0 1px oklch(from var(--hairline-soft) l c h / 0.42) inset;
      }
      .dts-card-head{
        display:flex; align-items:center; justify-content:space-between;
        font-size:9.5px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase;
        color:var(--ink-soft); margin:0 0 8px;
      }
      .dts-info{
        width:13px; height:13px; border-radius:50%; border:1px solid color-mix(in srgb, var(--ink-mute) 75%, transparent);
        color:var(--ink-mute); font-family:var(--serif); font-style:italic; font-size:9px;
        display:grid; place-items:center; cursor:help; line-height:1;
        padding:0; margin:0; background:transparent; font:inherit;
        appearance:none; -webkit-appearance:none;
        opacity:0.92;
        transition:border-color var(--dt-dur-mid) var(--dt-ease), opacity var(--dt-dur-mid) var(--dt-ease), color var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-info:hover{
        border-color:var(--ink-mute);
        opacity:1;
      }
      .dts-info:focus-visible{
        outline:2px solid var(--hg-focus-ring, #987648);
        outline-offset:2px;
      }
      .dts-stepper{
        display:flex; align-items:center; justify-content:center; gap:14px;
        margin:2px 0 6px;
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
        background:color-mix(in srgb, var(--card) 98%, #fff);
        box-shadow:0 1px 2px color-mix(in srgb, var(--hairline) 50%, transparent);
      }
      .dts-stepper button:focus-visible{
        outline:2px solid var(--hg-focus-ring, #987648);
        outline-offset:2px;
      }
      .dts-stepper button:disabled{ opacity:0.35; cursor:default; }
      .dts-stepper .dts-step-val{
        font-family:var(--serif); font-weight:400; font-size:28px; line-height:1;
        color:var(--ink); font-variant-numeric:tabular-nums lining-nums;
        min-width:56px; text-align:center;
      }
      .dts-slider{ position:relative; margin:6px 4px 2px; }
      .dts-slider--carat,
      .dts-slider--ring,
      .dts-slider--band{
        padding:0 8px;
        box-sizing:border-box;
      }
      .dts-slider--carat .dts-track,
      .dts-slider--ring .dts-track,
      .dts-slider--band .dts-track{
        margin-left:0;
        margin-right:0;
      }
      .dts-slider .dts-track{
        position:relative; height:1px; background:var(--hairline); margin:11px 8px 9px;
      }
      .dts-slider .dts-track:focus-visible{
        outline:2px solid var(--hg-focus-ring, #987648);
        outline-offset:8px;
        border-radius:6px;
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
        margin:7px 0 0;
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
        margin:6px 0 0;
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
      .dts-card-section{
        margin-top:10px;
        padding-top:10px;
        border-top:1px solid oklch(from var(--hairline-soft) l c h / 0.85);
      }
      .dts-card-subhead{
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin:0 0 6px;
        font-size:8.5px;
        font-weight:500;
        letter-spacing:0.14em;
        text-transform:uppercase;
        color:oklch(from var(--ink-mute) l c h / 0.88);
      }
      .dts-card-subhead-val{
        font-family:var(--serif);
        font-size:11px;
        font-weight:400;
        letter-spacing:0.02em;
        text-transform:none;
        color:var(--ink-soft);
        font-variant-numeric:tabular-nums;
      }
      .dts-tone-swatches{
        display:flex;
        gap:12px;
        align-items:flex-start;
        justify-content:center;
        margin:2px 0 4px;
      }
      .dts-tone-swatch{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:6px;
        padding:3px 4px 2px;
        border:none;
        border-radius:10px;
        background:transparent;
        cursor:pointer;
        transition:opacity var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-tone-swatch:hover .dts-tone-swatch-circle{
        border-color:oklch(from var(--ink-soft) l c h / 0.55);
      }
      .dts-tone-swatch:focus-visible{
        outline:1px solid oklch(from var(--gold-warm) l c h / 0.65);
        outline-offset:2px;
      }
      .dts-tone-swatch-circle{
        width:26px;
        height:26px;
        border-radius:50%;
        border:1px solid oklch(from var(--hairline) l c h / 0.95);
        box-shadow:inset 0 1px 2px oklch(0 0 0 / 0.06);
        transition:border-color var(--dt-dur-mid) var(--dt-ease),
          box-shadow var(--dt-dur-mid) var(--dt-ease);
      }
      .dts-tone-swatch.is-selected .dts-tone-swatch-circle{
        border-color:oklch(from var(--gold-warm) l c h / 0.72);
        box-shadow:0 0 0 1px var(--card), 0 0 0 2px oklch(from var(--gold-warm) l c h / 0.55),
          inset 0 1px 2px oklch(0 0 0 / 0.05);
      }
      .dts-tone-swatch-label{
        font-size:7.5px;
        font-weight:500;
        letter-spacing:0.12em;
        text-transform:uppercase;
        color:oklch(from var(--ink-mute) l c h / 0.82);
        line-height:1.2;
      }
      .dts-tone-swatch.is-selected .dts-tone-swatch-label{
        color:var(--ink-soft);
      }
      .dts-cov-pct{
        text-align:center; margin:4px 0 6px;
        font-family:var(--serif); font-size:32px; color:var(--ink); line-height:1.08; font-variant-numeric:tabular-nums;
      }
      .dts-cov-label{
        font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:var(--ink-soft); margin-top:4px; text-align:center;
      }
      .dts-zone-bar{ margin-top:12px; }
      .dts-zones{ position:relative; height:5px; border-radius:3px; background:var(--hairline-soft); margin:0 0 8px; }
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
        display:flex; justify-content:space-between; align-items:center; margin-top:7px;
        font-size:7.5px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-mute);
      }
      .dts-zone-labels .dts-endcap{ flex:0 0 auto; opacity:0.55; }
      .dts-zone-labels .dts-active-lbl{ flex:1 1 auto; text-align:center; color:var(--gold-warm); font-weight:600; letter-spacing:0.18em; }
      .dts-cov-helper{
        font-family:var(--serif); font-style:italic; font-size:10px; line-height:1.3;
        color:oklch(from var(--ink-soft) l c h / 0.88); margin:6px 2px 0; text-align:center;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .dts-card--presentation .dts-card-section .dts-card-head{
        margin-bottom:6px;
      }
      .dts-card--presentation .dts-cov-pct{
        font-size:28px;
        margin:2px 0 4px;
      }
      .dts-card--presentation .dts-zone-bar{
        margin-top:10px;
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
        overflow:hidden;
        --dts-framing-lift:-5.25%;
        --dts-composition-y:-12%;
        --dts-diamond-x-nudge:0px;
        --dts-diamond-y-nudge:-24px;
        --dts-ring-cluster-top:63.5%;
        --dts-ring-cluster-top-tall:62.1%;
      }
      .dts-stage-composition{
        position:absolute;
        inset:0;
        transform:translateY(var(--dts-composition-y, 0));
      }
      .dts-layer-finger{
        position:absolute; inset:0; z-index:1; overflow:hidden;
        isolation:isolate;
        transform:translateY(var(--dts-framing-lift));
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
        top:var(--dts-ring-cluster-top);
        transform:translate(calc(-50% + var(--dts-diamond-x-nudge, 0px)), calc(-50% + var(--dts-framing-lift, 0) + var(--dts-diamond-y-nudge, 0px)));
        transition:width var(--dt-dur-slow) var(--dt-ease),
          height var(--dt-dur-slow) var(--dt-ease),
          top var(--dt-dur-slow) var(--dt-ease),
          transform var(--dt-dur-slow) var(--dt-ease),
          opacity 200ms var(--dt-ease);
      }
      @media (min-width: 1024px) {
        /* Shared ring-cluster: finger crop + diamond anchor track viewer aspect (side-by-side desktop). */
        @container (aspect-ratio > 7 / 8.5) {
          .dts-layer-finger img{
            object-position:50% calc(42% + clamp(0%, (1 - (7 * 100cqh) / (9 * 100cqw)) * 67%, 26%));
          }
        }
        @container (aspect-ratio <= 7 / 8.5) {
          .dts-layer-diamond{
            top:var(--dts-ring-cluster-top-tall);
          }
        }
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
      .dts-diamond-stack--cad::before{
        display:none;
      }
      .dts-diamond-cad-frame{
        position:absolute; inset:0;
        transform:scale(var(--dts-cad-visible-scale));
        transform-origin:var(--dts-cad-center-x) var(--dts-cad-center-y);
      }
      /* Round retained circular clip from the reference CAD path; fancy shapes use alpha silhouette. */
      .dts-diamond-cad-frame[data-cad-shadow="round"]{
        clip-path:circle(49.5% at var(--dts-cad-center-x) var(--dts-cad-center-y));
        -webkit-clip-path:circle(49.5% at var(--dts-cad-center-x) var(--dts-cad-center-y));
      }
      .dts-diamond-cad-inner{
        position:absolute; inset:0;
      }
      .dts-diamond-cad-inner.dts-diamond-cad-inner--ew{
        transform:rotate(90deg);
        transform-origin:center center;
      }
      .dts-diamond-cad-inner .dts-diamond-face.dts-diamond-face--ew{
        transform:none;
      }
      .dts-cad-layers{
        position:absolute; inset:0;
      }
      .dts-cad-contact-shadow{
        position:absolute;
        left:50%;
        top:72%;
        width:68%;
        height:16%;
        transform:translate(-50%, -50%);
        pointer-events:none;
        z-index:0;
        background:radial-gradient(ellipse 52% 48% at 50% 46%,
          oklch(0 0 0 / 0.11) 0%,
          oklch(0 0 0 / 0.055) 38%,
          transparent 72%);
        filter:blur(6px);
        opacity:1;
      }
      .dts-cad-contact-shadow[data-cad-shadow="square"]{
        width:62%;
        height:15%;
        top:71%;
      }
      .dts-cad-contact-shadow[data-cad-shadow="elongated"]{
        width:58%;
        height:14%;
        top:73%;
      }
      .dts-diamond-cad-frame .dts-cad-base{
        position:absolute; inset:0;
        width:100%; height:100%;
        z-index:1;
        filter:none;
      }
      .dts-cad-scintillation{
        position:absolute; inset:0;
        pointer-events:none;
        z-index:2;
      }
      .dts-cad-variant-slot{
        position:absolute; inset:0;
        opacity:0;
        transition:opacity 340ms ease-out;
      }
      .dts-cad-variant-slot.is-visible{
        opacity:1;
        transition:opacity 190ms ease-in;
      }
      .dts-cad-variant-face{
        position:absolute; inset:0;
        width:100%; height:100%;
        object-fit:contain;
        display:block;
      }
      @media (prefers-reduced-motion: reduce){
        .dts-cad-variant-slot{
          transition:opacity 180ms ease;
        }
      }
      .dts-layer-diamond.is-swapping{ opacity:0; }
      .dts-sentence{
        position:relative; margin:0 12px 8px; text-align:center;
        font-family:var(--serif); font-weight:300; font-size:21px; color:var(--ink);
        letter-spacing:0.01em; pointer-events:none; z-index:30; flex:0 0 auto;
        line-height:1.35;
      }
      .dts-mobile-hero{
        flex:0 0 auto;
        width:100%;
      }
      .dts-sentence .dts-article{ font-style:italic; color:var(--ink-soft); }
      @media (min-width: 1024px) {
        .dts-sentence-br{ display:none; }
      }
      .dts-stage-trust{
        margin:0 12px 8px; padding:0 8px; text-align:center;
        font-size:11px; line-height:1.65; letter-spacing:0.05em;
        color:var(--ink-soft); font-weight:400;
      }
      .dts-page-title{
        margin:0 12px 2px; padding:0 8px; text-align:center;
        font-family:var(--serif); font-weight:400;
        font-size:clamp(1.05rem, 2.6vw, 1.3rem); line-height:1.25;
        letter-spacing:0.02em; color:var(--ink);
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
          padding:12px clamp(12px, 1.4vw, 16px) 12px clamp(14px, 2vw, 22px);
        }
        .dts-stage-stack{
          padding:0 clamp(8px, 1.2vw, 16px);
          box-sizing:border-box;
          min-width:0;
          max-width:100%;
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
      /* Below full desktop width: vertical document flow (stage → shapes → controls). */
      @media (max-width: 1023px) {
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
        .dts-main{
          display:flex !important;
          flex-direction:column !important;
          width:100% !important;
          gap:13px;
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
          max-width:none;
          padding:9px 16px 10px;
          margin-left:20px;
          margin-right:20px;
          width:calc(100% - 40px);
          box-sizing:border-box;
        }
        .dts-finger-stack{
          display:contents;
        }
        .dts-main .dts-card--finger{ order:3; }
        .dts-main .dts-card--carat{ order:6; }
        .dts-main .dts-card--presentation{
          order:8;
          padding-bottom:14px;
        }
        .dts-main .dts-card--band-width{
          order:7;
          margin-top:-6px;
          padding:7px 16px 8px;
        }
        .dts-main .dts-card--band-width .dts-band-width-block{
          margin-top:0;
          padding-top:0;
          border-top:none;
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
          margin:0;
          padding:0 20px;
          box-sizing:border-box;
          display:flex;
          flex-direction:column;
          align-items:center;
        }
        .dts-mobile-visual{
          order:4;
          width:100%;
          margin-top:0;
          padding:0 20px;
          box-sizing:border-box;
        }
        .dts-shape-strip-wrap{
          order:5;
          width:calc(100% - 40px);
          margin:2px 20px 6px;
          -webkit-mask-image:linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
          mask-image:linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
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
          margin:0 auto 4px;
          padding:0 2px;
          max-width:260px;
          position:relative !important;
          inset:auto !important;
          transform:none !important;
          width:100%;
        }
        .dts-stage-trust{
          margin:0 auto 8px;
          max-width:260px;
          width:100%;
          font-size:10px;
        }
        .dts-page-title{
          margin:0 auto 2px;
          max-width:280px;
          width:100%;
          font-size:clamp(1.05rem, 4.2vw, 1.2rem);
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
        .dts-diamond-stack--cad .dts-cad-base{
          filter:none;
        }
        .dts-layer-diamond{
          transform:translate(calc(-50% + 4px), calc(-50% - 2px + var(--dts-framing-lift, 0)));
        }
        .dts-viewer{
          width:min(480px, 92%);
          max-width:480px;
          min-width:0;
          margin:0 auto;
          max-height:min(58vh, 540px);
          aspect-ratio:7 / 9;
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
          padding:6px 10px 7px;
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
          min-height:38px;
          padding:4px 7px 3px;
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
          width:44px;
          height:44px;
          font-size:14px;
        }
        .dts-stepper .dts-step-val{
          font-size:24px;
          min-width:52px;
        }
        .dts-card-head{
          margin-bottom:6px;
        }
        .dts-card-subhead{
          margin-bottom:4px;
        }
        .dts-stepper{
          margin:0 0 4px;
        }
        .dts-slider{
          margin:4px 4px 0;
        }
        .dts-slider-endpoints{
          margin:5px 0 0;
        }
        .dts-card .dts-card-note{
          margin-top:4px;
        }
        .dts-carat-step-hint{
          margin-top:4px;
        }
        .dts-card-section{
          margin-top:8px;
          padding-top:8px;
        }
        .dts-tone-swatches{
          gap:10px;
          margin:1px 0 2px;
        }
        .dts-tone-swatch{
          gap:5px;
          padding:2px 4px 1px;
          min-height:44px;
          min-width:44px;
          justify-content:center;
        }
        .dts-skin-row{
          gap:5px;
        }
        .dts-skin-pill{
          min-height:44px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:5px 6px;
        }
        .dts-slider{
          touch-action:pan-x;
          -webkit-tap-highlight-color:transparent;
        }
        .dts-slider .dts-track{
          height:44px;
          min-height:44px;
          margin:-8px 8px -7px;
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
          height:44px;
          min-height:44px;
          margin:-19.5px 0 calc(9px - 19.5px);
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
          margin-top:4px;
          font-size:10px;
        }
        .dts-card--presentation .dts-card-section .dts-card-head{
          margin-bottom:4px;
        }
        .dts-card--presentation .dts-cov-pct{
          margin:0 0 2px;
        }
        .dts-card--presentation .dts-zone-bar{
          margin-top:8px;
        }
        .dts-cov-label{
          margin-top:2px;
        }
        .dts-zone-labels{
          margin-top:5px;
        }
      }
      @media (max-width: 768px) {
        .dts-layer-finger img{
          object-position:50% 38%;
        }
        .dts-viewer{
          width:100%;
          max-width:260px;
          max-height:min(48vh,352px);
          aspect-ratio:7 / 9.15;
          --dts-composition-y:-18%;
          --dts-framing-lift:-4.25%;
        }
        .dts-layer-diamond{
          transform:translate(calc(-50% + 4px), calc(-50% - 12px + var(--dts-framing-lift, 0)));
        }
        .dts-sentence{
          max-width:260px;
        }
        .dts-stage-trust{
          max-width:260px;
        }
        .dts-page-title{
          max-width:280px;
        }
      }
      @media (min-width: 769px) and (max-width: 1023px) {
        .dts-layer-finger img{
          object-position:50% 42%;
        }
        .dts-layer-diamond{
          transform:translate(calc(-50% + var(--dts-diamond-x-nudge, 0px)), calc(-50% + var(--dts-framing-lift, 0) + var(--dts-diamond-y-nudge, 0px)));
        }
        .dts-sentence,
        .dts-stage-trust,
        .dts-page-title{
          max-width:min(480px, 92%);
        }
      }
      @media (min-width: 1024px) {
        /* Decorative stage layers must not intercept side-rail controls. */
        .dts-viewer,
        .dts-stage-canvas{
          pointer-events:none;
        }
      }
      @media (min-width: 1024px) and (max-height: 900px) {
        .dts-control-rail{
          gap:11px;
          padding:10px 14px 10px 18px;
        }
        .dts-control-rail .dts-card{
          padding:10px 11px 11px;
        }
        .dts-finger-stack .dts-card--finger,
        .dts-finger-stack .dts-card--band-width{
          padding:10px 11px 11px;
        }
        .dts-finger-stack .dts-card--finger{
          padding-bottom:0;
        }
        .dts-finger-stack .dts-card--band-width{
          padding-top:0;
          padding-bottom:10px;
        }
        .dts-card--presentation .dts-cov-pct{
          font-size:26px;
        }
        .dts-card--presentation .dts-zone-bar{
          margin-top:8px;
        }
        .dts-card-section{
          margin-top:8px;
          padding-top:8px;
        }
      }
      @media (min-width: 1024px) and (max-height: 860px) {
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
          max-height:min(44vh, 400px);
        }
        .dts-stage-stack .dts-shape-strip-wrap{
          margin-bottom:clamp(12px, 1.8vh, 22px);
        }
      }
      @media (min-width: 1024px) and (max-height: 720px) {
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
        .dts-tone-swatch,
        .dts-stepper button,
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
 * {@link SHAPE_RENDER_VISUAL_COMP}. CAD stage assets live in DIAMOND_CAD_ASSETS.
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
    image: "/diamond-tech-suite/diamonds-v2/diamond-round-v2.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => {
      const d = getRoundDiamondMm(carat);
      return [d, d];
    },
  },
  oval: {
    id: "oval",
    label: "Oval",
    image: "/diamond-tech-suite/diamonds-v2/diamond-oval-v2.png",
    aspectRatio: ovalLengthOverWidthAt1ct(),
    caratToFaceMm: (carat) => ovalFaceDimensionsMm(carat),
  },
  cushion: {
    id: "cushion",
    label: "Cushion",
    image: "/diamond-tech-suite/diamonds-v2/diamond-cushion-v2.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => cushionFaceDimensionsMm(carat),
  },
  princess: {
    id: "princess",
    label: SHAPE_LABELS.princess,
    image: "/diamond-tech-suite/diamonds-v2/diamond-princess-v2.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => princessFaceDimensionsMm(carat),
  },
  marquise: {
    id: "marquise",
    label: SHAPE_LABELS.marquise,
    image: "/diamond-tech-suite/diamonds-v2/diamond-marquise-v2.png",
    aspectRatio: MARQUISE_LENGTH_RATIO,
    caratToFaceMm: (carat) => marquiseFaceDimensionsMm(carat),
  },
  pear: {
    id: "pear",
    label: SHAPE_LABELS.pear,
    image: "/diamond-tech-suite/diamonds-v2/diamond-pear-v2.png",
    aspectRatio: PEAR_LENGTH_RATIO,
    caratToFaceMm: (carat) => pearFaceDimensionsMm(carat),
  },
  emerald: {
    id: "emerald",
    label: SHAPE_LABELS.emerald,
    image: "/diamond-tech-suite/diamonds-v2/diamond-emerald-v2.png",
    aspectRatio: EMERALD_LENGTH_RATIO,
    caratToFaceMm: (carat) => emeraldFaceDimensionsMm(carat),
  },
  radiant: {
    id: "radiant",
    label: SHAPE_LABELS.radiant,
    image: "/diamond-tech-suite/diamonds-v2/diamond-radiant-v2.png",
    aspectRatio: RADIANT_LENGTH_RATIO,
    caratToFaceMm: (carat) => radiantFaceDimensionsMm(carat),
  },
  asscher: {
    id: "asscher",
    label: SHAPE_LABELS.asscher,
    image: "/diamond-tech-suite/diamonds-v2/diamond-asscher-v2.png",
    aspectRatio: 1,
    caratToFaceMm: (carat) => asscherFaceDimensionsMm(carat),
  },
};

function DiamondStageFace({
  shapeId,
  orientation,
  caratAdjusting,
  carat,
}: {
  shapeId: ShapeId;
  orientation: StoneOrientation;
  caratAdjusting: boolean;
  carat: number;
}) {
  const cad = getDiamondCadAsset(shapeId);
  const [faceSrc, setFaceSrc] = useState(cad.src);
  const faceRef = useRef<HTMLImageElement>(null);

  const cadFrameStyle = {
    "--dts-cad-visible-scale": cad.visibleScale,
    "--dts-cad-center-x": `${cad.centerX * 100}%`,
    "--dts-cad-center-y": `${cad.centerY * 100}%`,
  } as React.CSSProperties;

  const faceClass = `dts-diamond-face dts-cad-base${
    orientation === "ew" ? " dts-diamond-face--ew" : ""
  }`;

  const faceImg = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={faceRef}
      src={faceSrc}
      alt=""
      className={faceClass}
      onError={() => {
        setFaceSrc((prev) =>
          nextCadFallbackSrc(prev, cad, DIAMOND_SHAPE_FALLBACK),
        );
      }}
    />
  );

  return (
    <div className="dts-diamond-stack dts-diamond-stack--cad" style={cadFrameStyle}>
      <div className="dts-diamond-cad-frame" data-cad-shadow={cad.shadow}>
        <div
          className={`dts-diamond-cad-inner${
            orientation === "ew" ? " dts-diamond-cad-inner--ew" : ""
          }`}
        >
          <div className="dts-cad-layers">
            <div
              className="dts-cad-contact-shadow"
              data-cad-shadow={cad.shadow}
              aria-hidden
            />
            {faceImg}
            {cad.scintillationEnabled ? (
              <DiamondCadScintillation
                active={caratAdjusting}
                carat={carat}
                variants={cad.variants}
                shapeId={shapeId}
              />
            ) : null}
          </div>
        </div>
      </div>
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

/**
 * WCAG 2.1.1 keyboard support for the role="slider" tracks.
 *
 * Attached as a native listener on the track element itself (not a React
 * synthetic handler) so arrow keys work even if some other listener between
 * the track and the React root interferes with propagation. preventDefault
 * on handled keys keeps Up/Down/Home/End from scrolling the page.
 */
function attachSliderKeyboard(
  track: HTMLElement,
  handlers: {
    decrease: () => void;
    increase: () => void;
    home: () => void;
    end: () => void;
  },
) {
  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        handlers.decrease();
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        handlers.increase();
        break;
      case "Home":
        e.preventDefault();
        handlers.home();
        break;
      case "End":
        e.preventDefault();
        handlers.end();
        break;
    }
  };
  track.addEventListener("keydown", onKeyDown);
  return () => track.removeEventListener("keydown", onKeyDown);
}

export default function DiamondStudioPage() {
  const [ringSize, setRingSize] = useState(6.0);
  const [carat, setCarat] = useState(2.5);
  const [skinTone, setSkinTone] = useState<SkinTone>("light");
  const [bandWidth, setBandWidth] = useState<BandWidth>(2.5);
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

  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
      if (caratAdjustFadeTimer.current) {
        clearTimeout(caratAdjustFadeTimer.current);
      }
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

  const fingerImageSrc = getFingerImageSrc(skinTone, bandWidth);
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
      skinTone,
      orientation: stoneOrientation,
      coveragePercent,
      coverageZone,
      deviceType,
    };
  }, [
    shape,
    carat,
    ringSize,
    skinTone,
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

  const selectSkinTone = useCallback(
    (tone: SkinTone) => {
      if (tone === skinTone) return;
      setSkinTone(tone);
      trackDiamondStudioEvent("skin_tone_selected", {
        ...analyticsProps(),
        skinTone: tone,
      });
      recordMeaningfulInteraction();
    },
    [skinTone, analyticsProps, recordMeaningfulInteraction],
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

  const [caratAdjusting, setCaratAdjusting] = useState(false);
  const caratAdjustFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const markCaratAdjusting = useCallback(() => {
    setCaratAdjusting(true);
    if (caratAdjustFadeTimer.current) {
      clearTimeout(caratAdjustFadeTimer.current);
    }
    caratAdjustFadeTimer.current = setTimeout(() => {
      setCaratAdjusting(false);
      caratAdjustFadeTimer.current = null;
    }, CAD_ADJUST_HOLD_MS);
  }, []);

  const applyCarat = useCallback(
    (v: number, trackCommit: boolean) => {
      const next = snapCarat(v);
      setCarat((prev) => {
        if (Math.abs(prev - next) < 0.001) return prev;
        if (trackCommit) commitCaratAnalytics(next);
        return next;
      });
      markCaratAdjusting();
    },
    [commitCaratAnalytics, markCaratAdjusting],
  );

  const applyBandWidth = useCallback(
    (index: number, trackCommit: boolean) => {
      const next = indexToBandWidth(index);
      setBandWidth((prev) => {
        if (prev === next) return prev;
        if (trackCommit) recordMeaningfulInteraction();
        return next;
      });
    },
    [recordMeaningfulInteraction],
  );

  const fsTrackRef = useRef<HTMLDivElement>(null);
  const ctTrackRef = useRef<HTMLDivElement>(null);
  const bwTrackRef = useRef<HTMLDivElement>(null);
  const fsDrag = useRef(false);
  const ctDrag = useRef(false);
  const bwDrag = useRef(false);

  const fsPctToSize = (p: number) => 4 + p * 9;
  const ctPctToCarat = (p: number) => CARAT_MIN + p * (CARAT_MAX - CARAT_MIN);
  const bwPctToIndex = (p: number) =>
    Math.round(p * (BAND_WIDTH_VALUES.length - 1));

  const ringSizeRef = useRef(ringSize);
  ringSizeRef.current = ringSize;
  const caratRef = useRef(carat);
  caratRef.current = carat;
  const bandWidthRef = useRef(bandWidth);
  bandWidthRef.current = bandWidth;

  useEffect(() => {
    const el = fsTrackRef.current;
    if (!el) return;
    const detachTrack = attachHorizontalTrack(
      el,
      fsDrag,
      (p) => applyRingSize(fsPctToSize(p), false),
      () => commitFingerSizeAnalytics(ringSizeRef.current),
    );
    const detachKeys = attachSliderKeyboard(el, {
      decrease: () => applyRingSize(ringSizeRef.current - 0.5, true),
      increase: () => applyRingSize(ringSizeRef.current + 0.5, true),
      home: () => applyRingSize(4, true),
      end: () => applyRingSize(13, true),
    });
    return () => {
      detachTrack();
      detachKeys();
    };
  }, [applyRingSize, commitFingerSizeAnalytics]);

  useEffect(() => {
    const el = ctTrackRef.current;
    if (!el) return;
    const detachTrack = attachHorizontalTrack(
      el,
      ctDrag,
      (p) => {
        markCaratAdjusting();
        applyCarat(ctPctToCarat(p), false);
      },
      () => commitCaratAnalytics(caratRef.current),
    );
    const detachKeys = attachSliderKeyboard(el, {
      decrease: () => applyCarat(caratRef.current - CARAT_STEP, true),
      increase: () => applyCarat(caratRef.current + CARAT_STEP, true),
      home: () => applyCarat(CARAT_MIN, true),
      end: () => applyCarat(CARAT_MAX, true),
    });
    return () => {
      detachTrack();
      detachKeys();
    };
  }, [applyCarat, commitCaratAnalytics, markCaratAdjusting]);

  useEffect(() => {
    const el = bwTrackRef.current;
    if (!el) return;
    const detachTrack = attachHorizontalTrack(
      el,
      bwDrag,
      (p) => applyBandWidth(bwPctToIndex(p), false),
      () => applyBandWidth(bandWidthToIndex(bandWidthRef.current), true),
    );
    const detachKeys = attachSliderKeyboard(el, {
      decrease: () =>
        applyBandWidth(bandWidthToIndex(bandWidthRef.current) - 1, true),
      increase: () =>
        applyBandWidth(bandWidthToIndex(bandWidthRef.current) + 1, true),
      home: () => applyBandWidth(0, true),
      end: () => applyBandWidth(BAND_WIDTH_VALUES.length - 1, true),
    });
    return () => {
      detachTrack();
      detachKeys();
    };
  }, [applyBandWidth]);

  const fsHandleLeft = ((ringSize - 4) / 9) * 100;
  const ctHandleLeft = caratSliderPct(carat);
  const bwHandleLeft =
    (bandWidthToIndex(bandWidth) / (BAND_WIDTH_VALUES.length - 1)) * 100;
  return (
    <div className="dts-shell h-full min-h-full w-full" data-theme="light">
      <SuiteStyles />
      <div className="dts-app">
        <div className="dts-main diamond-studio-main diamond-studio-grid studio-layout">
          <aside
            className="dts-control-rail"
            aria-label="Diamond Studio controls"
            data-nosnippet
          >
            <div className="dts-finger-stack">
              <section
                className="dts-card dts-card--finger"
                aria-label="Finger"
              >
                <div className="dts-card-head">
                  <span>Finger</span>
                  <button
                    type="button"
                    className="dts-info"
                    aria-label="About ring size"
                    title="US ring size, 4 to 13"
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                </div>
                <div className="dts-card-subhead">
                  <span>Ring Size</span>
                </div>
                <div className="dts-stepper">
                  <button
                    type="button"
                    aria-label="Smaller ring size"
                    disabled={ringSize <= 4}
                    onClick={() => applyRingSize(ringSize - 0.5, true)}
                  >
                    ‹
                  </button>
                  <span className="dts-step-val">{ringSize.toFixed(1)}</span>
                  <button
                    type="button"
                    aria-label="Larger ring size"
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
                    role="slider"
                    tabIndex={0}
                    aria-label="Ring size"
                    aria-valuemin={4}
                    aria-valuemax={13}
                    aria-valuenow={ringSize}
                    aria-valuetext={`US ring size ${ringSize.toFixed(1)}`}
                    style={{ "--dts-fill": `${fsHandleLeft}%` } as React.CSSProperties}
                  >
                    <div
                      className="dts-handle"
                      aria-hidden
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

                <div className="dts-card-section">
                  <div className="dts-card-subhead">
                    <span>Skin Tone</span>
                  </div>
                  <div
                    className="dts-tone-swatches"
                    role="radiogroup"
                    aria-label="Skin tone"
                  >
                    {SKIN_TONE_SWATCHES.map(({ id, label, color }) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={skinTone === id}
                        className={`dts-tone-swatch ${skinTone === id ? "is-selected" : ""}`}
                        onClick={() => selectSkinTone(id)}
                      >
                        <span
                          className="dts-tone-swatch-circle"
                          style={{ background: color }}
                          aria-hidden
                        />
                        <span className="dts-tone-swatch-label">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section
                className="dts-card dts-card--band-width"
                aria-label="Band width"
              >
                <div className="dts-band-width-block">
                  <div className="dts-card-subhead">
                    <span>Band Width</span>
                    <span className="dts-card-subhead-val">
                      {bandWidth}mm band
                    </span>
                  </div>
                  <div className="dts-slider dts-slider--band">
                    <div
                      className="dts-track"
                      ref={bwTrackRef}
                      role="slider"
                      tabIndex={0}
                      aria-label="Band width"
                      aria-valuemin={BAND_WIDTH_VALUES[0]}
                      aria-valuemax={BAND_WIDTH_VALUES[BAND_WIDTH_VALUES.length - 1]}
                      aria-valuenow={bandWidth}
                      aria-valuetext={`${bandWidth} millimeter band`}
                      style={{ "--dts-fill": `${bwHandleLeft}%` } as React.CSSProperties}
                    >
                      <div
                        className="dts-handle"
                        aria-hidden
                        style={{ left: `${bwHandleLeft}%` }}
                      />
                    </div>
                    <div className="dts-slider-endpoints" aria-hidden>
                      <span>2 mm</span>
                      <span>5 mm</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="dts-card dts-card--carat" aria-label="Diamond">
              <div className="dts-card-head">
                <span>Diamond</span>
                <button
                  type="button"
                  className="dts-info"
                  aria-label="About diamond weight"
                  title="Stone weight in carats"
                >
                  <span aria-hidden="true">i</span>
                </button>
              </div>
              <div className="dts-card-subhead">
                <span>Diamond Weight</span>
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
                  role="slider"
                  tabIndex={0}
                  aria-label="Diamond weight"
                  aria-valuemin={CARAT_MIN}
                  aria-valuemax={CARAT_MAX}
                  aria-valuenow={carat}
                  aria-valuetext={`${carat.toFixed(2)} carats`}
                  style={{ "--dts-fill": `${ctHandleLeft}%` } as React.CSSProperties}
                >
                  <div
                    className="dts-handle"
                    aria-hidden
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
              className="dts-card dts-card--presentation dts-card--coverage"
              aria-label="Presentation"
            >
              <div className="dts-card-head">
                <span>Presentation</span>
              </div>
              <div className="dts-card-subhead">
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

              <div className="dts-card-section">
                <div className="dts-card-head">
                  <span>Finger Presence</span>
                  <button
                    type="button"
                    className="dts-info"
                    aria-label="About finger presence"
                    title="Stone width as a percentage of finger inside diameter"
                  >
                    <span aria-hidden="true">i</span>
                  </button>
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
                <p className="dts-cov-helper">{COVERAGE_ZONE_HELPERS_SHORT[zone]}</p>
              </div>
            </section>
          </aside>

          <div className="dts-stage-stack">
            <div
              className="dts-stage-preview"
              aria-label="Diamond on hand"
            >
              <div className="dts-mobile-hero studio-preview finger-preview">
                <h1 className="dts-page-title">See It On a Finger</h1>
                <p className="dts-sentence">
                  A {formatCaratForHeadline(carat)}-carat{" "}
                  {SHAPE_LABELS[shape].toLowerCase()} diamond,
                  <br className="dts-sentence-br" aria-hidden="true" />
                  {" "}
                  shown on a size {formatRingSizeForHeadline(ringSize)} finger.
                </p>
                <p className="dts-stage-trust">
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
                  <div className="dts-stage-composition">
                    <div className="dts-layer-finger" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fingerImageSrc} alt="" />
                    </div>

                    <div
                      className={`dts-layer-diamond ${diamondSwapping ? "is-swapping" : ""}`}
                      data-dts-stage-diamond-overlay=""
                      style={{
                        width: `${layerWidthCqw}cqw`,
                        height: `${layerHeightCqw}cqw`,
                      }}
                    >
                      <DiamondStageFace
                        key={diamondVisualShape}
                        shapeId={diamondVisualShape}
                        orientation={stoneOrientation}
                        caratAdjusting={caratAdjusting}
                        carat={carat}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dts-shape-strip-wrap" data-nosnippet>
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
                      <ShapeStripThumb
                        imageUrl={getDiamondCadAsset(s).switcherSrc}
                      />
                    </div>
                    <div className="dts-name">{SHAPE_SUITE_CONFIG[s].label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          
        </div>
      </div>
      <DiamondStudioEditorial />
    </div>
  );
}
