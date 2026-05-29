import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  buildClientInterpretationConfidence,
  type ClientInterpretationConfidence,
} from "./client-interpretation-confidence";
import { buildClientReadState } from "./client-read-state";
import { presentConfidenceAdjustedRead } from "./client-percentile-present";

/**
 * THE single source of truth for client-facing interpretation display.
 *
 * Every public surface (score card, graph, traits, hero/expert copy) reads its
 * decisions from this one context so the UI can never independently overclaim.
 * It composes the display-confidence primitive + read-state + score capping.
 *
 * Display-only: never mutates the canonical score, parsers, OCR, or calibration.
 */

export type DiamondGraphMode = "full" | "preliminary" | "limited";
export type DiamondTraitMode = "normal" | "cautious" | "review";
export type DiamondCopyTone = "confident" | "careful" | "orientation";

export type DiamondInterpretationContext = {
  confidenceLevel: "high" | "medium" | "low";
  readState: "full" | "partial" | "orientation";
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
};

function joinMissing(missing: string[]): string {
  if (missing.length === 0) return "";
  if (missing.length === 1) return missing[0]!;
  if (missing.length === 2) return `${missing[0]} and ${missing[1]}`;
  return `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`;
}

export function buildDiamondInterpretationContext(input: {
  fields: Partial<CalibrationReportFields> | null | undefined;
  rawScore: number | null;
  confidence?: ClientInterpretationConfidence;
}): DiamondInterpretationContext {
  const confidence =
    input.confidence ?? buildClientInterpretationConfidence(input.fields);
  const readState = buildClientReadState(input.fields, confidence);

  const graphMode: DiamondGraphMode =
    readState.state === "full"
      ? "full"
      : readState.confidence === "medium"
        ? "preliminary"
        : "limited";

  const traitMode: DiamondTraitMode =
    readState.state === "full"
      ? "normal"
      : readState.canShowTraitBreakdown
        ? "cautious"
        : "review";

  const copyTone: DiamondCopyTone =
    readState.state === "full"
      ? "confident"
      : readState.confidence === "medium"
        ? "careful"
        : "orientation";

  // ── Display score / label / band (capped; never above the read-state cap) ──
  let displayScore: number | null;
  let displayLabel: string;
  let displayBand: string | null;

  if (!readState.canShowScore) {
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

  // ── Plain-language answers: good? · how sure? · what's missing? · next? ──
  const missingList = joinMissing(readState.missingCriticalFields);

  const primaryExplanation =
    copyTone === "confident"
      ? "This diamond reads as a balanced, lively performer across its full proportion set."
      : copyTone === "careful"
        ? "Based on the information visible in the report, this diamond appears balanced — a few proportion details would sharpen the deeper optical read."
        : "This report gives a useful starting point, but not enough for a full light-performance read.";

  const confidenceExplanation =
    readState.confidence === "high"
      ? "High confidence — the core proportions and finish needed for a light read are all present."
      : readState.confidence === "medium"
        ? `Moderate confidence${missingList ? ` — still missing ${missingList}` : ""}.`
        : `Limited data${missingList ? ` — key details not visible: ${missingList}` : ""}.`;

  const nextStep =
    readState.confidence === "high"
      ? "Compare it with confidence, or have Justin verify any final nuance."
      : "Justin can verify the missing proportion details before you decide.";

  return {
    confidenceLevel: readState.confidence,
    readState: readState.state,
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
  };
}
