import type { DiamondInterpretationContext } from "./client-interpretation-context";
import type { ClientSafeReportCapability } from "./client-api";

export type DecisionConfidenceBand = "High" | "Moderate" | "Low";

export type DecisionConfidence = {
  label: string;
  band: DecisionConfidenceBand;
  explanation: string;
};

/**
 * Trust in the interpretation read — independent of buying recommendation.
 * Driven only by extraction/report completeness, not clarity or optical score.
 */
export function buildDecisionConfidence(input: {
  context: DiamondInterpretationContext;
  capability: ClientSafeReportCapability;
}): DecisionConfidence {
  const ctx = input.context;

  if (
    ctx.extractionState === "REPORT_ONLY" ||
    ctx.extractionState === "EXTRACTION_ERROR" ||
    ctx.readState === "orientation"
  ) {
    return {
      label: "Confidence",
      band: "Low",
      explanation:
        "Only basic report detail is available — proportion architecture cannot be read with full confidence yet.",
    };
  }

  if (!ctx.scoreEligible) {
    return {
      label: "Confidence",
      band: "Low",
      explanation:
        ctx.missingCriticalFields.length > 0
          ? `Key diagram fields (${ctx.missingCriticalFields.slice(0, 3).join(", ")}) are missing — treat this as a preliminary architectural read.`
          : "Proportion detail is incomplete on the report — confidence in the full read stays low until more fields are confirmed.",
    };
  }

  const secondaryDiagramFieldsPending =
    input.capability.needsExpertDiagramReview ||
    input.capability.needsGuidedCompletion;

  if (ctx.confidenceLevel === "high") {
    return {
      label: "Confidence",
      band: "High",
      explanation: secondaryDiagramFieldsPending
        ? "Core proportions are visible on the report — optional girdle or culet detail would sharpen the deeper architectural read."
        : "Core proportions and finish detail are visible on the report — this interpretation reflects a complete report-based architectural read.",
    };
  }

  if (ctx.confidenceLevel === "medium") {
    return {
      label: "Confidence",
      band: "Moderate",
      explanation:
        input.capability.needsExpertDiagramReview
          ? "Core proportions are readable; a few diagram-only fields would sharpen the architectural read."
          : "Most proportion detail is present, but a few fields would sharpen how confidently we describe the architecture.",
    };
  }

  return {
    label: "Confidence",
    band: "Moderate",
    explanation:
      "Core scoring proportions are present — treat missing girdle or culet as optional refinement, not a blocker to this read.",
  };
}
