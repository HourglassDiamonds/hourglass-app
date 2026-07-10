/**
 * Source-calibrated framing math for Shape Studio.
 * Pure helpers — no React / DOM. Coordinates are normalized over the
 * browser-oriented source image (naturalWidth × naturalHeight).
 */
import { CARD_LONG_EDGE_MM } from "./constants";
import type { ContentPoint, FramingState } from "./types";

/** Seat must stay inside this inset from each crop edge (fraction of crop). */
export const FRAMING_SAFE_AREA = 0.15;

/**
 * Default crop width as a fraction of the maximum in-bounds crop width
 * for the current viewer aspect. Near-full keeps hand context; not aggressive.
 */
export const FRAMING_DEFAULT_CROP_OF_MAX = 0.88;

/** Tightest allowed crop relative to the default suggested width. */
export const FRAMING_MAX_ZOOM_FACTOR = 2.75;

/** Zoom button step (multiply / divide crop width). */
export const FRAMING_ZOOM_STEP = 1.12;

/**
 * Card exclusion padding along the marked long-edge direction,
 * as a fraction of marked edge length beyond each endpoint.
 */
export const FRAMING_CARD_PAD_ALONG = 0.08;

/**
 * Card exclusion padding perpendicular to the marked edge,
 * as a fraction of marked edge length. Conservative stand-in for the
 * unknown short-edge extent (ID-1 short/long ≈ 0.63; half ≈ 0.315).
 */
export const FRAMING_CARD_PAD_PERP = 0.40;

export type SourceSize = {
  width: number;
  height: number;
};

export type CropRectNorm = {
  leftU: number;
  topV: number;
  widthU: number;
  heightV: number;
};

export type ViewerPoint = {
  x: number;
  y: number;
};

export type SuggestedCropResult = {
  framing: FramingState;
  cardStillInFrame: boolean;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Maximum crop width (normalized) that still fits the source at viewer aspect. */
export function maxFittingCropWidthU(
  source: SourceSize,
  viewerAspect: number,
): number {
  if (source.width <= 0 || source.height <= 0 || viewerAspect <= 0) return 1;
  const byHeight = (source.height * viewerAspect) / source.width;
  return Math.min(1, byHeight);
}

export function cropHeightVFromWidthU(
  cropWidthU: number,
  source: SourceSize,
  viewerAspect: number,
): number {
  if (source.width <= 0 || source.height <= 0 || viewerAspect <= 0) return 1;
  const cropWidthPx = cropWidthU * source.width;
  const cropHeightPx = cropWidthPx / viewerAspect;
  return cropHeightPx / source.height;
}

export function clampCropWidthU(
  cropWidthU: number,
  source: SourceSize,
  viewerAspect: number,
  minCropWidthU?: number,
): number {
  const maxW = maxFittingCropWidthU(source, viewerAspect);
  const minW =
    minCropWidthU != null
      ? Math.min(minCropWidthU, maxW)
      : maxW / FRAMING_MAX_ZOOM_FACTOR;
  return clamp(cropWidthU, Math.max(1e-6, minW), maxW);
}

export function clampFramingCenter(
  centerU: number,
  centerV: number,
  cropWidthU: number,
  cropHeightV: number,
): { centerU: number; centerV: number } {
  const halfW = cropWidthU / 2;
  const halfH = cropHeightV / 2;
  return {
    centerU: clamp(centerU, halfW, 1 - halfW),
    centerV: clamp(centerV, halfH, 1 - halfH),
  };
}

/** Clamp crop width and center so the crop stays inside the source. */
export function clampFraming(
  framing: FramingState,
  source: SourceSize,
  viewerAspect: number,
  minCropWidthU?: number,
): FramingState {
  const cropWidthU = clampCropWidthU(
    framing.cropWidthU,
    source,
    viewerAspect,
    minCropWidthU,
  );
  const cropHeightV = cropHeightVFromWidthU(cropWidthU, source, viewerAspect);
  const center = clampFramingCenter(
    framing.centerU,
    framing.centerV,
    cropWidthU,
    cropHeightV,
  );
  return {
    centerU: center.centerU,
    centerV: center.centerV,
    cropWidthU,
  };
}

export function deriveCropRect(
  framing: FramingState,
  source: SourceSize,
  viewerAspect: number,
): CropRectNorm {
  const clamped = clampFraming(framing, source, viewerAspect);
  const heightV = cropHeightVFromWidthU(
    clamped.cropWidthU,
    source,
    viewerAspect,
  );
  return {
    leftU: clamped.centerU - clamped.cropWidthU / 2,
    topV: clamped.centerV - heightV / 2,
    widthU: clamped.cropWidthU,
    heightV,
  };
}

/** Viewer pixels per source pixel for the current crop. */
export function sourceToViewerScale(
  cropWidthU: number,
  sourceWidth: number,
  viewerWidth: number,
): number {
  const cropWidthPx = cropWidthU * sourceWidth;
  if (cropWidthPx <= 0 || viewerWidth <= 0) return 0;
  return viewerWidth / cropWidthPx;
}

/** Height-based scale must agree with width-based within float tolerance. */
export function sourceToViewerScaleFromHeight(
  cropHeightV: number,
  sourceHeight: number,
  viewerHeight: number,
): number {
  const cropHeightPx = cropHeightV * sourceHeight;
  if (cropHeightPx <= 0 || viewerHeight <= 0) return 0;
  return viewerHeight / cropHeightPx;
}

export function sourceCardEdgePx(
  cardA: ContentPoint,
  cardB: ContentPoint,
  source: SourceSize,
): number {
  const dx = (cardB.u - cardA.u) * source.width;
  const dy = (cardB.v - cardA.v) * source.height;
  return Math.hypot(dx, dy);
}

export function sourcePixelsPerMmFromCard(
  cardA: ContentPoint | null,
  cardB: ContentPoint | null,
  source: SourceSize,
): number | null {
  if (!cardA || !cardB) return null;
  if (source.width <= 0 || source.height <= 0) return null;
  const edgePx = sourceCardEdgePx(cardA, cardB, source);
  if (edgePx <= 0) return null;
  return edgePx / CARD_LONG_EDGE_MM;
}

export function displayPixelsPerMm(
  sourcePpm: number,
  framing: FramingState,
  source: SourceSize,
  viewerWidth: number,
): number {
  const scale = sourceToViewerScale(
    framing.cropWidthU,
    source.width,
    viewerWidth,
  );
  return sourcePpm * scale;
}

export function sourcePointToViewerPx(
  point: ContentPoint,
  framing: FramingState,
  source: SourceSize,
  viewerWidth: number,
  viewerHeight: number,
): ViewerPoint {
  const crop = deriveCropRect(
    framing,
    source,
    viewerWidth / Math.max(viewerHeight, 1e-9),
  );
  return {
    x: ((point.u - crop.leftU) / crop.widthU) * viewerWidth,
    y: ((point.v - crop.topV) / crop.heightV) * viewerHeight,
  };
}

export function viewerPointToSourcePoint(
  viewerX: number,
  viewerY: number,
  framing: FramingState,
  source: SourceSize,
  viewerWidth: number,
  viewerHeight: number,
): ContentPoint {
  const crop = deriveCropRect(
    framing,
    source,
    viewerWidth / Math.max(viewerHeight, 1e-9),
  );
  return {
    u: crop.leftU + (viewerX / viewerWidth) * crop.widthU,
    v: crop.topV + (viewerY / viewerHeight) * crop.heightV,
  };
}

/**
 * Pan: dragging the photo by (dx, dy) viewer pixels moves the crop center
 * in the opposite direction in source-normalized space.
 */
export function panFramingByViewerDelta(
  framing: FramingState,
  deltaViewerX: number,
  deltaViewerY: number,
  source: SourceSize,
  viewerWidth: number,
  viewerHeight: number,
): FramingState {
  const aspect = viewerWidth / Math.max(viewerHeight, 1e-9);
  const cropHeightV = cropHeightVFromWidthU(
    framing.cropWidthU,
    source,
    aspect,
  );
  const next = {
    centerU:
      framing.centerU - (deltaViewerX / viewerWidth) * framing.cropWidthU,
    centerV: framing.centerV - (deltaViewerY / viewerHeight) * cropHeightV,
    cropWidthU: framing.cropWidthU,
  };
  return clampFraming(next, source, aspect);
}

export function zoomFraming(
  framing: FramingState,
  direction: "in" | "out",
  source: SourceSize,
  viewerAspect: number,
  minCropWidthU?: number,
): FramingState {
  const factor =
    direction === "in" ? 1 / FRAMING_ZOOM_STEP : FRAMING_ZOOM_STEP;
  return clampFraming(
    { ...framing, cropWidthU: framing.cropWidthU * factor },
    source,
    viewerAspect,
    minCropWidthU,
  );
}

/** Axis-aligned exclusion zone around the marked card long-edge segment. */
export function cardExclusionBounds(
  cardA: ContentPoint,
  cardB: ContentPoint,
  source: SourceSize,
): { minU: number; maxU: number; minV: number; maxV: number } {
  const dxPx = (cardB.u - cardA.u) * source.width;
  const dyPx = (cardB.v - cardA.v) * source.height;
  const lenPx = Math.hypot(dxPx, dyPx) || 1;
  const ux = dxPx / lenPx;
  const uy = dyPx / lenPx;
  const nx = -uy;
  const ny = ux;
  const padAlong = FRAMING_CARD_PAD_ALONG * lenPx;
  const padPerp = FRAMING_CARD_PAD_PERP * lenPx;

  const corners: Array<{ x: number; y: number }> = [];
  for (const t of [-padAlong, lenPx + padAlong]) {
    for (const s of [-padPerp, padPerp]) {
      const ax = cardA.u * source.width;
      const ay = cardA.v * source.height;
      corners.push({
        x: ax + ux * t + nx * s,
        y: ay + uy * t + ny * s,
      });
    }
  }

  let minU = 1;
  let maxU = 0;
  let minV = 1;
  let maxV = 0;
  for (const c of corners) {
    const u = clamp(c.x / source.width, 0, 1);
    const v = clamp(c.y / source.height, 0, 1);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return { minU, maxU, minV, maxV };
}

function rectsOverlap(
  a: CropRectNorm,
  b: { minU: number; maxU: number; minV: number; maxV: number },
): boolean {
  const aRight = a.leftU + a.widthU;
  const aBottom = a.topV + a.heightV;
  return !(
    aRight <= b.minU ||
    a.leftU >= b.maxU ||
    aBottom <= b.minV ||
    a.topV >= b.maxV
  );
}

function seatInSafeArea(
  seat: ContentPoint,
  crop: CropRectNorm,
  safe = FRAMING_SAFE_AREA,
): boolean {
  const su = (seat.u - crop.leftU) / crop.widthU;
  const sv = (seat.v - crop.topV) / crop.heightV;
  return su >= safe && su <= 1 - safe && sv >= safe && sv <= 1 - safe;
}

/**
 * Bias crop center away from the card midpoint while keeping the seat
 * as the primary anchor.
 */
function biasedCenter(
  seat: ContentPoint,
  cardMid: ContentPoint,
  cropWidthU: number,
  cropHeightV: number,
): { centerU: number; centerV: number } {
  const du = seat.u - cardMid.u;
  const dv = seat.v - cardMid.v;
  const mag = Math.hypot(du, dv) || 1;
  /** Shift up to ~18% of crop size away from the card. */
  const shift = 0.18;
  const centerU = seat.u + (du / mag) * cropWidthU * shift;
  const centerV = seat.v + (dv / mag) * cropHeightV * shift;
  return clampFramingCenter(centerU, centerV, cropWidthU, cropHeightV);
}

/**
 * Deterministic suggested crop: seat-centered, card-biased, restrained zoom.
 * Does not use CV — only marked endpoints and source / viewer geometry.
 */
export function suggestInitialCrop(
  source: SourceSize,
  viewerAspect: number,
  cardA: ContentPoint,
  cardB: ContentPoint,
  ringSeat: ContentPoint,
): SuggestedCropResult {
  const maxW = maxFittingCropWidthU(source, viewerAspect);
  const defaultW = maxW * FRAMING_DEFAULT_CROP_OF_MAX;
  const minW = defaultW / FRAMING_MAX_ZOOM_FACTOR;
  const cardMid: ContentPoint = {
    u: (cardA.u + cardB.u) / 2,
    v: (cardA.v + cardB.v) / 2,
  };
  const exclusion = cardExclusionBounds(cardA, cardB, source);

  let best: FramingState = {
    centerU: ringSeat.u,
    centerV: ringSeat.v,
    cropWidthU: defaultW,
  };
  const bestHeight = cropHeightVFromWidthU(defaultW, source, viewerAspect);
  best = {
    ...best,
    ...biasedCenter(ringSeat, cardMid, defaultW, bestHeight),
    cropWidthU: defaultW,
  };
  best = clampFraming(best, source, viewerAspect, minW);

  let cardStillInFrame = true;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const widthU = defaultW * (1 - t) + minW * t;
    const heightV = cropHeightVFromWidthU(widthU, source, viewerAspect);
    let center = biasedCenter(ringSeat, cardMid, widthU, heightV);

    /** Extra push away from card if still overlapping. */
    for (let push = 0; push < 8; push++) {
      const framing = clampFraming(
        { ...center, cropWidthU: widthU },
        source,
        viewerAspect,
        minW,
      );
      const crop = deriveCropRect(framing, source, viewerAspect);
      if (!seatInSafeArea(ringSeat, crop)) break;
      if (!rectsOverlap(crop, exclusion)) {
        return { framing, cardStillInFrame: false };
      }
      const midU = (exclusion.minU + exclusion.maxU) / 2;
      const midV = (exclusion.minV + exclusion.maxV) / 2;
      const awayU = framing.centerU - midU;
      const awayV = framing.centerV - midV;
      const awayMag = Math.hypot(awayU, awayV) || 1;
      center = clampFramingCenter(
        framing.centerU + (awayU / awayMag) * widthU * 0.06,
        framing.centerV + (awayV / awayMag) * heightV * 0.06,
        widthU,
        heightV,
      );
      best = clampFraming(
        { ...center, cropWidthU: widthU },
        source,
        viewerAspect,
        minW,
      );
    }
  }

  const finalCrop = deriveCropRect(best, source, viewerAspect);
  cardStillInFrame = rectsOverlap(finalCrop, exclusion);
  return { framing: best, cardStillInFrame };
}

export function resetFramingToSuggested(
  source: SourceSize,
  viewerAspect: number,
  cardA: ContentPoint,
  cardB: ContentPoint,
  ringSeat: ContentPoint,
): SuggestedCropResult {
  return suggestInitialCrop(source, viewerAspect, cardA, cardB, ringSeat);
}

/**
 * CSS paint metrics for rendering the oriented source through the crop window.
 * Image display size maps the full source; offset reveals the crop.
 */
export function cropImagePaintStyle(
  framing: FramingState,
  source: SourceSize,
  viewerWidth: number,
  viewerHeight: number,
): { width: number; height: number; left: number; top: number } {
  const aspect = viewerWidth / Math.max(viewerHeight, 1e-9);
  const crop = deriveCropRect(framing, source, aspect);
  const width = viewerWidth / crop.widthU;
  const height = viewerHeight / crop.heightV;
  return {
    width,
    height,
    left: -crop.leftU * width,
    top: -crop.topV * height,
  };
}
