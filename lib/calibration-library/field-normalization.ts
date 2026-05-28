import type { CalibrationReportFields, ReportFieldKey } from "./types";
import { REPORT_FIELD_KEYS } from "./types";
import { finalizeExtractionFields } from "./fields";

/** Normalize report number for duplicate detection (no lab inference). */
export function normalizeReportNumber(reportNumber: string): string {
  return reportNumber.trim().toUpperCase().replace(/\s+/g, "");
}

/** Strip display suffixes for scoring/storage consistency — never invent missing values. */
function normalizeFieldValue(key: ReportFieldKey, raw: string): string {
  const v = raw.trim();
  if (!v) return "";

  switch (key) {
    case "tablePercent":
    case "depthPercent":
    case "lowerHalfPercent":
    case "starLengthPercent":
      return v.replace(/%/g, "").trim();
    case "crownAngle":
    case "pavilionAngle":
      return v.replace(/°/g, "").replace(/\s*H\b/gi, "").trim();
    case "measurements":
      return v.replace(/\s+/g, " ").replace(/X/g, "x");
    case "carat":
      return v.replace(/\s*carat\b/gi, "").trim();
    default:
      return v;
  }
}

/** Deterministic normalized copy for scoring repeatability (empty stays empty). */
export function normalizeCalibrationFields(
  fields: CalibrationReportFields,
): CalibrationReportFields {
  const base = finalizeExtractionFields(fields);
  const out = { ...base };
  for (const key of REPORT_FIELD_KEYS) {
    out[key] = normalizeFieldValue(key, base[key]);
  }
  return out;
}

export function listMissingFieldKeys(
  fields: CalibrationReportFields,
): ReportFieldKey[] {
  return REPORT_FIELD_KEYS.filter((k) => !fields[k].trim());
}
