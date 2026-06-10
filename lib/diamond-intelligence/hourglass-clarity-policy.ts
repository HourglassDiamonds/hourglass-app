import { normalizeClarityGrade } from "./report-grade-hints";
import { isBelowHourglassClarityStandard } from "./hourglass-clarity-standards";

/** Headline for I1–I3 — unchanged. */
export const HOURGLASS_EXCLUDED_CLARITY_HEADLINE = "Outside Hourglass Standards";

/**
 * Consumer-facing explanation for I1–I3 — firm pass, not a preference statement.
 */
export const HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE =
  "This diamond contains clarity characteristics that place it outside the quality range Hourglass would recommend for purchase.";

/** Dedicated spectrum-block copy when clarity is below Hourglass minimum. */
export const HOURGLASS_EXCLUDED_SPECTRUM_STATUS = {
  title: "Recommendation Status",
  verdict: "Not Recommended",
  body: "This diamond falls below Hourglass minimum clarity standards and is not a diamond we would recommend sourcing for a client.",
} as const;

/** Required inspection copy for SI2 — not a disqualification. */
export const SI2_INSPECTION_REQUIRED_MESSAGE =
  "SI2 clarity requires direct review for eye-clean appearance. Justin should inspect video, inclusion position, transparency, and whether the diamond is eye-clean before recommendation.";

/** Presentation-only — SI2 may not display Rare, Exceptional, or Distinctive. */
export const SI2_PRESENTATION_TIER_CEILING = "Strong" as const;

export type HourglassClarityDisplayPolicy = {
  clarity: string;
  isExcluded: boolean;
  isSi2: boolean;
  suppressFavorablePercentile: boolean;
  suppressPremiumTierLabels: boolean;
  heroVerdictLabel: string | null;
  consumerExplanation: string | null;
  /** Bottom-tier cap when percentile must be shown — preferred path is full suppression. */
  harshPercentileTopPercent: number | null;
};

export function resolveHourglassClarityPolicy(
  clarity?: string,
): HourglassClarityDisplayPolicy {
  const c = normalizeClarityGrade(clarity ?? "");
  const empty: HourglassClarityDisplayPolicy = {
    clarity: c,
    isExcluded: false,
    isSi2: false,
    suppressFavorablePercentile: false,
    suppressPremiumTierLabels: false,
    heroVerdictLabel: null,
    consumerExplanation: null,
    harshPercentileTopPercent: null,
  };

  if (!c) return empty;

  if (isBelowHourglassClarityStandard(c)) {
    const harshPercentileTopPercent =
      c === "I3" ? 5 : c === "I2" ? 15 : 30;
    return {
      clarity: c,
      isExcluded: true,
      isSi2: false,
      suppressFavorablePercentile: true,
      suppressPremiumTierLabels: true,
      heroVerdictLabel: HOURGLASS_EXCLUDED_CLARITY_HEADLINE,
      consumerExplanation: HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE,
      harshPercentileTopPercent,
    };
  }

  if (c === "SI2") {
    return {
      clarity: c,
      isExcluded: false,
      isSi2: true,
      suppressFavorablePercentile: false,
      suppressPremiumTierLabels: true,
      heroVerdictLabel: null,
      consumerExplanation: SI2_INSPECTION_REQUIRED_MESSAGE,
      harshPercentileTopPercent: null,
    };
  }

  return empty;
}
