/**
 * Canonical representative face-up dimensions (mm).
 * Single source for Diamond Size Studio (readout, presence, render)
 * and Shape Studio (readout, render).
 *
 * Rules:
 * - Explicit anchors only at curated carats; piecewise-linear between them.
 * - No public extrapolation above the highest explicit anchor.
 * - No ring-size / finger-width / asset-padding inputs.
 * - Provisional seeds are reviewable, not independently validated.
 */

export type DiamondFaceShapeId =
  | "round"
  | "oval"
  | "cushion"
  | "princess"
  | "marquise"
  | "pear"
  | "emerald"
  | "radiant"
  | "asscher";

export const FACE_UP_REVIEW_CARATS = [
  1, 1.5, 2, 3, 4, 5, 7, 10,
] as const;

export type FaceUpReviewCarat = (typeof FACE_UP_REVIEW_CARATS)[number];

export type FaceUpAnchorProvenance =
  | "locked-anchor"
  | "provisional-anchor"
  | "interpolated";

export type FaceUpReviewStatus =
  | "locked"
  | "provisionally-acceptable"
  | "needs-justin-review"
  | "rejected";

export type RepresentativeFaceUpDimensions = {
  shape: DiamondFaceShapeId;
  carat: number;
  widthMm: number;
  lengthMm: number;
  lengthToWidthRatio: number;
  provenance: FaceUpAnchorProvenance;
  anchored: boolean;
  interpolated: boolean;
  reviewStatus: FaceUpReviewStatus;
};

/** Review carats required for every public shape. */
type AnchorPair = readonly [widthMm: number, lengthMm: number];

/**
 * Round: preserve existing industry-style anchors (locked).
 * Intermediate historical points (0.5, 2.5, 6, 8, 9) kept so 0.25-ct
 * steps between locked review carats stay continuous with prior behavior.
 */
const ROUND_ANCHORS: Record<number, AnchorPair> = {
  0.5: [5.1, 5.1],
  1.0: [6.5, 6.5],
  1.5: [7.3, 7.3],
  2.0: [8.1, 8.1],
  2.5: [8.8, 8.8],
  3.0: [9.3, 9.3],
  4.0: [10.2, 10.2],
  5.0: [11.0, 11.0],
  6.0: [11.7, 11.7],
  7.0: [12.3, 12.3],
  8.0: [12.9, 12.9],
  9.0: [13.4, 13.4],
  10.0: [14.0, 14.0],
};

/**
 * Oval: reviewed anchors through 5 ct (provisionally acceptable).
 * 7 / 10 ct: provisional cube-root seeds from the 5 ct anchor
 * (NOT the rejected linear 15.0 × 21.5). Require Justin review.
 */
function cbrtScaleFrom5ct(carat: number): AnchorPair {
  const scale = Math.cbrt(carat / 5);
  return [10.0 * scale, 14.0 * scale];
}

const OVAL_ANCHORS: Record<number, AnchorPair> = {
  0.5: [4.0, 6.0],
  1.0: [5.5, 8.0],
  1.5: [6.5, 9.0],
  2.0: [7.0, 10.0],
  2.5: [7.5, 10.5],
  3.0: [8.0, 11.5],
  4.0: [9.0, 12.5],
  5.0: [10.0, 14.0],
  7.0: cbrtScaleFrom5ct(7),
  10.0: cbrtScaleFrom5ct(10),
};

/** Legacy round-derived factors — used only to seed provisional tables. */
const SEED = {
  cushion: { spread: 0.96 },
  princess: { spread: 0.92 },
  asscher: { spread: 0.9 },
  radiant: { width: 0.95, ratio: 1.3 },
  emerald: { width: 0.93, ratio: 1.4 },
  marquise: { width: 0.75, ratio: 2.0 },
  pear: { width: 0.82, ratio: 1.55 },
} as const;

function roundAt(carat: number): number {
  const keys = Object.keys(ROUND_ANCHORS)
    .map(Number)
    .sort((a, b) => a - b);
  const loK = keys[0]!;
  const hiK = keys[keys.length - 1]!;
  if (carat <= loK) return ROUND_ANCHORS[loK]![0];
  if (carat >= hiK) return ROUND_ANCHORS[hiK]![0];
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i]!;
    const hi = keys[i + 1]!;
    if (carat >= lo && carat <= hi) {
      const t = (carat - lo) / (hi - lo);
      return ROUND_ANCHORS[lo]![0] + (ROUND_ANCHORS[hi]![0] - ROUND_ANCHORS[lo]![0]) * t;
    }
  }
  return ROUND_ANCHORS[hiK]![0];
}

function seedSquare(spread: number, carat: number): AnchorPair {
  const d = roundAt(carat) * spread;
  return [d, d];
}

function seedElongated(
  widthFactor: number,
  lengthRatio: number,
  carat: number,
): AnchorPair {
  const w = roundAt(carat) * widthFactor;
  return [w, w * lengthRatio];
}

function buildProvisionalTable(
  seedAt: (carat: number) => AnchorPair,
): Record<number, AnchorPair> {
  const table: Record<number, AnchorPair> = {};
  for (const c of FACE_UP_REVIEW_CARATS) {
    table[c] = seedAt(c);
  }
  return table;
}

const CUSHION_ANCHORS = buildProvisionalTable((c) =>
  seedSquare(SEED.cushion.spread, c),
);
const PRINCESS_ANCHORS = buildProvisionalTable((c) =>
  seedSquare(SEED.princess.spread, c),
);
const ASSCHER_ANCHORS = buildProvisionalTable((c) =>
  seedSquare(SEED.asscher.spread, c),
);
const RADIANT_ANCHORS = buildProvisionalTable((c) =>
  seedElongated(SEED.radiant.width, SEED.radiant.ratio, c),
);
const EMERALD_ANCHORS = buildProvisionalTable((c) =>
  seedElongated(SEED.emerald.width, SEED.emerald.ratio, c),
);
const MARQUISE_ANCHORS = buildProvisionalTable((c) =>
  seedElongated(SEED.marquise.width, SEED.marquise.ratio, c),
);
const PEAR_ANCHORS = buildProvisionalTable((c) =>
  seedElongated(SEED.pear.width, SEED.pear.ratio, c),
);

const FACE_UP_ANCHORS: Record<DiamondFaceShapeId, Record<number, AnchorPair>> = {
  round: ROUND_ANCHORS,
  oval: OVAL_ANCHORS,
  cushion: CUSHION_ANCHORS,
  princess: PRINCESS_ANCHORS,
  asscher: ASSCHER_ANCHORS,
  radiant: RADIANT_ANCHORS,
  emerald: EMERALD_ANCHORS,
  marquise: MARQUISE_ANCHORS,
  pear: PEAR_ANCHORS,
};

/** Rejected historical values — must never be returned by the canonical API. */
export const REJECTED_DIMENSIONS = {
  oval10Linear: { widthMm: 15.0, lengthMm: 21.5 },
  round10CoverageShapeAnchors: { widthMm: 15.0 },
} as const;

function anchorKeys(shape: DiamondFaceShapeId): number[] {
  return Object.keys(FACE_UP_ANCHORS[shape])
    .map(Number)
    .sort((a, b) => a - b);
}

function reviewStatusForAnchor(
  shape: DiamondFaceShapeId,
  carat: number,
): FaceUpReviewStatus {
  if (shape === "round") return "locked";
  if (shape === "oval") {
    if (carat === 7 || carat === 10) return "needs-justin-review";
    if (carat <= 5) return "provisionally-acceptable";
    return "needs-justin-review";
  }
  return "needs-justin-review";
}

function provenanceForExactAnchor(
  shape: DiamondFaceShapeId,
): FaceUpAnchorProvenance {
  if (shape === "round") return "locked-anchor";
  return "provisional-anchor";
}

/**
 * Piecewise-linear interpolation between explicit anchors.
 * Clamps to the highest/lowest anchor — no public extrapolation.
 */
function interpExplicitAnchors(
  anchors: Record<number, AnchorPair>,
  carat: number,
): { pair: AnchorPair; exact: boolean; lo: number; hi: number } {
  const keys = Object.keys(anchors)
    .map(Number)
    .sort((a, b) => a - b);
  const loK = keys[0]!;
  const hiK = keys[keys.length - 1]!;
  if (carat <= loK) return { pair: anchors[loK]!, exact: carat === loK, lo: loK, hi: loK };
  if (carat >= hiK) return { pair: anchors[hiK]!, exact: carat === hiK, lo: hiK, hi: hiK };
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i]!;
    const hi = keys[i + 1]!;
    if (carat >= lo && carat <= hi) {
      if (carat === lo) return { pair: anchors[lo]!, exact: true, lo, hi: lo };
      if (carat === hi) return { pair: anchors[hi]!, exact: true, lo: hi, hi };
      const t = (carat - lo) / (hi - lo);
      const [wL, lL] = anchors[lo]!;
      const [wH, lH] = anchors[hi]!;
      return {
        pair: [wL + (wH - wL) * t, lL + (lH - lL) * t],
        exact: false,
        lo,
        hi,
      };
    }
  }
  return { pair: anchors[hiK]!, exact: false, lo: hiK, hi: hiK };
}

/**
 * Canonical API — one representative face-up result for every public shape/carat.
 */
export function getRepresentativeFaceUpDimensions(
  shape: DiamondFaceShapeId,
  carat: number,
): RepresentativeFaceUpDimensions {
  const anchors = FACE_UP_ANCHORS[shape];
  const { pair, exact } = interpExplicitAnchors(anchors, carat);
  const [rawW, rawL] = pair;
  const widthMm = Math.min(rawW, rawL);
  const lengthMm = Math.max(rawW, rawL);
  const lengthToWidthRatio = lengthMm / Math.max(widthMm, 1e-9);

  let provenance: FaceUpAnchorProvenance;
  let reviewStatus: FaceUpReviewStatus;
  if (exact && anchors[carat]) {
    provenance = provenanceForExactAnchor(shape);
    reviewStatus = reviewStatusForAnchor(shape, carat);
  } else {
    provenance = "interpolated";
    // Interpolated cells inherit the stricter endpoint status.
    const keys = anchorKeys(shape);
    let lo = keys[0]!;
    let hi = keys[keys.length - 1]!;
    for (let i = 0; i < keys.length - 1; i++) {
      if (carat >= keys[i]! && carat <= keys[i + 1]!) {
        lo = keys[i]!;
        hi = keys[i + 1]!;
        break;
      }
    }
    const statuses = [reviewStatusForAnchor(shape, lo), reviewStatusForAnchor(shape, hi)];
    if (statuses.includes("needs-justin-review")) reviewStatus = "needs-justin-review";
    else if (statuses.includes("provisionally-acceptable"))
      reviewStatus = "provisionally-acceptable";
    else reviewStatus = "locked";
  }

  return {
    shape,
    carat,
    widthMm,
    lengthMm,
    lengthToWidthRatio,
    provenance,
    anchored: exact,
    interpolated: !exact,
    reviewStatus,
  };
}

/** Convenience: [width, length] for render/readout paths. */
export function faceAxesForSizing(
  shape: DiamondFaceShapeId,
  carat: number,
): [width: number, length: number] {
  const d = getRepresentativeFaceUpDimensions(shape, carat);
  return [d.widthMm, d.lengthMm];
}

export function getRoundDiamondMm(carat: number): number {
  return getRepresentativeFaceUpDimensions("round", carat).widthMm;
}

/** Stage aspect helpers (render-only CSS); mm still from canonical API. */
export const RADIANT_LENGTH_RATIO = SEED.radiant.ratio;
export const EMERALD_LENGTH_RATIO = SEED.emerald.ratio;
export const MARQUISE_LENGTH_RATIO = SEED.marquise.ratio;
export const PEAR_LENGTH_RATIO = SEED.pear.ratio;

export type FaceDimensionProvenance =
  | "explicit-anchor"
  | "interpolated"
  | "provisional-anchor"
  | "locked-anchor";

/** @deprecated Prefer getRepresentativeFaceUpDimensions(...).provenance */
export function faceDimensionProvenance(
  shape: DiamondFaceShapeId,
  carat: number,
): FaceDimensionProvenance {
  const p = getRepresentativeFaceUpDimensions(shape, carat).provenance;
  if (p === "locked-anchor" || p === "provisional-anchor") return "explicit-anchor";
  return "interpolated";
}

export type DimensionReviewRow = {
  shape: DiamondFaceShapeId;
  carat: number;
  currentWidth: number;
  currentLength: number;
  currentRatio: number;
  currentProvenance: string;
  proposedWidth: number;
  proposedLength: number;
  proposedRatio: number;
  proposedProvenance: FaceUpAnchorProvenance;
  reviewStatus: FaceUpReviewStatus;
  notes: string;
};

/** Legacy current-path values for the review artifact (pre-authority snapshot). */
function legacyCurrentAxes(
  shape: DiamondFaceShapeId,
  carat: number,
): { w: number; l: number; provenance: string } {
  const round = (c: number) => {
    // Historical round table (same locked values).
    return getRoundDiamondMm(c);
  };
  if (shape === "round") {
    return { w: round(carat), l: round(carat), provenance: "locked-anchor" };
  }
  if (shape === "oval") {
    const ovalLegacy: Record<number, [number, number]> = {
      1: [5.5, 8],
      1.5: [6.5, 9],
      2: [7, 10],
      3: [8, 11.5],
      4: [9, 12.5],
      5: [10, 14],
    };
    if (ovalLegacy[carat]) {
      const [w, l] = ovalLegacy[carat]!;
      return { w, l, provenance: "explicit-anchor" };
    }
    if (carat > 5) {
      // Rejected linear extrapolation from 4→5 slope.
      const extra = carat - 5;
      return {
        w: 10 + 1 * extra,
        l: 14 + 1.5 * extra,
        provenance: "linear-extrapolated-REJECTED",
      };
    }
    return { w: 5.5, l: 8, provenance: "explicit-anchor" };
  }
  const factors: Record<
    string,
    { kind: "square"; spread: number } | { kind: "elong"; w: number; r: number }
  > = {
    cushion: { kind: "square", spread: 0.96 },
    princess: { kind: "square", spread: 0.92 },
    asscher: { kind: "square", spread: 0.9 },
    radiant: { kind: "elong", w: 0.95, r: 1.3 },
    emerald: { kind: "elong", w: 0.93, r: 1.4 },
    marquise: { kind: "elong", w: 0.75, r: 2.0 },
    pear: { kind: "elong", w: 0.82, r: 1.55 },
  };
  const f = factors[shape]!;
  if (f.kind === "square") {
    const d = round(carat) * f.spread;
    return { w: d, l: d, provenance: "round-derived-fixed-ratio" };
  }
  const w = round(carat) * f.w;
  return { w, l: w * f.r, provenance: "round-derived-fixed-ratio" };
}

export function buildDimensionReviewArtifact(): DimensionReviewRow[] {
  const rows: DimensionReviewRow[] = [];
  const shapes = Object.keys(FACE_UP_ANCHORS) as DiamondFaceShapeId[];
  for (const shape of shapes) {
    for (const carat of FACE_UP_REVIEW_CARATS) {
      const cur = legacyCurrentAxes(shape, carat);
      const prop = getRepresentativeFaceUpDimensions(shape, carat);
      const curW = Math.min(cur.w, cur.l);
      const curL = Math.max(cur.w, cur.l);
      let notes = "";
      let status = prop.reviewStatus;
      if (shape === "oval" && (carat === 7 || carat === 10)) {
        status = "needs-justin-review";
        notes =
          `Rejected linear ${curW.toFixed(1)}×${curL.toFixed(1)}; ` +
          `proposed cell is provisional cbrt-from-5ct seed — not curated.`;
      } else if (shape === "round") {
        status = "locked";
        notes = "Existing round brilliant anchors preserved.";
      } else if (shape === "oval" && carat <= 5) {
        status = "provisionally-acceptable";
        notes = "Existing oval anchor through 5 ct; pending final sign-off.";
      } else {
        status = "needs-justin-review";
        notes =
          "Seeded from prior round-derived formula into an explicit provisional anchor cell.";
      }
      // Flag ratio drift / discontinuity vs neighbors in proposed table
      if (shape !== "round" && carat > 1) {
        const idx = FACE_UP_REVIEW_CARATS.indexOf(carat);
        if (idx > 0) {
          const prev = getRepresentativeFaceUpDimensions(
            shape,
            FACE_UP_REVIEW_CARATS[idx - 1]!,
          );
          if (prop.widthMm + 1e-9 < prev.widthMm || prop.lengthMm + 1e-9 < prev.lengthMm) {
            status = "rejected";
            notes += " Non-monotonic vs prior carat.";
          }
        }
      }
      rows.push({
        shape,
        carat,
        currentWidth: Number(curW.toFixed(4)),
        currentLength: Number(curL.toFixed(4)),
        currentRatio: Number((curL / Math.max(curW, 1e-9)).toFixed(4)),
        currentProvenance: cur.provenance,
        proposedWidth: Number(prop.widthMm.toFixed(4)),
        proposedLength: Number(prop.lengthMm.toFixed(4)),
        proposedRatio: Number(prop.lengthToWidthRatio.toFixed(4)),
        proposedProvenance: prop.provenance,
        reviewStatus: status,
        notes,
      });
    }
  }
  return rows;
}

/** Expose anchors for tests / review tooling (immutable snapshot). */
export function getFaceUpAnchorTable(
  shape: DiamondFaceShapeId,
): Readonly<Record<number, AnchorPair>> {
  return FACE_UP_ANCHORS[shape];
}
