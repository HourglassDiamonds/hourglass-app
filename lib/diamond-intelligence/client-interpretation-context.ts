import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  buildClientInterpretationConfidence,
  type ClientInterpretationConfidence,
} from "./client-interpretation-confidence";
import { buildClientReadState } from "./client-read-state";
import { presentConfidenceAdjustedRead } from "./client-percentile-present";
import {
  assessExtractionCompleteness,
  toExtractionCompletenessSummary,
  type ExtractionCompletenessSummary,
  type ExtractionState,
} from "./extraction-completeness";

/**
 * THE single source of truth for client-facing interpretation display.
 *
 * Every public surface (score card, graph, traits, hero/expert copy) reads its
 * decisions from this one context so the UI can never independently overclaim.
 */

export type DiamondGraphMode = "full" | "preliminary" | "limited";
export type DiamondTraitMode = "normal" | "cautious" | "review";
export type DiamondCopyTone = "confident" | "careful" | "orientation";

export type DiamondInterpretationContext = {
  confidenceLevel: "high" | "medium" | "low";
  readState: "full" | "partial" | "orientation";
  extractionState: ExtractionState;
  missingCriticalFields: string[];
  displayScore: number | null;
  displayLabel: string;
  displayBand: string | null;
  canShowRareLanguage: boolean;
  canShowScore: boolean;
  canShowGraph: boolean;
  graphMode: DiamondGraphMode;
  graphStrengthMultiplier: number;
  traitMode: DiamondTraitMode;
  copyTone: DiamondCopyTone;
  primaryExplanation: string;
  confidenceExplanation: string;
  nextStep: string;
  scoreEligible: boolean;
  graphEligible: boolean;
  traitEligible: boolean;
  guidedCompletionEligible: boolean;
  extractionCompleteness: ExtractionCompletenessSummary;
};

function joinMissing(missing: string[]): string {
  if (missing.length === 0) return "";
  if (missing.length === 1) return missing[0]!;
  if (missing.length === 2) return `${missing[0]} and ${missing[1]}`;
  return `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`;
}

function graphModeFromCompleteness(
  extractionState: ExtractionState,
  readState: "full" | "partial" | "orientation",
  confidence: "high" | "medium" | "low",
): DiamondGraphMode {
  if (readState === "full" && extractionState === "FULL_EXTRACTION") {
    return "full";
  }
  if (
    extractionState === "PARTIAL_EXTRACTION" ||
    (extractionState === "FULL_EXTRACTION" && readState === "partial")
  ) {
    return confidence === "medium" ? "preliminary" : "limited";
  }
  return "limited";
}

function traitModeFromCompleteness(
  extractionState: ExtractionState,
  readState: "full" | "partial" | "orientation",
  canShowTraitBreakdown: boolean,
): DiamondTraitMode {
  if (
    extractionState === "REPORT_ONLY" ||
    extractionState === "EXTRACTION_ERROR" ||
    readState === "orientation"
  ) {
    return "review";
  }
  if (readState === "full" && extractionState === "FULL_EXTRACTION") {
    return "normal";
  }
  return canShowTraitBreakdown ? "cautious" : "review";
}

export function buildDiamondInterpretationContext(input: {
  fields: Partial<CalibrationReportFields> | null | undefined;
  rawScore: number | null;
  confidence?: ClientInterpretationConfidence;
}): DiamondInterpretationContext {
  const confidence =
    input.confidence ?? buildClientInterpretationConfidence(input.fields);
  const completeness = assessExtractionCompleteness({ fields: input.fields });
  const readState = buildClientReadState(input.fields, confidence);

  const graphMode = graphModeFromCompleteness(
    completeness.extractionState,
    readState.state,
    readState.confidence,
  );

  const traitMode = traitModeFromCompleteness(
    completeness.extractionState,
    readState.state,
    readState.canShowTraitBreakdown,
  );

  const copyTone: DiamondCopyTone =
    readState.state === "full"
      ? "confident"
      : readState.confidence === "medium"
        ? "careful"
        : "orientation";

  let displayScore: number | null;
  let displayLabel: string;
  let displayBand: string | null;

  if (!readState.canShowScore || !completeness.scoreEligible) {
    displayScore = null;
    displayLabel = "Report read";
    displayBand = null;
  } else {
    const adjusted = presentConfidenceAdjustedRead(input.rawScore, {
      scoreDisplayCap: readState.displayScoreCap ?? 100,
      canShowRareLanguage: readState.canShowRareLanguage,
    });
    displayScore = adjusted.displayScore;
    displayLabel = adjusted.presentation.label;
    displayBand = readState.canShowRareLanguage
      ? adjusted.presentation.pillText
      : null;
  }

  const missingList = joinMissing(readState.missingCriticalFields);

  const primaryExplanation =
    copyTone === "confident"
      ? "This diamond reads as a balanced, lively performer across its full proportion set."
      : copyTone === "careful"
        ? "Based on the information visible in the report, this diamond appears balanced — a few proportion details would sharpen the deeper optical read."
        : "This report gives a useful starting point. A fuller light-performance picture becomes available as more proportion detail is confirmed.";

  const confidenceExplanation =
    readState.confidence === "high"
      ? "High confidence — the core proportions and finish needed for a light read are all present."
      : readState.confidence === "medium"
        ? `Early read${missingList ? ` — confirming ${missingList} would help sharpen the picture` : ""}.`
        : completeness.reason ||
          `Early read${missingList ? ` — ${missingList} would help complete the picture` : ""}.`;

  const nextStep =
    readState.confidence === "high"
      ? "Compare it with confidence, or have Justin verify any final nuance."
      : "Justin can help confirm the next details and translate what they may mean for how the diamond will look.";

  return {
    confidenceLevel: readState.confidence,
    readState: readState.state,
    extractionState: completeness.extractionState,
    missingCriticalFields: readState.missingCriticalFields,
    displayScore,
    displayLabel,
    displayBand,
    canShowRareLanguage: readState.canShowRareLanguage,
    canShowScore: readState.canShowScore,
    canShowGraph: readState.canShowGraph,
    graphMode,
    graphStrengthMultiplier: readState.graphStrengthMultiplier,
    traitMode,
    copyTone,
    primaryExplanation,
    confidenceExplanation,
    nextStep,
    scoreEligible: completeness.scoreEligible,
    graphEligible: completeness.graphEligible,
    traitEligible: completeness.traitEligible,
    guidedCompletionEligible: completeness.guidedCompletionEligible,
    extractionCompleteness: toExtractionCompletenessSummary(completeness),
  };
}
