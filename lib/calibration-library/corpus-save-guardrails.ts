import { assessCalibrationSafety } from "./calibration-safety";
import {
  CORPUS_CORE_PROPORTION_KEYS,
  missingCoreProportionKeys,
} from "./corpus-core";
import type { CalibrationWorkbookEntry, ReportFieldKey } from "./types";

const MANUAL_CORE_FLAG = "manual_core_override" as const;

export type CorpusSaveGuardrailFlags = {
  manualCoreOverride: boolean;
  incompleteCoreProportions: boolean;
};

export function detectManualCoreOverrideWithoutExtraction(
  entry: CalibrationWorkbookEntry,
): boolean {
  const fields = entry.fieldsNormalized ?? entry.fields;
  const extracted = entry.extractedFieldsRaw;
  const vp = entry.valueProvenance ?? entry.parserMetadata?.valueProvenance;

  for (const key of CORPUS_CORE_PROPORTION_KEYS) {
    const approved = fields[key]?.trim();
    if (!approved) continue;

    const wasExtracted = Boolean(extracted[key]?.trim());
    const manualSource =
      vp?.[key] === "manual-user" || vp?.[key] === "manual-admin";
    const differsFromExtract =
      wasExtracted && approved !== extracted[key]?.trim();

    if (!wasExtracted || manualSource || differsFromExtract) {
      return true;
    }
  }
  return false;
}

export function assessCorpusSaveGuardrails(
  entry: CalibrationWorkbookEntry,
): CorpusSaveGuardrailFlags {
  const fields = entry.fieldsNormalized ?? entry.fields;
  const missingCore = missingCoreProportionKeys(fields);
  return {
    incompleteCoreProportions: missingCore.length > 0,
    manualCoreOverride: detectManualCoreOverrideWithoutExtraction(entry),
  };
}

/** Apply deterministic exclusion flags on save — does not block persistence. */
export function applyCorpusSaveGuardrails(
  entry: CalibrationWorkbookEntry,
): CalibrationWorkbookEntry {
  if (entry.syntheticCalibration) {
    return {
      ...entry,
      excludedFromCalibrationStats: true,
      corpusStatus: entry.corpusStatus ?? "active",
    };
  }

  if (entry.corpusStatus === "quarantined") {
    return {
      ...entry,
      excludedFromCalibrationStats: true,
      calibrationEligible: false,
    };
  }

  const flags = assessCorpusSaveGuardrails(entry);
  const safety = assessCalibrationSafety(entry);

  let excludedFromCalibrationStats = !safety.calibrationEligible;
  const corpusFlags: string[] = [
    ...(entry.corpusReviewFlags ?? []),
  ].filter((f) => f !== MANUAL_CORE_FLAG);

  if (flags.incompleteCoreProportions) {
    excludedFromCalibrationStats = true;
  }

  if (flags.manualCoreOverride) {
    excludedFromCalibrationStats = true;
    if (!corpusFlags.includes(MANUAL_CORE_FLAG)) {
      corpusFlags.push(MANUAL_CORE_FLAG);
    }
  }

  return {
    ...entry,
    calibrationEligible: safety.calibrationEligible,
    excludedFromCalibrationStats,
    corpusReviewFlags: corpusFlags.length ? corpusFlags : undefined,
    corpusStatus: entry.corpusStatus ?? "active",
    parserMetadata: {
      ...entry.parserMetadata,
      excludedFromCalibrationStats,
      corpusReviewFlags: corpusFlags.length ? corpusFlags : undefined,
      corpusStatus: entry.corpusStatus ?? "active",
    },
  };
}

export function manualCoreOverrideKeys(
  entry: CalibrationWorkbookEntry,
): ReportFieldKey[] {
  const fields = entry.fieldsNormalized ?? entry.fields;
  const extracted = entry.extractedFieldsRaw;
  const vp = entry.valueProvenance ?? entry.parserMetadata?.valueProvenance;
  const keys: ReportFieldKey[] = [];

  for (const key of CORPUS_CORE_PROPORTION_KEYS) {
    const approved = fields[key]?.trim();
    if (!approved) continue;
    const wasExtracted = Boolean(extracted[key]?.trim());
    const manualSource =
      vp?.[key] === "manual-user" || vp?.[key] === "manual-admin";
    if (!wasExtracted || manualSource || approved !== extracted[key]?.trim()) {
      keys.push(key);
    }
  }
  return keys;
}
