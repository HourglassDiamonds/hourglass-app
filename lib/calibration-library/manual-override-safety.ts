import type { ValueProvenanceMap, ValueProvenanceSource } from "./extraction-provenance";
import { mergeValueProvenanceOnSave } from "./extraction-provenance";
import type {
  CalibrationExtractionSnapshot,
  CalibrationReportFields,
  ReportFieldKey,
} from "./types";

/** Required scoring drivers — manual edit blocks calibration statistics. */
export const MANUAL_OVERRIDE_REQUIRED_FIELDS: ReportFieldKey[] = [
  "shape",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

export const MANUAL_OVERRIDE_OPTIONAL_FIELDS: ReportFieldKey[] = [
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "lowerHalfPercent",
  "starLengthPercent",
];

export const MANUAL_PROPORTION_WARNING =
  "Manual proportion edits are saved for review but excluded from calibration statistics until approved.";

export const MANUAL_OPTIONAL_SOFT_WARNING =
  "Optional field was manually edited — verify against the report. Multiple manual edits may exclude this record from calibration statistics.";

export type ManualOverrideReview = {
  valueProvenance: ValueProvenanceMap;
  warnings: string[];
  hardWarnings: string[];
  manualRequiredOverrides: ReportFieldKey[];
  manualOptionalOverrides: ReportFieldKey[];
  blocksCalibrationStatistics: boolean;
  includeInCalibrationStats: boolean;
};

function normalizeFieldValue(v: string): string {
  return v.trim();
}

export function buildManualOverrideReview(input: {
  approvedFields: CalibrationReportFields;
  extractionSnapshot: CalibrationExtractionSnapshot | null;
  priorValueProvenance?: ValueProvenanceMap;
  actor?: "manual-user" | "manual-admin";
}): ManualOverrideReview {
  const extracted = input.extractionSnapshot?.fields;
  const actor = input.actor ?? "manual-user";
  const warnings: string[] = [];
  const hardWarnings: string[] = [];
  const manualRequiredOverrides: ReportFieldKey[] = [];
  const manualOptionalOverrides: ReportFieldKey[] = [];

  const valueProvenance = mergeValueProvenanceOnSave({
    approvedFields: input.approvedFields,
    extractedFields: extracted ?? input.approvedFields,
    prior: input.priorValueProvenance,
    actor,
  });

  if (!extracted) {
    return {
      valueProvenance,
      warnings: [],
      hardWarnings: [],
      manualRequiredOverrides: [],
      manualOptionalOverrides: [],
      blocksCalibrationStatistics: false,
      includeInCalibrationStats: true,
    };
  }

  for (const key of MANUAL_OVERRIDE_REQUIRED_FIELDS) {
    const approved = normalizeFieldValue(input.approvedFields[key] ?? "");
    const base = normalizeFieldValue(extracted[key] ?? "");
    if (approved && approved !== base) {
      valueProvenance[key] = actor;
      manualRequiredOverrides.push(key);
    }
  }

  for (const key of MANUAL_OVERRIDE_OPTIONAL_FIELDS) {
    const approved = normalizeFieldValue(input.approvedFields[key] ?? "");
    const base = normalizeFieldValue(extracted[key] ?? "");
    if (approved && approved !== base) {
      if (valueProvenance[key] !== actor) {
        valueProvenance[key] = actor;
      }
      manualOptionalOverrides.push(key);
    }
  }

  if (manualRequiredOverrides.length > 0) {
    hardWarnings.push(MANUAL_PROPORTION_WARNING);
    warnings.push(
      `Manual override on required field(s): ${manualRequiredOverrides.join(", ")}`,
    );
  }

  if (manualOptionalOverrides.length >= 3) {
    warnings.push(MANUAL_OPTIONAL_SOFT_WARNING);
  } else if (manualOptionalOverrides.length > 0) {
    warnings.push(
      `Optional manual edit(s): ${manualOptionalOverrides.join(", ")} — verify on report.`,
    );
  }

  const blocksCalibrationStatistics = manualRequiredOverrides.length > 0;
  const includeInCalibrationStats =
    !blocksCalibrationStatistics && manualOptionalOverrides.length < 3;

  return {
    valueProvenance,
    warnings,
    hardWarnings,
    manualRequiredOverrides,
    manualOptionalOverrides,
    blocksCalibrationStatistics,
    includeInCalibrationStats,
  };
}

export function provenanceLabel(source?: ValueProvenanceSource): string {
  switch (source) {
    case "manual-user":
      return "manual (user)";
    case "manual-admin":
      return "manual (admin)";
    case "ocr":
      return "OCR";
    case "diagram":
      return "diagram OCR";
    case "synthetic-fixture":
      return "synthetic";
    case "migrated":
      return "migrated";
    case "extracted":
    default:
      return "extracted";
  }
}
