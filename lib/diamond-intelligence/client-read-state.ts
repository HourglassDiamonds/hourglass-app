import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import {
  buildClientInterpretationConfidence,
  type ClientInterpretationConfidence,
} from "./client-interpretation-confidence";
import {
  assessExtractionCompleteness,
  type ExtractionState,
} from "./extraction-completeness";

/**
 * Single client-facing TRUST layer.
 *
 * Builds on extraction completeness + display-confidence and maps to one of
 * three render states. Governs ONLY what the UI shows — never canonical score,
 * parsers, OCR, or calibration logic.
 *
 *  - full         → score + graph + trait breakdown, confident tone
 *  - partial      → known fields + careful tone, no score unless core complete
 *  - orientation  → identity/report-only: no score, no calculated polygon
 */

export type ClientReadStateKind = "full" | "partial" | "orientation";

export type ClientReadState = {
  state: ClientReadStateKind;
  extractionState: ExtractionState;
  confidence: "high" | "medium" | "low";
  missingCriticalFields: string[];
  canShowScore: boolean;
  canShowGraph: boolean;
  canShowTraitBreakdown: boolean;
  canShowRareLanguage: boolean;
  displayScoreCap: number | null;
  graphStrengthMultiplier: number;
  summaryTone: "confident" | "careful" | "orientation";
  reason: string;
  scoreEligible: boolean;
  graphEligible: boolean;
  traitEligible: boolean;
  guidedCompletionEligible: boolean;
};

function present(
  fields: Partial<CalibrationReportFields> | null | undefined,
  key: ReportFieldKey,
): boolean {
  return Boolean((fields?.[key] ?? "").trim());
}

export function buildClientReadState(
  fields: Partial<CalibrationReportFields> | null | undefined,
  confidence?: ClientInterpretationConfidence,
): ClientReadState {
  const conf =
    confidence ?? buildClientInterpretationConfidence(fields);
  const completeness = assessExtractionCompleteness({ fields });

  const hasMeasurements = present(fields, "measurements");
  const hasTable = present(fields, "tablePercent");
  const hasDepth = present(fields, "depthPercent");
  const hasCrown = present(fields, "crownAngle");
  const hasPavilion = present(fields, "pavilionAngle");
  const finishCount = (
    ["polish", "symmetry", "fluorescence"] as ReportFieldKey[]
  ).filter((k) => present(fields, k)).length;

  const isFull =
    completeness.extractionState === "FULL_EXTRACTION" &&
    conf.level === "high" &&
    hasMeasurements &&
    hasTable &&
    hasDepth &&
    hasCrown &&
    hasPavilion;

  const isOrientation =
    completeness.extractionState === "REPORT_ONLY" ||
    completeness.extractionState === "EXTRACTION_ERROR" ||
    (!isFull &&
      !hasMeasurements &&
      completeness.coreFieldCount === 0 &&
      finishCount < 2);

  const state: ClientReadStateKind = isFull
    ? "full"
    : isOrientation
      ? "orientation"
      : "partial";

  const canShowRareLanguage =
    state === "full" &&
    completeness.scoreEligible &&
    conf.canShowRareLanguage &&
    hasCrown &&
    hasPavilion;

  const scoreEligible = completeness.scoreEligible;

  if (state === "orientation" || !scoreEligible) {
    const orientationLike =
      state === "orientation" || completeness.extractionState === "REPORT_ONLY";

    return {
      state: orientationLike ? "orientation" : "partial",
      extractionState: completeness.extractionState,
      confidence: orientationLike ? "low" : conf.level,
      missingCriticalFields: conf.missingCriticalFields,
      canShowScore: false,
      canShowGraph: completeness.graphEligible && !orientationLike,
      canShowTraitBreakdown: completeness.traitEligible && !orientationLike,
      canShowRareLanguage: false,
      displayScoreCap: null,
      graphStrengthMultiplier: orientationLike
        ? 0
        : conf.graphStrengthMultiplier,
      summaryTone: orientationLike ? "orientation" : "careful",
      reason: completeness.reason,
      scoreEligible: false,
      graphEligible: completeness.graphEligible,
      traitEligible: completeness.traitEligible,
      guidedCompletionEligible: completeness.guidedCompletionEligible,
    };
  }

  return {
    state,
    extractionState: completeness.extractionState,
    confidence: conf.level,
    missingCriticalFields: conf.missingCriticalFields,
    canShowScore: true,
    canShowGraph: completeness.graphEligible,
    canShowTraitBreakdown: completeness.traitEligible,
    canShowRareLanguage,
    displayScoreCap: conf.scoreDisplayCap,
    graphStrengthMultiplier: conf.graphStrengthMultiplier,
    summaryTone: state === "full" ? "confident" : "careful",
    reason: completeness.reason,
    scoreEligible: true,
    graphEligible: completeness.graphEligible,
    traitEligible: completeness.traitEligible,
    guidedCompletionEligible: completeness.guidedCompletionEligible,
  };
}
