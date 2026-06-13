import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { assessExtractionCompleteness } from "./extraction-completeness";
import {
  isUsableDisplayClarityValue,
  isUsableDisplayColorValue,
  type ReportGradeHints,
} from "./report-grade-hints";

/**
 * Core scoring proportions are present — use normal scored presentation even when
 * API tier is partial (e.g. missing girdle/culet secondary diagram fields).
 */
export function shouldPresentScoredCoreRead(input: {
  fields: Partial<CalibrationReportFields> | null | undefined;
  gradeHints?: Pick<ReportGradeHints, "color" | "clarity"> | null;
}): boolean {
  const completeness = assessExtractionCompleteness({
    fields: input.fields ?? {},
  });
  if (!completeness.scoreEligible) return false;
  return (
    isUsableDisplayColorValue(input.gradeHints?.color) &&
    isUsableDisplayClarityValue(input.gradeHints?.clarity)
  );
}
