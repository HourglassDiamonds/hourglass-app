import {
  GIA_FACSIMILE_GIRDLE_UNREADABLE_FLAG,
  hasLpCoreProportionDrivers,
  isGiaFacsimileGirdlePhraseUnreadable,
} from "./gia-facsimile-calibration-policy";
import { listLpTestRequiredMissing } from "./light-performance-test-rows";
import type { FieldProvenanceMap, ValueProvenanceMap } from "./extraction-provenance";
import type { CalibrationWorkbookEntry, ReportFieldKey } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export type CalibrationSafetyFlagId =
  | "incomplete_proportion_set"
  | "manual_override_present"
  | "low_confidence_extraction"
  | "ocr_only_record"
  | "migration_record"
  | "synthetic_fixture"
  | "missing_key_angles"
  | "gia_girdle_phrase_unreadable"
  | "not_calibration_eligible";

export const CALIBRATION_SAFETY_FLAG_LABELS: Record<
  CalibrationSafetyFlagId,
  string
> = {
  incomplete_proportion_set: "Incomplete proportion set",
  manual_override_present: "Manual override present",
  low_confidence_extraction: "Low-confidence extraction",
  ocr_only_record: "OCR-only record",
  migration_record: "Migration record",
  synthetic_fixture: "Synthetic calibration fixture",
  missing_key_angles: "Missing key angles",
  gia_girdle_phrase_unreadable:
    "GIA facsimile girdle thickness phrase unreadable (OCR)",
  not_calibration_eligible: "Not calibration-eligible",
};

export type CalibrationSafetyAssessment = {
  calibrationEligible: boolean;
  reviewFlags: CalibrationSafetyFlagId[];
  completenessPercent: number;
  manualOverrideCount: number;
  lowConfidenceFieldCount: number;
  missingRequired: ReportFieldKey[];
  reasons: string[];
};

const PROPORTION_CORE: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

const KEY_ANGLES: ReportFieldKey[] = ["crownAngle", "pavilionAngle"];

const MAX_MANUAL_OVERRIDES_FOR_AUTO_CALIBRATION = 0;
const MAX_LOW_CONFIDENCE_PROPORTION_FIELDS = 2;

function countLowConfidenceProportions(
  fieldProvenance?: FieldProvenanceMap,
): number {
  if (!fieldProvenance) return 0;
  let n = 0;
  for (const key of PROPORTION_CORE) {
    const p = fieldProvenance[key];
    if (
      p &&
      (p.extractionClass === "OCR_LOW_CONFIDENCE" ||
        p.extractionClass === "MANUAL_REQUIRED" ||
        p.legacyConfidence === "low")
    ) {
      n++;
    }
  }
  return n;
}

function countManualOverrides(valueProvenance?: ValueProvenanceMap): number {
  if (!valueProvenance) return 0;
  return Object.values(valueProvenance).filter(
    (s) => s === "manual-user" || s === "manual-admin",
  ).length;
}

export function assessCalibrationSafety(
  entry: CalibrationWorkbookEntry,
): CalibrationSafetyAssessment {
  const fields = entry.fieldsNormalized ?? entry.fields;
  const missingRequired = listLpTestRequiredMissing(fields);
  const populated = REPORT_FIELD_KEYS.filter((k) => fields[k]?.trim()).length;
  const completenessPercent = Math.round(
    (populated / REPORT_FIELD_KEYS.length) * 100,
  );

  const manualOverrideCount = countManualOverrides(entry.valueProvenance);
  const lowConfidenceFieldCount = countLowConfidenceProportions(
    entry.fieldProvenance,
  );

  const flags: CalibrationSafetyFlagId[] = [];
  const reasons: string[] = [];

  if (entry.syntheticCalibration) {
    flags.push("synthetic_fixture");
    reasons.push("synthetic calibration fixture — distribution testing only");
  }

  const migrated = Object.values(entry.valueProvenance ?? {}).some(
    (s) => s === "migrated",
  );
  if (migrated) flags.push("migration_record");

  if (manualOverrideCount > MAX_MANUAL_OVERRIDES_FOR_AUTO_CALIBRATION) {
    flags.push("manual_override_present");
    reasons.push(
      `${manualOverrideCount} field(s) manually overridden vs extraction snapshot`,
    );
  }

  const missingProportions = PROPORTION_CORE.filter((k) => !fields[k]?.trim());
  if (missingProportions.length > 0) {
    flags.push("incomplete_proportion_set");
    reasons.push(`missing proportions: ${missingProportions.join(", ")}`);
  }

  const missingAngles = KEY_ANGLES.filter((k) => !fields[k]?.trim());
  if (missingAngles.length > 0) {
    flags.push("missing_key_angles");
    reasons.push(`missing angles: ${missingAngles.join(", ")}`);
  }

  if (missingRequired.length > 0) {
    reasons.push(`missing LP-required: ${missingRequired.join(", ")}`);
  }

  const girdlePhraseUnreadable = isGiaFacsimileGirdlePhraseUnreadable(entry);
  const lpCoreComplete = hasLpCoreProportionDrivers(fields);
  const waiveFacsimileLowConfidenceBlock =
    girdlePhraseUnreadable && lpCoreComplete;

  if (
    lowConfidenceFieldCount > MAX_LOW_CONFIDENCE_PROPORTION_FIELDS &&
    !waiveFacsimileLowConfidenceBlock
  ) {
    flags.push("low_confidence_extraction");
    reasons.push(
      `${lowConfidenceFieldCount} proportion field(s) low-confidence`,
    );
  }

  if (girdlePhraseUnreadable && lpCoreComplete) {
    flags.push(GIA_FACSIMILE_GIRDLE_UNREADABLE_FLAG);
    reasons.push(
      "GIA facsimile: core proportions present; girdle thickness phrase not recovered from OCR",
    );
  }

  const ocrOnly =
    entry.textMethod === "ocr" &&
    !entry.parserMetadata?.extractionMeta?.gcalImageOnlyPdf;
  if (ocrOnly && entry.metadata.reportSource !== "manual") {
    flags.push("ocr_only_record");
  }

  const lowConfidenceBlocks =
    lowConfidenceFieldCount > MAX_LOW_CONFIDENCE_PROPORTION_FIELDS &&
    !waiveFacsimileLowConfidenceBlock;

  const eligible =
    !entry.syntheticCalibration &&
    missingRequired.length === 0 &&
    missingProportions.length === 0 &&
    manualOverrideCount <= MAX_MANUAL_OVERRIDES_FOR_AUTO_CALIBRATION &&
    !lowConfidenceBlocks;

  if (!eligible) flags.push("not_calibration_eligible");

  return {
    calibrationEligible: eligible,
    reviewFlags: [...new Set(flags)],
    completenessPercent,
    manualOverrideCount,
    lowConfidenceFieldCount,
    missingRequired,
    reasons,
  };
}

export function isCalibrationDistributionSafe(
  assessments: CalibrationSafetyAssessment[],
): boolean {
  if (assessments.length === 0) return false;
  const eligible = assessments.filter((a) => a.calibrationEligible).length;
  return eligible / assessments.length >= 0.85;
}
