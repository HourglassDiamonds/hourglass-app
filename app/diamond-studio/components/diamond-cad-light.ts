/** Shared scintillation timing + contrast parameters for Diamond Studio CAD. */

/** Minimum time between visible pattern advances (ms). */
export const CAD_SCINTILLATION_MIN_INTERVAL_MS = 360;

/** Variant crossfade duration (ms). */
export const CAD_SCINTILLATION_CROSSFADE_MS = 190;

/** Hold after final carat input before returning to base (ms). */
export const CAD_ADJUST_HOLD_MS = 460;

/** Fade back to unchanged base image (ms). */
export const CAD_SCINTILLATION_FADE_OUT_MS = 340;

export const CAD_SCINTILLATION_GEN_BRILLIANT = {
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

export const CAD_SCINTILLATION_GEN_STEP = {
  brightLuminanceRange: [200, 252] as const,
  darkLuminanceRange: [55, 195] as const,
  centralDarkLuminanceRange: [55, 195] as const,
  brightLiftRgb: 8,
  outerDarkLuminanceMultiplier: 0.91,
  trueCentralDarkLuminanceMultiplier: 0.93,
  regionExpandRadiusPx: 10,
  centralRegionExpandRadiusPx: 12,
  girdleInsetPx: 10,
} as const;
