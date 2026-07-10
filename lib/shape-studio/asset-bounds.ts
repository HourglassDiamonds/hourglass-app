import type { CSSProperties } from "react";
import { DIAMOND_CAD_ASSETS } from "@/app/diamond-studio/components/diamond-cad-assets";
import type { ShapeId } from "./types";

/**
 * Visible (alpha) geometry for the canonical Diamond Size Studio CAD PNGs
 * (`/diamond-tech-suite/diamonds-v2/diamond-*-v2.png`), sourced from
 * `DIAMOND_CAD_ASSETS.visibleBounds` (alpha probe, canvas 2560²).
 *
 * Do not hand-tune — update the CAD registry when assets change.
 */
export type ShapeAssetBounds = {
  intrinsicWidth: number;
  intrinsicHeight: number;
  visibleWidthFraction: number;
  visibleHeightFraction: number;
  paddingLeftFraction: number;
  paddingTopFraction: number;
  assetSrc: string;
};

function boundsFromCad(shape: ShapeId): ShapeAssetBounds {
  const a = DIAMOND_CAD_ASSETS[shape];
  const W = a.canvas.width;
  const H = a.canvas.height;
  return {
    intrinsicWidth: W,
    intrinsicHeight: H,
    visibleWidthFraction: a.visibleBounds.width / W,
    visibleHeightFraction: a.visibleBounds.height / H,
    paddingLeftFraction: a.visibleBounds.minX / W,
    paddingTopFraction: a.visibleBounds.minY / H,
    assetSrc: a.src,
  };
}

export const SHAPE_ASSET_BOUNDS: Record<ShapeId, ShapeAssetBounds> = {
  round: boundsFromCad("round"),
  oval: boundsFromCad("oval"),
  cushion: boundsFromCad("cushion"),
  radiant: boundsFromCad("radiant"),
  emerald: boundsFromCad("emerald"),
  pear: boundsFromCad("pear"),
  marquise: boundsFromCad("marquise"),
  princess: boundsFromCad("princess"),
  asscher: boundsFromCad("asscher"),
};

/**
 * Layout the overlay `<img>` so the opaque silhouette fills the physically
 * sized wrapper (stone mm × display ppm).
 */
export function overlayImageLayoutStyle(shape: ShapeId): CSSProperties {
  const b = SHAPE_ASSET_BOUNDS[shape];
  const widthPct = 100 / b.visibleWidthFraction;
  const heightPct = 100 / b.visibleHeightFraction;
  const leftPct = (-b.paddingLeftFraction / b.visibleWidthFraction) * 100;
  const topPct = (-b.paddingTopFraction / b.visibleHeightFraction) * 100;
  return {
    position: "absolute",
    width: `${widthPct}%`,
    height: `${heightPct}%`,
    left: `${leftPct}%`,
    top: `${topPct}%`,
    maxWidth: "none",
    objectFit: "fill",
  };
}

/** Legacy contain undersize helper (tests / documentation only). */
export function containedVisibleSilhouettePx(
  shape: ShapeId,
  wrapperWidthPx: number,
  wrapperHeightPx: number,
): { widthPx: number; heightPx: number } {
  const b = SHAPE_ASSET_BOUNDS[shape];
  const scale = Math.min(
    wrapperWidthPx / b.intrinsicWidth,
    wrapperHeightPx / b.intrinsicHeight,
  );
  return {
    widthPx: b.visibleWidthFraction * b.intrinsicWidth * scale,
    heightPx: b.visibleHeightFraction * b.intrinsicHeight * scale,
  };
}
