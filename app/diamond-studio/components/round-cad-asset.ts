/** @deprecated Use diamond-cad-assets. Kept for Shape Studio / transitional imports. */
export {
  getDiamondCadAsset,
  DIAMOND_CAD_ASSETS,
} from "./diamond-cad-assets";

import { getDiamondCadAsset } from "./diamond-cad-assets";

const round = getDiamondCadAsset("round");

export const ROUND_CAD_ASSET = {
  src: round.src,
  originalSrc: round.originalSrc,
  switcherSrc: round.switcherSrc,
  fallbackSrc: round.fallbackSrc,
  visibleFillRatio: round.visibleFillRatio,
  centerX: round.centerX,
  centerY: round.centerY,
} as const;

export const ROUND_BASELINE_VISIBLE_FILL = 1420 / 1500;

export const ROUND_CAD_VISIBLE_SCALE = round.visibleScale;
