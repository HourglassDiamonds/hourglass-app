import { emptyReportFields } from "@/lib/calibration-library/fields";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { assessReportCapability } from "./report-capability";
import type {
  ClientFieldAttribution,
  ClientInterpretationLevel,
  ClientInterpretationSnapshot,
} from "./types";

const CLIENT_ATTRIBUTION: ClientFieldAttribution = {
  source: "client-entered",
  usage: "interpretation-only",
  excludedFromCalibrationStats: true,
  requiresAdminApprovalForCalibration: true,
};

export type BuildClientInterpretationInput = {
  extractedFields: CalibrationReportFields;
  clientCompletedFields: Partial<CalibrationReportFields>;
  /** Per-field explicit overwrite of a non-empty extracted value. */
  confirmedOverwrites?: Partial<Record<ReportFieldKey, boolean>>;
};

/**
 * Builds a client interpretation snapshot without mutating calibration/canonical fields.
 * Client values never replace extractedFields; they layer into interpretationFields only.
 */
export function buildClientInterpretationSnapshot(
  input: BuildClientInterpretationInput,
): ClientInterpretationSnapshot {
  const extractedFields = { ...input.extractedFields };
  const clientCompletedFields: Partial<CalibrationReportFields> = {};
  const interpretationFields = emptyReportFields({ ...extractedFields });
  const fieldAttribution: Partial<Record<ReportFieldKey, ClientFieldAttribution>> =
    {};

  for (const key of REPORT_FIELD_KEYS) {
    const clientVal = input.clientCompletedFields[key]?.trim() ?? "";
    const extractedVal = extractedFields[key]?.trim() ?? "";

    if (!clientVal) continue;

    clientCompletedFields[key] = clientVal;

    if (extractedVal && extractedVal !== clientVal) {
      if (!input.confirmedOverwrites?.[key]) {
        continue;
      }
    }

    interpretationFields[key] = clientVal;
    fieldAttribution[key] = {
      ...CLIENT_ATTRIBUTION,
      enteredAt: new Date().toISOString(),
    };
  }

  const capability = assessReportCapability({
    fields: interpretationFields,
  });

  return {
    extractedFields,
    clientCompletedFields,
    interpretationFields,
    fieldAttribution,
    interpretationLevel: capability.interpretationLevel,
    excludedFromCalibrationStats: true,
    requiresAdminApprovalForCalibration: true,
  };
}

/** Guardrail: client snapshots must never be written as calibration corpus entries as-is. */
export function assertClientSnapshotNotCalibrationCanonical(
  snapshot: ClientInterpretationSnapshot,
): void {
  if (!snapshot.excludedFromCalibrationStats) {
    throw new Error("Client interpretation must be excluded from calibration statistics.");
  }
  if (!snapshot.requiresAdminApprovalForCalibration) {
    throw new Error("Client interpretation requires admin approval for calibration use.");
  }
}

export function interpretationLevelLabel(
  level: ClientInterpretationLevel,
): string {
  switch (level) {
    case "basic":
      return "Basic report read";
    case "proportion":
      return "Proportion-based interpretation";
    case "deep":
      return "Deeper light performance estimate";
  }
}
