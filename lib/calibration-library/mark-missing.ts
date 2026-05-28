import type {
  CalibrationReportFields,
  FieldConfidence,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Empty fields not extracted are marked missing so review can continue. */
export function applyMissingFieldMarkers(
  fields: CalibrationReportFields,
  confidence: Record<ReportFieldKey, FieldConfidence>,
): void {
  for (const key of REPORT_FIELD_KEYS) {
    if (!fields[key].trim()) {
      confidence[key] = "missing";
    }
  }
}

export function applyMissingMetadataWarnings(metadata: {
  lab: string;
  reportNumber: string;
}): string[] {
  const warnings: string[] = [];
  if (!metadata.reportNumber.trim()) {
    warnings.push("Report number missing — enter the number printed on the report.");
  }
  return warnings;
}
