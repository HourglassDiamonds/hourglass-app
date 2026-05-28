import type {
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { assessReportCapability } from "./report-capability";

/**
 * "Full read achievable" — proportion/deep capability.
 * Used by the extraction pipeline to decide when to STOP expensive OCR.
 * Client usefulness/partial classification lives in client-interpretation-pipeline.
 */
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
