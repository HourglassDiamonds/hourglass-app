import { RING_SIZE_TO_MM } from "./constants";
import { renderStoneHeightMm, renderStoneWidthMm } from "./dimensions";
import type { ShapeId } from "./types";

/** Width on stage = (mm / finger mm) × factor — aligned with Diamond Size Studio. */
const STONE_VIEWER_WIDTH_FACTOR = 0.46 * 1.03;

/** Render-only on-stage scale per shape; does not affect mm readout. */
const SHAPE_RENDER_VISUAL_COMP: Record<ShapeId, number> = {
  round: 1.06,
  oval: 1.58,
  cushion: 1.12,
  princess: 1.12,
  marquise: 2.15,
  pear: 1.66,
  emerald: 1.48,
  radiant: 1.28,
  asscher: 1.14,
};

export type OverlayPixelSize = {
  widthPx: number;
  heightPx: number;
};

/**
 * Compute overlay box size in pixels for a given stage width.
 * Stage width represents the visible hand photo width.
 */
export function overlaySizePx(
  shape: ShapeId,
  carat: number,
  ringSize: number,
  stageWidthPx: number,
): OverlayPixelSize {
  const fingerMm = RING_SIZE_TO_MM[ringSize] ?? 16.51;
  const rw = renderStoneWidthMm(shape, carat);
  const rh = renderStoneHeightMm(shape, carat);
  const comp = SHAPE_RENDER_VISUAL_COMP[shape];
  const mmToStage = (STONE_VIEWER_WIDTH_FACTOR * comp) / fingerMm;
  const widthPx = rw * mmToStage * stageWidthPx;
  const heightPx = rh * mmToStage * stageWidthPx;
  return { widthPx, heightPx };
}
