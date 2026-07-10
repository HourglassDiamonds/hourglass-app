import {
  faceAxesForSizing as sharedFaceAxes,
  getRepresentativeFaceUpDimensions,
  getRoundDiamondMm as sharedGetRound,
  type DiamondFaceShapeId,
} from "@/lib/diamond-tech-suite/face-dimensions";
import type { ShapeId } from "./types";

export {
  getRepresentativeFaceUpDimensions,
  faceDimensionProvenance,
} from "@/lib/diamond-tech-suite/face-dimensions";

export function getRoundDiamondMm(carat: number): number {
  return sharedGetRound(carat);
}

export function faceAxesForSizing(
  shape: ShapeId,
  carat: number,
): [width: number, length: number] {
  return sharedFaceAxes(shape as DiamondFaceShapeId, carat);
}

export function renderStoneWidthMm(shape: ShapeId, carat: number): number {
  return getRepresentativeFaceUpDimensions(shape as DiamondFaceShapeId, carat)
    .widthMm;
}

export function renderStoneHeightMm(shape: ShapeId, carat: number): number {
  return getRepresentativeFaceUpDimensions(shape as DiamondFaceShapeId, carat)
    .lengthMm;
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
  const d = getRepresentativeFaceUpDimensions(shape as DiamondFaceShapeId, carat);
  if (shape === "round") {
    return {
      widthMm: d.widthMm,
      lengthMm: d.lengthMm,
      label: `${d.widthMm.toFixed(1)} mm`,
    };
  }
  return {
    widthMm: d.widthMm,
    lengthMm: d.lengthMm,
    label: `${d.widthMm.toFixed(1)} × ${d.lengthMm.toFixed(1)} mm`,
  };
}

/**
 * Left-rail face-up size copy — canonical width × length regardless of
 * N/S | E/W display orientation.
 */
export function formatFaceUpSizeCopy(shape: ShapeId, carat: number): string {
  const d = getRepresentativeFaceUpDimensions(shape as DiamondFaceShapeId, carat);
  if (shape === "round") {
    return `Approx. face-up diameter: ${d.widthMm.toFixed(1)} mm`;
  }
  return `Approx. face-up size: ${d.widthMm.toFixed(1)} × ${d.lengthMm.toFixed(1)} mm`;
}
