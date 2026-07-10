import {
  CARD_LONG_EDGE_MM,
  MIN_CARD_EDGE_DIAGONAL_FRACTION,
} from "./constants";
import type {
  CardCalibrationState,
  ContentPoint,
  GuidedCalibrationStep,
  OverlayPosition,
} from "./types";

export type ContentRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function createInitialCardCalibration(): CardCalibrationState {
  return {
    step: "photo-ready",
    cardA: null,
    cardB: null,
    fingerL: null,
    fingerR: null,
    framing: null,
  };
}

/** Default card long-edge seeds — user adjusts onto the real card. */
export function defaultCardEndpoints(): {
  cardA: ContentPoint;
  cardB: ContentPoint;
} {
  return {
    cardA: { u: 0.18, v: 0.72 },
    cardB: { u: 0.52, v: 0.72 },
  };
}

/** Default finger-edge seeds at a typical ring-seat height. */
export function defaultFingerEndpoints(): {
  fingerL: ContentPoint;
  fingerR: ContentPoint;
} {
  return {
    fingerL: { u: 0.44, v: 0.52 },
    fingerR: { u: 0.56, v: 0.52 },
  };
}

export function clampContentPoint(point: ContentPoint): ContentPoint {
  return {
    u: Math.max(0, Math.min(1, point.u)),
    v: Math.max(0, Math.min(1, point.v)),
  };
}

export function contentDistancePx(
  a: ContentPoint,
  b: ContentPoint,
  contentWidth: number,
  contentHeight: number,
): number {
  const dx = (b.u - a.u) * contentWidth;
  const dy = (b.v - a.v) * contentHeight;
  return Math.hypot(dx, dy);
}

export function isCardEdgeValid(
  a: ContentPoint,
  b: ContentPoint,
  contentWidth: number,
  contentHeight: number,
): boolean {
  if (contentWidth <= 0 || contentHeight <= 0) return false;
  const edgePx = contentDistancePx(a, b, contentWidth, contentHeight);
  const diagonal = Math.hypot(contentWidth, contentHeight);
  return edgePx >= diagonal * MIN_CARD_EDGE_DIAGONAL_FRACTION;
}

/**
 * Displayed-image pixels per millimeter from a marked card long edge.
 * Returns null when the edge is missing or too short.
 */
export function pixelsPerMmFromCard(
  a: ContentPoint | null,
  b: ContentPoint | null,
  contentWidth: number,
  contentHeight: number,
): number | null {
  if (!a || !b) return null;
  if (!isCardEdgeValid(a, b, contentWidth, contentHeight)) return null;
  const edgePx = contentDistancePx(a, b, contentWidth, contentHeight);
  if (edgePx <= 0) return null;
  return edgePx / CARD_LONG_EDGE_MM;
}

export function fingerMidpoint(
  left: ContentPoint,
  right: ContentPoint,
): ContentPoint {
  return clampContentPoint({
    u: (left.u + right.u) / 2,
    v: (left.v + right.v) / 2,
  });
}

export function isFingerSpanValid(
  left: ContentPoint,
  right: ContentPoint,
  contentWidth: number,
  contentHeight: number,
): boolean {
  if (contentWidth <= 0 || contentHeight <= 0) return false;
  const spanPx = contentDistancePx(left, right, contentWidth, contentHeight);
  return spanPx >= 4;
}

export function contentPointToStagePct(
  point: ContentPoint,
  content: ContentRect,
  stageWidth: number,
  stageHeight: number,
): OverlayPosition {
  if (stageWidth <= 0 || stageHeight <= 0) {
    return { xPct: 50, yPct: 50 };
  }
  const x = content.left + point.u * content.width;
  const y = content.top + point.v * content.height;
  return {
    xPct: Math.max(0, Math.min(100, (x / stageWidth) * 100)),
    yPct: Math.max(0, Math.min(100, (y / stageHeight) * 100)),
  };
}

export function stagePctToContentPoint(
  position: OverlayPosition,
  content: ContentRect,
  stageWidth: number,
  stageHeight: number,
): ContentPoint | null {
  if (content.width <= 0 || content.height <= 0) return null;
  if (stageWidth <= 0 || stageHeight <= 0) return null;
  const x = (position.xPct / 100) * stageWidth;
  const y = (position.yPct / 100) * stageHeight;
  return clampContentPoint({
    u: (x - content.left) / content.width,
    v: (y - content.top) / content.height,
  });
}

export function clientToContentPoint(
  clientX: number,
  clientY: number,
  stageLeft: number,
  stageTop: number,
  content: ContentRect,
): ContentPoint | null {
  if (content.width <= 0 || content.height <= 0) return null;
  const x = clientX - stageLeft;
  const y = clientY - stageTop;
  if (
    x < content.left ||
    x > content.left + content.width ||
    y < content.top ||
    y > content.top + content.height
  ) {
    return null;
  }
  return clampContentPoint({
    u: (x - content.left) / content.width,
    v: (y - content.top) / content.height,
  });
}

export function isCalibratedPreview(step: GuidedCalibrationStep): boolean {
  return step === "calibrated-preview";
}
