/**
 * Canonical on-stage diamond sizing and snapshot framing.
 *
 * These numbers are the live Diamond Studio math, extracted so snapshot
 * composition cannot drift from the viewer. Do not add a second sizing table.
 *
 * Snapshot framing is the desktop Size Studio stage (≥1024px, 7:9 viewer):
 * ring-cluster top uses the tall-container value (62.1%). Mobile-only
 * scale and pixel nudges are intentionally excluded so the generated
 * image is device-independent.
 */

import type { ShapeId } from "@/app/diamond-studio/components/diamond-cad-types";
import { getDiamondCadAsset } from "@/app/diamond-studio/components/diamond-cad-assets";
import {
  faceAxesForSizing,
  getRoundDiamondMm,
} from "@/lib/diamond-tech-suite/face-dimensions";
import type {
  DiamondStudioConfiguration,
  StudioOrientation,
} from "@/lib/diamond-studio/configuration";

/** US ring size → inside diameter (mm). Live Studio denominator. */
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

export const DEFAULT_FINGER_MM = 16.51;

/** Width on viewer = (mm / finger mm) * factor; +3% vs original 0.46. */
export const STONE_VIEWER_WIDTH_FACTOR = 0.46 * 1.03;

/** Render-only: on-stage diamond scale; does not affect mm readout or coverage. */
export const DIAMOND_VISUAL_COMPENSATION = 1.06;

/**
 * On-stage scale per shape (layer cqw only). Readout/coverage use mm from
 * faceAxesForSizing / getRoundDiamondMm — not these factors.
 */
export const SHAPE_RENDER_VISUAL_COMP: Record<ShapeId, number> = {
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

/** Mobile-only on-stage scale; snapshots use desktop (1). */
export const MOBILE_STONE_RENDER_SCALE = 1.07;

export function renderVisualCompensation(shapeId: ShapeId): number {
  return SHAPE_RENDER_VISUAL_COMP[shapeId];
}

export function fingerDiameterMm(ringSize: number): number {
  return RING_SIZE_TO_MM[ringSize] ?? DEFAULT_FINGER_MM;
}

/** Horizontal span (mm) for on-stage width % — same as live Studio. */
export function renderStoneWidthMm(
  shape: ShapeId,
  carat: number,
  orientation: StudioOrientation,
): number {
  if (shape === "round") return getRoundDiamondMm(carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return orientation === "ns" ? Math.min(w, l) : Math.max(w, l);
}

/** Vertical span (mm) for layer aspect ratio — same as live Studio. */
export function renderStoneHeightMm(
  shape: ShapeId,
  carat: number,
  orientation: StudioOrientation,
): number {
  if (shape === "round") return getRoundDiamondMm(carat);
  const [w, l] = faceAxesForSizing(shape, carat);
  return orientation === "ns" ? Math.max(w, l) : Math.min(w, l);
}

export function diamondLayerCqw(input: {
  shape: ShapeId;
  carat: number;
  orientation: StudioOrientation;
  ringSize: number;
  isMobileViewport: boolean;
}): { widthCqw: number; heightCqw: number } {
  const fingerMm = fingerDiameterMm(input.ringSize);
  const rw = renderStoneWidthMm(input.shape, input.carat, input.orientation);
  const rh = renderStoneHeightMm(input.shape, input.carat, input.orientation);
  const stoneMmToStage =
    (STONE_VIEWER_WIDTH_FACTOR * renderVisualCompensation(input.shape)) / fingerMm;
  const mobileScale = input.isMobileViewport ? MOBILE_STONE_RENDER_SCALE : 1;
  return {
    widthCqw: rw * stoneMmToStage * 100 * mobileScale,
    heightCqw: rh * stoneMmToStage * 100 * mobileScale,
  };
}

/** Locked CSS literals — tests fail if page.tsx drifts. */
export const STAGE_CSS_LOCK = {
  aspectRatio: "7/9",
  framingLift: "-5.25%",
  compositionY: "-12%",
  diamondXNudge: "0px",
  diamondYNudge: "-24px",
  ringClusterTop: "63.5%",
  ringClusterTopTall: "62.1%",
  fingerObjectPosition: "50% 42%",
  viewerCssWidth: 578,
} as const;

export const STAGE_ASPECT = { width: 7, height: 9 } as const;
export const CANONICAL_VIEWER_CSS_WIDTH = STAGE_CSS_LOCK.viewerCssWidth;
export const CANONICAL_SNAPSHOT_PIXEL_RATIO = 2;

export const FRAMING_LIFT = -0.0525;
export const COMPOSITION_Y = -0.12;
export const RING_CLUSTER_TOP = 0.635;
/** Desktop ≥1024px + 7:9 viewer matches `@container (aspect-ratio <= 7 / 8.5)`. */
export const RING_CLUSTER_TOP_SNAPSHOT = 0.621;
export const DIAMOND_X_NUDGE_CSS_PX = 0;
export const DIAMOND_Y_NUDGE_CSS_PX = -24;
export const FINGER_OBJECT_POSITION = { x: 0.5, y: 0.42 } as const;

export const CLEAN_SNAPSHOT_WIDTH =
  CANONICAL_VIEWER_CSS_WIDTH * CANONICAL_SNAPSHOT_PIXEL_RATIO;
export const CLEAN_SNAPSHOT_HEIGHT = Math.round(
  (CLEAN_SNAPSHOT_WIDTH * STAGE_ASPECT.height) / STAGE_ASPECT.width,
);

export type CanonicalSnapshotLayout = {
  viewerWidth: number;
  viewerHeight: number;
  pixelRatio: number;
  fingerMm: number;
  stoneWidthMm: number;
  stoneHeightMm: number;
  layerWidthPx: number;
  layerHeightPx: number;
  layerLeftPx: number;
  layerTopPx: number;
  compositionYPx: number;
  fingerTranslateYPx: number;
  cadVisibleScale: number;
  cadCenterX: number;
  cadCenterY: number;
  cadClipRound: boolean;
  orientation: StudioOrientation;
  shape: ShapeId;
};

export function computeCanonicalSnapshotLayout(
  config: DiamondStudioConfiguration,
): CanonicalSnapshotLayout {
  const pixelRatio = CANONICAL_SNAPSHOT_PIXEL_RATIO;
  const viewerWidth = CLEAN_SNAPSHOT_WIDTH;
  const viewerHeight = CLEAN_SNAPSHOT_HEIGHT;
  const { widthCqw, heightCqw } = diamondLayerCqw({
    shape: config.shape,
    carat: config.carat,
    orientation: config.orientation,
    ringSize: config.ringSize,
    isMobileViewport: false,
  });
  const layerWidthPx = (widthCqw / 100) * viewerWidth;
  const layerHeightPx = (heightCqw / 100) * viewerWidth;
  const compositionYPx = COMPOSITION_Y * viewerHeight;
  const yNudgePx = DIAMOND_Y_NUDGE_CSS_PX * pixelRatio;
  const xNudgePx = DIAMOND_X_NUDGE_CSS_PX * pixelRatio;

  const layerLeftPx = 0.5 * viewerWidth - 0.5 * layerWidthPx + xNudgePx;
  const layerTopPx =
    RING_CLUSTER_TOP_SNAPSHOT * viewerHeight -
    0.5 * layerHeightPx +
    FRAMING_LIFT * layerHeightPx +
    yNudgePx +
    compositionYPx;

  const cad = getDiamondCadAsset(config.shape);

  return {
    viewerWidth,
    viewerHeight,
    pixelRatio,
    fingerMm: fingerDiameterMm(config.ringSize),
    stoneWidthMm: renderStoneWidthMm(config.shape, config.carat, config.orientation),
    stoneHeightMm: renderStoneHeightMm(
      config.shape,
      config.carat,
      config.orientation,
    ),
    layerWidthPx,
    layerHeightPx,
    layerLeftPx,
    layerTopPx,
    compositionYPx,
    fingerTranslateYPx: compositionYPx + FRAMING_LIFT * viewerHeight,
    cadVisibleScale: cad.visibleScale,
    cadCenterX: cad.centerX,
    cadCenterY: cad.centerY,
    cadClipRound: cad.shadow === "round",
    orientation: config.orientation,
    shape: config.shape,
  };
}

export type ExpectedVisibleBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

/**
 * Map CAD visible-bounds through the same contain → optional EW rotate →
 * CAD scale pipeline the snapshot compositor uses.
 */
export function expectedVisibleDiamondBox(
  config: DiamondStudioConfiguration,
): ExpectedVisibleBox {
  const layout = computeCanonicalSnapshotLayout(config);
  const cad = getDiamondCadAsset(config.shape);
  const canvasW = cad.canvas.width;
  const canvasH = cad.canvas.height;
  const contain = Math.min(
    layout.layerWidthPx / canvasW,
    layout.layerHeightPx / canvasH,
  );
  const drawnW = canvasW * contain;
  const drawnH = canvasH * contain;
  const offsetX = (layout.layerWidthPx - drawnW) / 2;
  const offsetY = (layout.layerHeightPx - drawnH) / 2;

  const mapPngToLayer = (px: number, py: number) => ({
    x: offsetX + px * contain,
    y: offsetY + py * contain,
  });

  const corners = [
    mapPngToLayer(cad.visibleBounds.minX, cad.visibleBounds.minY),
    mapPngToLayer(cad.visibleBounds.maxX, cad.visibleBounds.minY),
    mapPngToLayer(cad.visibleBounds.maxX, cad.visibleBounds.maxY),
    mapPngToLayer(cad.visibleBounds.minX, cad.visibleBounds.maxY),
  ];

  const cx = layout.layerWidthPx / 2;
  const cy = layout.layerHeightPx / 2;
  const rotated =
    config.orientation === "ew"
      ? corners.map((p) => ({
          x: cx - (p.y - cy),
          y: cy + (p.x - cx),
        }))
      : corners;

  const ox = layout.cadCenterX * layout.layerWidthPx;
  const oy = layout.cadCenterY * layout.layerHeightPx;
  const scaled = rotated.map((p) => ({
    x: ox + (p.x - ox) * layout.cadVisibleScale,
    y: oy + (p.y - oy) * layout.cadVisibleScale,
  }));

  const xs = scaled.map((p) => p.x + layout.layerLeftPx);
  const ys = scaled.map((p) => p.y + layout.layerTopPx);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
