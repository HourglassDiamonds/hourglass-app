import type { ShapeId } from "./types";

/** Round brilliant face-up diameter (mm) — industry-style anchors. */
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

const SHAPE_ANCHORS: Record<ShapeId, Record<number, [number, number]>> = {
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

export function getRoundDiamondMm(carat: number): number {
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
      return table[lo]! + (table[hi]! - table[lo]!) * t;
    }
  }
  return table[hiK]!;
}

function shapeDimensionsMm(shape: ShapeId, carat: number): [number, number] {
  return interpAnchors(SHAPE_ANCHORS[shape] ?? SHAPE_ANCHORS.round, carat);
}

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

/**
 * Oval face-up axes (mm).
 * Through the final table anchor: linear interpolation between explicit anchors.
 * Above the final anchor: cube-root scale from that anchor (volume-consistent),
 * not linear slope extrapolation (which inflated 10 ct to 15.0 × 21.5).
 */
function ovalFaceDimensionsMm(carat: number): [number, number] {
  const keys = Object.keys(OVAL_FACE_MM_BY_CARAT)
    .map(Number)
    .sort((a, b) => a - b);
  const finalCarat = keys[keys.length - 1]!;
  if (carat > finalCarat) {
    const [wFinal, lFinal] = OVAL_FACE_MM_BY_CARAT[finalCarat]!;
    const scale = Math.cbrt(carat / finalCarat);
    return [wFinal * scale, lFinal * scale];
  }
  return interpAnchors(OVAL_FACE_MM_BY_CARAT, carat);
}

const CUSHION_SPREAD_FACTOR = 0.96;
function cushionFaceDimensionsMm(carat: number): [number, number] {
  const d = getRoundDiamondMm(carat) * CUSHION_SPREAD_FACTOR;
  return [d, d];
}

const PRINCESS_SPREAD_FACTOR = 0.92;
function princessFaceDimensionsMm(carat: number): [number, number] {
  const d = getRoundDiamondMm(carat) * PRINCESS_SPREAD_FACTOR;
  return [d, d];
}

const RADIANT_WIDTH_FACTOR = 0.95;
const RADIANT_LENGTH_RATIO = 1.3;
function radiantFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * RADIANT_WIDTH_FACTOR;
  return [w, w * RADIANT_LENGTH_RATIO];
}

const EMERALD_WIDTH_FACTOR = 0.93;
const EMERALD_LENGTH_RATIO = 1.4;
function emeraldFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * EMERALD_WIDTH_FACTOR;
  return [w, w * EMERALD_LENGTH_RATIO];
}

const MARQUISE_WIDTH_FACTOR = 0.75;
const MARQUISE_LENGTH_RATIO = 2.0;
function marquiseFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * MARQUISE_WIDTH_FACTOR;
  return [w, w * MARQUISE_LENGTH_RATIO];
}

const PEAR_WIDTH_FACTOR = 0.82;
const PEAR_LENGTH_RATIO = 1.55;
function pearFaceDimensionsMm(carat: number): [number, number] {
  const w = getRoundDiamondMm(carat) * PEAR_WIDTH_FACTOR;
  return [w, w * PEAR_LENGTH_RATIO];
}

const ASSCHER_SPREAD_FACTOR = 0.9;
function asscherFaceDimensionsMm(carat: number): [number, number] {
  const d = getRoundDiamondMm(carat) * ASSCHER_SPREAD_FACTOR;
  return [d, d];
}

export function faceAxesForSizing(
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

export function renderStoneWidthMm(shape: ShapeId, carat: number): number {
  if (shape === "round") return getRoundDiamondMm(carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return Math.min(w, l);
}

export function renderStoneHeightMm(shape: ShapeId, carat: number): number {
  if (shape === "round") return getRoundDiamondMm(carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return Math.max(w, l);
}

export type DimensionReadout = {
  widthMm: number;
  lengthMm: number;
  label: string;
};

export function formatDimensionReadout(
  shape: ShapeId,
  carat: number,
): DimensionReadout {
  if (shape === "round") {
    const d = getRoundDiamondMm(carat);
    return {
      widthMm: d,
      lengthMm: d,
      label: `${d.toFixed(1)} mm`,
    };
  }
  const [w, l] = faceAxesForSizing(shape, carat);
  const width = Math.min(w, l);
  const length = Math.max(w, l);
  return {
    widthMm: width,
    lengthMm: length,
    label: `${width.toFixed(1)} × ${length.toFixed(1)} mm`,
  };
}
