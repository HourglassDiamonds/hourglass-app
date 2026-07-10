import { RING_SIZE_TO_MM } from "./constants";
import { renderStoneHeightMm, renderStoneWidthMm } from "./dimensions";
import type { PhotoScaleSource, ShapeId } from "./types";

/**
 * Assumed finger diameter as a fraction of the *displayed hand image* width.
 *
 * Diamond Size Studio uses ~0.46 because its viewer frames a close finger.
 * Shape Studio hand photos usually show a full hand, so the ring finger is a
 * much smaller share of the frame.
 *
 * Conservative visual baseline only — not measured or calibrated.
 * Used for known-size and desktop-upload previews. Prefer slightly small
 * over misleadingly large.
 */
const HAND_PHOTO_FINGER_WIDTH_FRACTION = 0.105;

/**
 * Neutral finger-diameter reference (mm) for uncalibrated visual math only.
 *
 * This is NOT an estimated ring size, NOT a user selection, and must never
 * appear in UI, analytics, query params, or user-facing state.
 * Card-reference mode does not render a scaled overlay until guided
 * measurement exists; this constant exists so any uncalibrated math path
 * is explicit rather than silently indexing the ring-size table.
 */
export const UNCALIBRATED_FINGER_REFERENCE_MM = 16.51;

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
 * Compute overlay box size in pixels for a given reference width.
 *
 * `referenceWidthPx` should be the displayed hand-image content width
 * (object-fit: contain), not the full stage box when letterboxed.
 *
 * Known-size / upload: use the selected `ringSize` → finger mm map.
 * Uncalibrated sources: use {@link UNCALIBRATED_FINGER_REFERENCE_MM} only
 * as a rendering reference — never as a claimed estimate.
 */
export function overlaySizePx(
  shape: ShapeId,
  carat: number,
  ringSize: number,
  referenceWidthPx: number,
  scaleSource: PhotoScaleSource | null = "known-size",
): OverlayPixelSize {
  const fingerMm =
    scaleSource === "card-reference"
      ? UNCALIBRATED_FINGER_REFERENCE_MM
      : (RING_SIZE_TO_MM[ringSize] ?? UNCALIBRATED_FINGER_REFERENCE_MM);
  const rw = renderStoneWidthMm(shape, carat);
  const rh = renderStoneHeightMm(shape, carat);
  const comp = SHAPE_RENDER_VISUAL_COMP[shape];
  const mmToStage = (HAND_PHOTO_FINGER_WIDTH_FRACTION * comp) / fingerMm;
  const widthPx = rw * mmToStage * referenceWidthPx;
  const heightPx = rh * mmToStage * referenceWidthPx;
  return { widthPx, heightPx };
}

/** Exact selected carat for headlines — keeps quarter steps (2.25), trims .00. */
export function formatCaratLabel(carat: number): string {
  const rounded = Math.round(carat * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const asTenths = Math.round(rounded * 10) / 10;
  if (Math.abs(rounded - asTenths) < 1e-9) return asTenths.toFixed(1);
  return rounded.toFixed(2);
}
