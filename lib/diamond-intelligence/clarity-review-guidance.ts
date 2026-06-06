import type { ReportGradeHints } from "./report-grade-hints";
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
      title: "Professional Review Recommended",
      body:
        "Some SI2 diamonds are excellent values, while others may show visible inclusions. A grading report alone cannot determine eye-cleanliness, so direct review is especially useful before treating this as a final candidate.",
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

  if (clarity === "I1") {
    const standards = hourglassClarityStandardsNote(clarity);
    return {
      show: true,
      tone: "strong",
      title: "Outside Hourglass Clarity Standards",
      body:
        `Clarity I1 falls outside what Hourglass typically recommends for client sourcing. Direct expert review is strongly recommended before purchase — even when proportions look acceptable on paper. ${standards ?? ""}`,
    };
  }

  if (clarity === "I2" || clarity === "I3") {
    const standards = hourglassClarityStandardsNote(clarity);
    return {
      show: true,
      tone: "strong",
      title: "Outside Hourglass Clarity Standards",
      body:
        `Clarity ${clarity} falls outside what Hourglass typically recommends for client sourcing. Direct expert review is strongly recommended before purchase — optical architecture alone does not offset this grade. ${standards ?? ""}`,
    };
  }

  return null;
}
