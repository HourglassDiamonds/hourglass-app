import { assessCalibrationSafety } from "./calibration-safety";
import { isRoundBrilliantShape } from "./fields";
import { LAB_NEUTRAL_SCORE } from "./scoring/scoring-inputs";
import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import type {
  CalibrationReportFields,
  CalibrationWorkbookEntry,
  FieldConfidence,
  ReportFieldKey,
  RoundBrilliantScoreResult,
} from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Required for LP test-console “score-ready” (per internal review spec). */
export const LP_TEST_REQUIRED_KEYS: ReportFieldKey[] = [
  "shape",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

export const LP_TEST_OPTIONAL_KEYS: ReportFieldKey[] = [
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
  "measurements",
  "carat",
];

export type LpTestStatus =
  | "READY"
  | "MISSING"
  | "MISMATCH"
  | "WARNING"
  | "UNSCORED";

export type LpTestRow = {
  id: string;
  reportNumber: string;
  lab: string;
  reportSource: string;
  parserType: string;
  parserConfidence?: string;
  status: LpTestStatus;
  scoreReady: boolean;
  scoreMismatch: boolean;
  hasParserWarning: boolean;
  hasRuntimeWarning: boolean;
  storedScore: number | null;
  recalculatedScore: number | null;
  scoreDelta: number | null;
  storedEligible: boolean;
  recalculatedEligible: boolean;
  ineligibleReason?: string;
  requiredPresent: ReportFieldKey[];
  requiredMissing: ReportFieldKey[];
  optionalPresent: ReportFieldKey[];
  optionalMissing: ReportFieldKey[];
  missingFields: ReportFieldKey[];
  warnings: string[];
  savedAt: string;
  seeded?: boolean;
  syntheticCalibration?: boolean;
  calibrationTier?: string;
  calibrationEligible: boolean;
  safetyFlags: string[];
  entry: CalibrationWorkbookEntry;
};

export const SCORE_MATCH_TOLERANCE = 0;

function fieldPopulated(fields: CalibrationReportFields, key: ReportFieldKey): boolean {
  return Boolean(fields[key]?.trim());
}

export function listLpTestRequiredMissing(
  fields: CalibrationReportFields,
): ReportFieldKey[] {
  const missing: ReportFieldKey[] = [];
  for (const key of LP_TEST_REQUIRED_KEYS) {
    if (!fieldPopulated(fields, key)) missing.push(key);
  }
  return missing;
}

export function isLpTestScoreReady(fields: CalibrationReportFields): boolean {
  const missing = listLpTestRequiredMissing(fields);
  if (missing.length > 0) return false;
  return isRoundBrilliantShape(fields.shape);
}

function hasRuntimeWarningText(warnings: string[]): boolean {
  return warnings.some((w) =>
    /timeout|timed out|504|ocr failed|image ocr failed|pipeline/i.test(w),
  );
}

function scoresMatch(
  stored: RoundBrilliantScoreResult | null,
  recalc: RoundBrilliantScoreResult,
): boolean {
  if (!stored) return recalc.eligible === false;
  if (stored.eligible !== recalc.eligible) return false;
  if (!recalc.eligible) return true;
  return Math.abs(stored.overall - recalc.overall) <= SCORE_MATCH_TOLERANCE;
}

export function assignLpTestStatus(input: {
  requiredMissing: ReportFieldKey[];
  recalculated: RoundBrilliantScoreResult;
  scoreMismatch: boolean;
  warnings: string[];
  hasRuntimeWarning: boolean;
}): LpTestStatus {
  if (input.requiredMissing.length > 0) return "MISSING";
  if (!input.recalculated.eligible) return "UNSCORED";
  if (input.scoreMismatch) return "MISMATCH";
  if (input.hasRuntimeWarning || input.warnings.length > 0) return "WARNING";
  return "READY";
}

export function buildLpTestRow(entry: CalibrationWorkbookEntry): LpTestRow {
  const normalized = entry.fieldsNormalized ?? entry.fields;
  const recalculated = scoreRoundBrilliant(normalized);
  const stored = entry.roundBrilliantScore;

  const requiredMissing = listLpTestRequiredMissing(normalized);
  const requiredPresent = LP_TEST_REQUIRED_KEYS.filter(
    (k) => !requiredMissing.includes(k),
  );
  const optionalPresent = LP_TEST_OPTIONAL_KEYS.filter((k) =>
    fieldPopulated(normalized, k),
  );
  const optionalMissing = LP_TEST_OPTIONAL_KEYS.filter(
    (k) => !fieldPopulated(normalized, k),
  );

  const scoreReady = isLpTestScoreReady(normalized);
  const scoreMismatch = !scoresMatch(stored, recalculated);
  const hasParserWarning = entry.warnings.length > 0;
  const hasRuntimeWarning = hasRuntimeWarningText(entry.warnings);

  const status = assignLpTestStatus({
    requiredMissing,
    recalculated,
    scoreMismatch,
    warnings: entry.warnings,
    hasRuntimeWarning,
  });

  const storedScore =
    stored && stored.eligible ? stored.overall : null;
  const recalculatedScore = recalculated.eligible ? recalculated.overall : null;
  const scoreDelta =
    storedScore != null && recalculatedScore != null
      ? recalculatedScore - storedScore
      : null;

  const missingFields = REPORT_FIELD_KEYS.filter(
    (k) => !fieldPopulated(normalized, k),
  );

  const safety = assessCalibrationSafety(entry);

  return {
    id: entry.id,
    reportNumber: entry.metadata.reportNumber,
    lab: entry.metadata.lab,
    reportSource: entry.metadata.reportSource,
    parserType: entry.parserType ?? "unknown",
    parserConfidence: entry.parserConfidence,
    status,
    scoreReady,
    scoreMismatch,
    hasParserWarning,
    hasRuntimeWarning,
    storedScore,
    recalculatedScore,
    scoreDelta,
    storedEligible: stored?.eligible ?? false,
    recalculatedEligible: recalculated.eligible,
    ineligibleReason: recalculated.ineligibleReason,
    requiredPresent,
    requiredMissing,
    optionalPresent,
    optionalMissing,
    missingFields,
    warnings: entry.warnings,
    savedAt: entry.savedAt,
    seeded: entry.seeded,
    syntheticCalibration:
      entry.syntheticCalibration ?? entry.parserMetadata?.syntheticCalibration,
    calibrationTier:
      entry.calibrationTier ?? entry.parserMetadata?.calibrationTier,
    calibrationEligible: entry.calibrationEligible ?? safety.calibrationEligible,
    safetyFlags: safety.reviewFlags,
    entry,
  };
}

export function buildLpTestRows(
  entries: CalibrationWorkbookEntry[],
): LpTestRow[] {
  return entries.map(buildLpTestRow);
}

export type LpTestSummary = {
  total: number;
  scoreReady: number;
  withWarnings: number;
  mismatches: number;
  missingRequired: number;
  unscored: number;
  labNeutralScore: boolean;
};

export { LAB_NEUTRAL_SCORE };

export function summarizeLpTestRows(rows: LpTestRow[]): LpTestSummary {
  return {
    total: rows.length,
    scoreReady: rows.filter((r) => r.scoreReady).length,
    withWarnings: rows.filter(
      (r) => r.hasParserWarning || r.hasRuntimeWarning,
    ).length,
    mismatches: rows.filter((r) => r.scoreMismatch).length,
    missingRequired: rows.filter((r) => r.status === "MISSING").length,
    unscored: rows.filter((r) => r.status === "UNSCORED").length,
    labNeutralScore: LAB_NEUTRAL_SCORE,
  };
}

export function lowConfidenceFieldKeys(
  confidence: Record<ReportFieldKey, FieldConfidence>,
): ReportFieldKey[] {
  return REPORT_FIELD_KEYS.filter(
    (k) => confidence[k] === "low" || confidence[k] === "missing",
  );
}
