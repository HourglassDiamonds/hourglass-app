import { isActiveCorpusRecord } from "./corpus-core";
import { assessCalibrationSafety } from "./calibration-safety";
import type { CalibrationSafetyAssessment } from "./calibration-safety";
import { buildLpTestRow } from "./light-performance-test-rows";
import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import type {
  CalibrationWorkbookEntry,
  ReportFieldKey,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

const LP_CORE_KEYS: ReportFieldKey[] = [
  "shape",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

const CRITICAL_MANUAL_OVERRIDE_KEYS: ReportFieldKey[] = [
  ...LP_CORE_KEYS,
];

const PROPORTION_PARSE_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
];

function parseNum(value: string): number | null {
  const n = parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Extreme or non-numeric proportion values — exclude from calibration statistics. */
export function hasImpossibleOrExtremeProportions(
  fields: CalibrationWorkbookEntry["fields"],
): boolean {
  const checks: Array<{ key: ReportFieldKey; min: number; max: number }> = [
    { key: "tablePercent", min: 40, max: 70 },
    { key: "depthPercent", min: 50, max: 75 },
    { key: "crownAngle", min: 20, max: 45 },
    { key: "pavilionAngle", min: 35, max: 45 },
    { key: "lowerHalfPercent", min: 60, max: 90 },
    { key: "starLengthPercent", min: 30, max: 70 },
  ];
  for (const { key, min, max } of checks) {
    const raw = fields[key]?.trim();
    if (!raw) continue;
    const n = parseNum(raw);
    if (n === null || n < min || n > max) return true;
  }
  return false;
}

export function hasCriticalManualUserOverrides(
  entry: CalibrationWorkbookEntry,
): boolean {
  const vp = entry.valueProvenance;
  if (!vp) return false;
  return CRITICAL_MANUAL_OVERRIDE_KEYS.some(
    (k) => vp[k] === "manual-user" || vp[k] === "manual-admin",
  );
}

/** Stored score disagrees with deterministic rescoring beyond tolerance. */
export function hasUnresolvedScoreMismatch(
  entry: CalibrationWorkbookEntry,
): boolean {
  const row = buildLpTestRow(entry);
  return row.scoreMismatch;
}

/** Conflicting extraction signals on core proportions (metadata only). */
export function hasUnresolvedParserContradictions(
  entry: CalibrationWorkbookEntry,
): boolean {
  const fields = entry.fieldsNormalized ?? entry.fields;
  const raw = entry.extractedFieldsRaw;
  for (const key of PROPORTION_PARSE_KEYS) {
    const approved = fields[key]?.trim();
    const extracted = raw[key]?.trim();
    if (
      approved &&
      extracted &&
      approved !== extracted &&
      !entry.valueProvenance?.[key]
    ) {
      return true;
    }
  }
  return false;
}

export type CalibrationInclusionDenialReason =
  | "not_calibration_eligible"
  | "synthetic_fixture"
  | "quarantined"
  | "excluded_from_calibration_stats"
  | "manual_core_override"
  | "critical_manual_override"
  | "incomplete_core_proportions"
  | "unresolved_score_mismatch"
  | "unresolved_parser_contradiction"
  | "impossible_geometry"
  | "missing_shape_for_scoring";

export type CalibrationInclusionAssessment = {
  /** May enter LP reference stats / distribution calibration / tuning datasets. */
  includedInCalibrationStatistics: boolean;
  /** May save, score, and display internally regardless of inclusion. */
  operationalRecord: boolean;
  denialReasons: CalibrationInclusionDenialReason[];
  safety: CalibrationSafetyAssessment;
};

export function assessCalibrationInclusion(
  entry: CalibrationWorkbookEntry,
): CalibrationInclusionAssessment {
  const safety = assessCalibrationSafety(entry);
  const fields = entry.fieldsNormalized ?? entry.fields;
  const denialReasons: CalibrationInclusionDenialReason[] = [];

  if (entry.syntheticCalibration) {
    denialReasons.push("synthetic_fixture");
  }
  if (!safety.calibrationEligible) {
    denialReasons.push("not_calibration_eligible");
  }
  if (hasCriticalManualUserOverrides(entry)) {
    denialReasons.push("critical_manual_override");
  }
  const missingCore = LP_CORE_KEYS.filter((k) => !fields[k]?.trim());
  if (missingCore.length > 0) {
    denialReasons.push("incomplete_core_proportions");
  }
  if (hasImpossibleOrExtremeProportions(fields)) {
    denialReasons.push("impossible_geometry");
  }
  if (hasUnresolvedScoreMismatch(entry)) {
    denialReasons.push("unresolved_score_mismatch");
  }
  if (hasUnresolvedParserContradictions(entry)) {
    denialReasons.push("unresolved_parser_contradiction");
  }

  const rescored = scoreRoundBrilliant(fields);
  if (rescored.ineligibleReason?.includes("Shape")) {
    denialReasons.push("missing_shape_for_scoring");
  }

  const included =
    !entry.syntheticCalibration &&
    isActiveCorpusRecord(entry) &&
    !entry.excludedFromCalibrationStats &&
    !entry.corpusReviewFlags?.includes("manual_core_override") &&
    safety.calibrationEligible &&
    !hasCriticalManualUserOverrides(entry) &&
    missingCore.length === 0 &&
    !hasImpossibleOrExtremeProportions(fields) &&
    !hasUnresolvedScoreMismatch(entry) &&
    !hasUnresolvedParserContradictions(entry) &&
    !rescored.ineligibleReason?.includes("Shape");

  return {
    includedInCalibrationStatistics: included,
    operationalRecord: true,
    denialReasons,
    safety,
  };
}

export function filterCalibrationStatisticsPopulation(
  entries: CalibrationWorkbookEntry[],
): CalibrationWorkbookEntry[] {
  return entries.filter(
    (e) => assessCalibrationInclusion(e).includedInCalibrationStatistics,
  );
}
