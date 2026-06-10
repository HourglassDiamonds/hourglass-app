import type { ReportGradeHints } from "./report-grade-hints";
import {
  HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE,
  SI2_INSPECTION_REQUIRED_MESSAGE,
} from "./hourglass-clarity-policy";
import { hourglassClarityStandardsNote } from "./hourglass-clarity-standards";

export type ClarityReviewGuidance = {
  show: boolean;
  title: string;
  body: string;
  tone: "professional" | "strong";
};

/** Interpretation-layer copy when clarity needs human review — not a grade change. */
export function buildClarityReviewGuidance(
  hints: ReportGradeHints,
): ClarityReviewGuidance | null {
  const clarity = hints.clarity?.trim().toUpperCase();
  if (!clarity) return null;

  if (clarity === "SI2") {
    return {
      show: true,
      tone: "professional",
      title: "Inspection Required",
      body: SI2_INSPECTION_REQUIRED_MESSAGE,
    };
  }

  if (clarity === "SI1") {
    return {
      show: true,
      tone: "professional",
      title: "Professional Review Recommended",
      body:
        "SI1 can be a practical choice when eye-clean in person, but the report alone cannot confirm that. Direct review helps before you rely on this as a final candidate.",
    };
  }

  if (clarity === "I1" || clarity === "I2" || clarity === "I3") {
    const standards = hourglassClarityStandardsNote(clarity);
    return {
      show: true,
      tone: "strong",
      title: "Outside Hourglass Clarity Standards",
      body: [HOURGLASS_EXCLUDED_CLARITY_CONSUMER_MESSAGE, standards]
        .filter(Boolean)
        .join(" "),
    };
  }

  return null;
}
