import type { DiamondDecisionProfile } from "./diamond-decision-profile";

/** Presentation-only — never changes scores or bands in the profile model. */
export function presentOpticalPerformanceDisplay(profile: DiamondDecisionProfile): {
  band: string;
  score: number | null;
} {
  if (profile.confidence.band === "Low") {
    return {
      band:
        profile.opticalPerformance.band === "Unavailable"
          ? "Limited Information Available"
          : "Preliminary Assessment",
      score: null,
    };
  }

  return {
    band: profile.opticalPerformance.band,
    score: profile.opticalPerformance.score ?? null,
  };
}

/** Graph center label when decision confidence is low — presentation only. */
export function presentLowConfidenceGraphLabel(
  profile: DiamondDecisionProfile,
): string {
  return profile.opticalPerformance.band === "Unavailable"
    ? "Limited Information"
    : "Preliminary Assessment";
}
