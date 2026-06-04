import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import type { DecisionConfidenceBand } from "./decision-profile-confidence";
import type { ProportionArchetype } from "./diamond-decision-profile";
import type { OverallRecommendationBand } from "./diamond-decision-profile";
import type { RiskProfileBand } from "./diamond-decision-profile";
import type { DiamondInterpretationContext } from "./client-interpretation-context";
import {
  claritySeverity,
  fluorescenceConcern,
  type ReportGradeHints,
} from "./report-grade-hints";

export type PrimaryLimitingFactorKey =
  | "clarity"
  | "color"
  | "incomplete-data"
  | "deep-architecture"
  | "spread-architecture"
  | "fluorescence"
  | "finish"
  | "colored-diamond"
  | "none";

export type PrimaryLimitingFactor = {
  key: PrimaryLimitingFactorKey;
  /** Consumer-facing label under Recommendation */
  display: string;
};

function colorLimitWeight(color?: string): number {
  const c = (color ?? "").trim().toUpperCase();
  if (!c) return 0;
  if (/^[D-G]$/.test(c)) return 0;
  if (/^[H-K]$/.test(c)) return 1;
  if (/^[L-N]$/.test(c)) return 2;
  if (/^[O-Z]/.test(c) || c.startsWith("FANCY")) return 4;
  return 1;
}

function clarityLimitWeight(clarity?: string): number {
  return claritySeverity(clarity);
}

export function derivePrimaryLimitingFactor(input: {
  hints: ReportGradeHints;
  fields: CalibrationReportFields;
  context: DiamondInterpretationContext;
  confidenceBand: DecisionConfidenceBand;
  risk: RiskProfileBand;
  recommendation: OverallRecommendationBand;
  archetype: ProportionArchetype;
}): PrimaryLimitingFactor {
  if (
    input.confidenceBand === "Low" ||
    input.context.extractionState === "REPORT_ONLY" ||
    input.context.extractionState === "PARTIAL_EXTRACTION" ||
    input.recommendation === "Worth Reviewing After Additional Information"
  ) {
    return {
      key: "incomplete-data",
      display: "Incomplete Report Data",
    };
  }

  if (input.hints.fancyColor || input.hints.coloredDiamondReport) {
    return {
      key: "colored-diamond",
      display: "Colored Diamond Context",
    };
  }

  const clarityW = clarityLimitWeight(input.hints.clarity);
  const colorW = colorLimitWeight(input.hints.color);
  const fluoW = fluorescenceConcern(input.fields.fluorescence);

  const finish = [input.fields.polish, input.fields.symmetry, input.fields.cutGrade]
    .join(" ")
    .toLowerCase();
  const finishConcern = finish.includes("fair") ? 3 : finish.includes("good") ? 1 : 0;

  if (input.hints.clarity === "I3" || input.hints.clarity === "I2" || input.hints.clarity === "I1") {
    return { key: "clarity", display: "Clarity" };
  }

  if (colorW >= 4) {
    return { key: "color", display: "Color" };
  }

  if (clarityW >= 4 && clarityW >= colorW && clarityW >= fluoW) {
    return { key: "clarity", display: "Clarity" };
  }

  if (colorW >= 3 && colorW > clarityW) {
    return { key: "color", display: "Color" };
  }

  if (fluoW >= 3 && fluoW >= clarityW && fluoW >= colorW) {
    return { key: "fluorescence", display: "Strong Fluorescence" };
  }

  if (colorW >= 2 && clarityW >= 4) {
    return { key: "color", display: "Color" };
  }

  if (clarityW >= 4) {
    return { key: "clarity", display: "Clarity" };
  }

  if (fluoW >= 2 && fluoW >= finishConcern) {
    return { key: "fluorescence", display: "Strong Fluorescence" };
  }

  if (finishConcern >= 2) {
    return { key: "finish", display: "Finish" };
  }

  if (
    input.archetype === "compact-deep" &&
    input.recommendation !== "Strong Candidate"
  ) {
    return { key: "deep-architecture", display: "Deep Architecture" };
  }

  if (
    (input.archetype === "spread-oriented" || input.archetype === "shallow-spread") &&
    input.recommendation === "Worth Reviewing"
  ) {
    return { key: "spread-architecture", display: "Spread-Oriented Architecture" };
  }

  if (input.recommendation === "Strong Candidate" && input.risk === "Low") {
    return {
      key: "none",
      display: "No Significant Concerns Identified",
    };
  }

  if (clarityW >= 3) {
    return { key: "clarity", display: "Clarity" };
  }

  if (colorW >= 2) {
    return { key: "color", display: "Color" };
  }

  return {
    key: "none",
    display: "No Significant Concerns Identified",
  };
}
