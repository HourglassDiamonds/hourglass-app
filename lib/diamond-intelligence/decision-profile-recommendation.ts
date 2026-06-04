import type { DiamondInterpretationContext } from "./client-interpretation-context";
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
  "Strong Candidate": 5,
  "Worth Reviewing": 4,
  "Compare Carefully": 3,
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

export function mergeRiskBand(
  computed: RiskProfileBand,
  hints: ReportGradeHints,
  ctx: DiamondInterpretationContext,
): RiskProfileBand {
  let band = computed;
  const clarityFloor = clarityRiskFloor(hints.clarity);
  if (clarityFloor && RISK_RANK[band] < RISK_RANK[clarityFloor]) {
    band = clarityFloor;
  }

  if (
    ctx.extractionState === "REPORT_ONLY" ||
    ctx.extractionState === "EXTRACTION_ERROR"
  ) {
    if (RISK_RANK[band] < RISK_RANK.Elevated) band = "Elevated";
  } else if (ctx.extractionState === "PARTIAL_EXTRACTION") {
    if (RISK_RANK[band] < RISK_RANK.Elevated) band = "Elevated";
  } else if (!ctx.scoreEligible || ctx.readState === "partial") {
    if (RISK_RANK[band] < RISK_RANK.Moderate) band = "Moderate";
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
}): OverallRecommendationBand {
  if (
    input.ctx.extractionState === "REPORT_ONLY" ||
    input.ctx.readState === "orientation"
  ) {
    return "Needs More Information";
  }
  if (!input.ctx.scoreEligible && input.ctx.readState === "partial") {
    return "Needs More Information";
  }

  const clarity = input.hints.clarity;
  if (clarity === "I3") return "Not Recommended";

  if (input.risk === "High") {
    if (clarity === "I2") return "Compare Carefully";
    if (clarity === "I1") return "Compare Carefully";
    return "Not Recommended";
  }

  if (input.risk === "Elevated") {
    if (clarity === "I2") return "Compare Carefully";
    if (clarity === "I1") return "Compare Carefully";
    return "Compare Carefully";
  }

  if (input.hints.fancyColor || input.hints.coloredDiamondReport) {
    return "Worth Reviewing";
  }

  if (input.risk === "Moderate") {
    if (input.optical === "Strong" || input.optical === "Solid") {
      if (
        clarity === "SI2" ||
        clarity === "SI1" ||
        !clarity ||
        clarity.startsWith("VS") ||
        clarity.startsWith("VVS") ||
        clarity === "FL" ||
        clarity === "IF"
      ) {
        return clarity === "SI1" ? "Worth Reviewing" : "Strong Candidate";
      }
      return "Worth Reviewing";
    }
    return "Worth Reviewing";
  }

  // Low risk — buying confidence can exceed optical alone
  if (input.optical === "Strong" || input.optical === "Solid") {
    return "Strong Candidate";
  }
  if (input.optical === "Moderate" || input.optical === "Mixed") {
    if (input.visual === "Generous face-up" || input.visual === "Spread-forward") {
      return "Worth Reviewing";
    }
    return input.risk === "Low" ? "Strong Candidate" : "Worth Reviewing";
  }
  if (input.optical === "Preliminary" || input.optical === "Unavailable") {
    return "Worth Reviewing";
  }
  return "Compare Carefully";
}

export function applyRecommendationCeilings(
  base: OverallRecommendationBand,
  input: {
    risk: RiskProfileBand;
    ctx: DiamondInterpretationContext;
    hints: ReportGradeHints;
  },
): OverallRecommendationBand {
  let band = base;

  const clarityCeiling = clarityRecommendationCeiling(input.hints.clarity);
  band = applyCeiling(band, clarityCeiling);

  if (input.hints.clarity === "I3") {
    return "Not Recommended";
  }

  if (input.risk === "High") {
    band = worseRecommendation(band, "Compare Carefully");
  }

  if (
    input.ctx.extractionState === "REPORT_ONLY" ||
    input.ctx.extractionState === "PARTIAL_EXTRACTION" ||
    input.ctx.extractionState === "EXTRACTION_ERROR" ||
    input.ctx.readState === "partial"
  ) {
    band = worseRecommendation(band, "Worth Reviewing");
  }

  if (input.hints.fancyColor || input.hints.coloredDiamondReport) {
    band = worseRecommendation(band, "Worth Reviewing");
  }

  if (input.risk === "High" && input.hints.clarity === "I2") {
    band = worseRecommendation(band, "Compare Carefully");
  }

  return band;
}
