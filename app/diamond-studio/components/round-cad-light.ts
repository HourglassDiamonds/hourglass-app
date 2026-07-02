/** Contrast-shift scintillation variants (see scripts/generate-rbc-cad-scintillation-variants.mjs). */
export const ROUND_CAD_SCINTILLATION_VARIANTS = [
  "/diamond-tech-suite/diamonds/rbc-cad-scintillation-a.png",
  "/diamond-tech-suite/diamonds/rbc-cad-scintillation-b.png",
  "/diamond-tech-suite/diamonds/rbc-cad-scintillation-c.png",
  "/diamond-tech-suite/diamonds/rbc-cad-scintillation-d.png",
] as const;

/** Minimum time between visible pattern advances (ms). */
export const ROUND_CAD_SCINTILLATION_MIN_INTERVAL_MS = 360;

/** Variant crossfade duration (ms). */
export const ROUND_CAD_SCINTILLATION_CROSSFADE_MS = 190;

/** Hold after final carat input before returning to base (ms). */
export const ROUND_CAD_ADJUST_HOLD_MS = 460;

/** Fade back to unchanged base image (ms). */
export const ROUND_CAD_SCINTILLATION_FADE_OUT_MS = 340;

export const ROUND_CAD_SCINTILLATION_GEN = {
  brightLuminanceRange: [225, 254] as const,
  darkLuminanceRange: [70, 205] as const,
  centralDarkLuminanceRange: [70, 205] as const,
  brightLiftRgb: 15,
  outerDarkLuminanceMultiplier: 0.83,
  trueCentralDarkLuminanceMultiplier: 0.86,
  regionExpandRadiusPx: 10,
  centralRegionExpandRadiusPx: 12,
  girdleInsetPx: 6,
} as const;
