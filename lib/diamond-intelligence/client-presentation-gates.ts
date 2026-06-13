import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { assessExtractionCompleteness } from "./extraction-completeness";
import {
  isUsableDisplayClarityValue,
  isUsableDisplayColorValue,
  type ReportGradeHints,
} from "./report-grade-hints";

/** Optional diagram refinements — never re-ask when scored-core read is active. */
const SCORED_CORE_OPTIONAL_REFINEMENT_KEYS: ReportFieldKey[] = [
  "girdle",
  "culet",
];

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

/**
 * When core scoring proportions are present, guided completion should only
 * surface optional secondary fields (girdle/culet), not re-ask for crown/pavilion.
 */
export function resolveClientGuidedCompletionFields(input: {
  fields: Partial<CalibrationReportFields> | null | undefined;
  gradeHints?: Pick<ReportGradeHints, "color" | "clarity"> | null;
  guidedCompletionFields: ReportFieldKey[];
}): ReportFieldKey[] {
  const keys = shouldPresentScoredCoreRead(input)
    ? input.guidedCompletionFields.filter((k) =>
        SCORED_CORE_OPTIONAL_REFINEMENT_KEYS.includes(k),
      )
    : input.guidedCompletionFields;

  return keys.filter((k) => !input.fields?.[k]?.trim());
}
