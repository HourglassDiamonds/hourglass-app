import type {
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { assessReportCapability } from "./report-capability";

/** Enough to stop expensive OCR (proportion/deep — not lower-half/star). */
export function clientExtractionSufficient(input: {
  fields: CalibrationReportFields;
  confidence?: Record<ReportFieldKey, FieldConfidence>;
}): boolean {
  const cap = assessReportCapability({
    fields: input.fields,
    confidence: input.confidence,
  });
  if (!cap.canRunClientInterpretation) return false;
  return cap.supportsLevel === "proportion" || cap.supportsLevel === "deep";
}

/** Enough to return a useful client interpretation (basic read or better). */
export function clientExtractionUseful(input: {
  fields: CalibrationReportFields;
  confidence?: Record<ReportFieldKey, FieldConfidence>;
}): boolean {
  const cap = assessReportCapability({
    fields: input.fields,
    confidence: input.confidence,
  });
  if (!cap.canRunClientInterpretation) return false;
  return cap.supportsLevel !== "insufficient";
}
