import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import {
  buildClientInterpretationConfidence,
  type ClientInterpretationConfidence,
} from "./client-interpretation-confidence";

/**
 * Single client-facing TRUST layer.
 *
 * Builds on the display-confidence primitive and maps it to one of three
 * render states. This governs ONLY what the UI shows — never the canonical
 * score, parsers, OCR, or calibration logic.
 *
 *  - full         → score + graph + trait breakdown, confident tone
 *  - partial      → known fields + careful tone, capped score, restrained graph
 *  - orientation  → identity only: no score, no calculated polygon, no traits
 */

export type ClientReadStateKind = "full" | "partial" | "orientation";

export type ClientReadState = {
  state: ClientReadStateKind;
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

  const hasMeasurements = present(fields, "measurements");
  const hasTable = present(fields, "tablePercent");
  const hasDepth = present(fields, "depthPercent");
  const hasCrown = present(fields, "crownAngle");
  const hasPavilion = present(fields, "pavilionAngle");
  const coreProportionCount = [hasTable, hasDepth, hasCrown, hasPavilion].filter(
    Boolean,
  ).length;
  const finishCount = (
    ["polish", "symmetry", "fluorescence"] as ReportFieldKey[]
  ).filter((k) => present(fields, k)).length;

  // Hard rule: missing table / crown / pavilion can never be a FULL read.
  const isFull =
    conf.level === "high" &&
    hasMeasurements &&
    hasTable &&
    hasDepth &&
    hasCrown &&
    hasPavilion;

  // Orientation: barely enough to identify the report — no proportions,
  // no measurements, and no finish cluster to anchor a meaningful read.
  const isOrientation =
    !isFull &&
    !hasMeasurements &&
    coreProportionCount === 0 &&
    finishCount < 2;

  const state: ClientReadStateKind = isFull
    ? "full"
    : isOrientation
      ? "orientation"
      : "partial";

  // Hard rule: Exceptional/Rare/Top% only when crown AND pavilion are present.
  const canShowRareLanguage =
    state === "full" && conf.canShowRareLanguage && hasCrown && hasPavilion;

  if (state === "orientation") {
    return {
      state,
      confidence: "low",
      missingCriticalFields: conf.missingCriticalFields,
      canShowScore: false,
      canShowGraph: false,
      canShowTraitBreakdown: false,
      canShowRareLanguage: false,
      displayScoreCap: null,
      graphStrengthMultiplier: 0,
      summaryTone: "orientation",
      reason:
        "This report identifies the diamond but does not show enough proportion detail for a performance read.",
    };
  }

  return {
    state,
    confidence: conf.level,
    missingCriticalFields: conf.missingCriticalFields,
    canShowScore: true,
    canShowGraph: true,
    canShowTraitBreakdown: true,
    canShowRareLanguage,
    displayScoreCap: conf.scoreDisplayCap,
    graphStrengthMultiplier: conf.graphStrengthMultiplier,
    summaryTone: state === "full" ? "confident" : "careful",
    reason: conf.reason,
  };
}
