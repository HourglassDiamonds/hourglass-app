import type { ShapeId } from "./types";

export const RING_SIZE_MIN = 4.0;
export const RING_SIZE_MAX = 13.0;
export const RING_SIZE_STEP = 0.5;

export const CARAT_MIN = 1.0;
export const CARAT_MAX = 10.0;
export const CARAT_STEP = 0.25;

/** US ring size → finger diameter (mm). Matches Diamond Size Studio. */
export const RING_SIZE_TO_MM: Record<number, number> = {
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

export const SHAPE_LABELS: Record<ShapeId, string> = {
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

export const SHAPES: ShapeId[] = [
  "round",
  "oval",
  "cushion",
  "radiant",
  "emerald",
  "pear",
  "marquise",
  "princess",
  "asscher",
];

/** Root path for overlay PNGs — swap files here for premium renders. */
export const SHAPE_ASSET_BASE = "/shape-studio/assets";

export function shapeAssetPath(shapeId: ShapeId): string {
  return `${SHAPE_ASSET_BASE}/${shapeId}.png`;
}

export function snapRingSize(value: number): number {
  const stepped = Math.round(value / RING_SIZE_STEP) * RING_SIZE_STEP;
  return Math.max(
    RING_SIZE_MIN,
    Math.min(RING_SIZE_MAX, Math.round(stepped * 10) / 10),
  );
}

export function snapCarat(value: number): number {
  const snapped = Math.round(value / CARAT_STEP) * CARAT_STEP;
  return Math.max(
    CARAT_MIN,
    Math.min(CARAT_MAX, Math.round(snapped * 100) / 100),
  );
}

export function ringSizeSliderPct(value: number): number {
  return ((value - RING_SIZE_MIN) / (RING_SIZE_MAX - RING_SIZE_MIN)) * 100;
}

export function caratSliderPct(value: number): number {
  return ((value - CARAT_MIN) / (CARAT_MAX - CARAT_MIN)) * 100;
}

export function ringSizeFromSliderPct(pct: number): number {
  const raw =
    RING_SIZE_MIN + pct * (RING_SIZE_MAX - RING_SIZE_MIN);
  return snapRingSize(raw);
}

export function caratFromSliderPct(pct: number): number {
  const raw = CARAT_MIN + pct * (CARAT_MAX - CARAT_MIN);
  return snapCarat(raw);
}
