import type { DiamondInterpretationContext } from "./client-interpretation-context";
import type { DecisionConfidenceBand } from "./decision-profile-confidence";
import type { ReportGradeHints } from "./report-grade-hints";
import {
  clarityRecommendationCeiling,
  clarityRiskFloor,
  type RecommendationCeiling,
} from "./report-grade-hints";

type RiskProfileBand = "Low" | "Moderate" | "Elevated" | "High";
type OverallRecommendationBand =
  | "Strong Candidate"
  | "Worth Reviewing"
  | "Compare Carefully"
  | "Not Recommended"
  | "Worth Reviewing After Additional Information"
  | "Needs More Information";
type OpticalPerformanceBand =
  | "Strong"
  | "Solid"
  | "Moderate"
  | "Mixed"
  | "Preliminary"
  | "Unavailable";
type VisualPresenceBand =
  | "Generous face-up"
  | "Balanced presence"
  | "Compact depth"
  | "Spread-forward"
  | "Preliminary";

const RECOMMENDATION_RANK: Record<OverallRecommendationBand, number> = {
  "Strong Candidate": 6,
  "Worth Reviewing": 5,
  "Compare Carefully": 4,
  "Worth Reviewing After Additional Information": 3,
  "Not Recommended": 2,
  "Needs More Information": 1,
};

const RISK_RANK: Record<RiskProfileBand, number> = {
  Low: 1,
  Moderate: 2,
  Elevated: 3,
  High: 4,
};

function worseRecommendation(
  a: OverallRecommendationBand,
  b: OverallRecommendationBand,
): OverallRecommendationBand {
  return RECOMMENDATION_RANK[a] <= RECOMMENDATION_RANK[b] ? a : b;
}

function applyCeiling(
  band: OverallRecommendationBand,
  ceiling: RecommendationCeiling | null,
): OverallRecommendationBand {
  if (!ceiling) return band;
  if (ceiling === "Not Recommended") return "Not Recommended";
  const capped = ceiling as OverallRecommendationBand;
  return worseRecommendation(band, capped);
}

/** Buyer-risk band only — clarity, color, fluorescence, finish. No extraction penalties. */
export function mergeRiskBand(
  computed: RiskProfileBand,
  hints: ReportGradeHints,
): RiskProfileBand {
  let band = computed;
  const clarityFloor = clarityRiskFloor(hints.clarity);
  if (clarityFloor && RISK_RANK[band] < RISK_RANK[clarityFloor]) {
    band = clarityFloor;
  }

  if (hints.fancyColor || hints.coloredDiamondReport) {
    if (RISK_RANK[band] < RISK_RANK.Moderate) band = "Moderate";
  }

  return band;
}

export function deriveBaseRecommendation(input: {
  optical: OpticalPerformanceBand;
  visual: VisualPresenceBand;
  risk: RiskProfileBand;
  ctx: DiamondInterpretationContext;
  hints: ReportGradeHints;
  confidenceBand: DecisionConfidenceBand;
}): OverallRecommendationBand {
  if (
    input.confidenceBand === "Low" ||
    input.ctx.extractionState === "REPORT_ONLY" ||
    input.ctx.readState === "orientation"
  ) {
    return "Worth Reviewing After Additional Information";
  }
  if (
    input.confidenceBand === "Moderate" &&
    (input.optical === "Preliminary" ||
      input.optical === "Unavailable" ||
      !input.ctx.scoreEligible)
  ) {
    return "Worth Reviewing After Additional Information";
  }

  const clarity = input.hints.clarity;
  if (clarity === "I3" || clarity === "I2" || clarity === "I1") {
    return "Not Recommended";
  }

  if (input.risk === "High") {
    return "Not Recommended";
  }

  if (input.risk === "Elevated") {
    return "Compare Carefully";
  }

  if (input.hints.fancyColor || input.hints.coloredDiamondReport) {
    return "Worth Reviewing";
  }

  if (input.risk === "Moderate") {
    if (input.optical === "Strong" || input.optical === "Solid") {
      if (clarity === "SI2") return "Worth Reviewing";
      if (clarity === "SI1") return "Worth Reviewing";
      if (
        !clarity ||
        clarity.startsWith("VS") ||
        clarity.startsWith("VVS") ||
        clarity === "FL" ||
        clarity === "IF"
      ) {
        return "Strong Candidate";
      }
      return "Worth Reviewing";
    }
    return "Worth Reviewing";
  }

  if (input.optical === "Strong" || input.optical === "Solid") {
    if (clarity === "SI2") return "Worth Reviewing";
    return "Strong Candidate";
  }
  if (input.optical === "Moderate" || input.optical === "Mixed") {
    if (input.visual === "Generous face-up" || input.visual === "Spread-forward") {
      return "Worth Reviewing";
    }
    return input.risk === "Low" ? "Strong Candidate" : "Worth Reviewing";
  }
  if (input.optical === "Preliminary" || input.optical === "Unavailable") {
    return "Worth Reviewing After Additional Information";
  }
  return "Compare Carefully";
}

export function applyRecommendationCeilings(
  base: OverallRecommendationBand,
  input: {
    risk: RiskProfileBand;
    ctx: DiamondInterpretationContext;
    hints: ReportGradeHints;
    confidenceBand: DecisionConfidenceBand;
  },
): OverallRecommendationBand {
  let band = base;

  const clarityCeiling = clarityRecommendationCeiling(input.hints.clarity);
  band = applyCeiling(band, clarityCeiling);

  if (input.risk === "High") {
    band = worseRecommendation(band, "Compare Carefully");
  }

  if (input.hints.fancyColor || input.hints.coloredDiamondReport) {
    band = worseRecommendation(band, "Worth Reviewing");
  }

  return band;
}
