/** @deprecated Use diamond-cad-light. Kept for transitional imports. */
export {
  CAD_SCINTILLATION_MIN_INTERVAL_MS as ROUND_CAD_SCINTILLATION_MIN_INTERVAL_MS,
  CAD_SCINTILLATION_CROSSFADE_MS as ROUND_CAD_SCINTILLATION_CROSSFADE_MS,
  CAD_ADJUST_HOLD_MS as ROUND_CAD_ADJUST_HOLD_MS,
  CAD_SCINTILLATION_FADE_OUT_MS as ROUND_CAD_SCINTILLATION_FADE_OUT_MS,
  CAD_SCINTILLATION_GEN_BRILLIANT as ROUND_CAD_SCINTILLATION_GEN,
} from "./diamond-cad-light";

import { getDiamondCadAsset } from "./diamond-cad-assets";

export const ROUND_CAD_SCINTILLATION_VARIANTS =
  getDiamondCadAsset("round").variants;
