import type { CalibrationReportFields, ReportFieldKey } from "../types";

/**
 * Fields that drive scoreRoundBrilliant v1.
 * cutGrade, carat, and measurements are metadata/context only — never scored.
 * Laboratory identity is never passed into the scorer.
 */
export const PROPORTION_SCORING_KEYS = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
] as const satisfies readonly ReportFieldKey[];

export const FINISH_SCORING_KEYS = [
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
] as const satisfies readonly ReportFieldKey[];

export const SCORING_DRIVER_KEYS = [
  "shape",
  ...PROPORTION_SCORING_KEYS,
  ...FINISH_SCORING_KEYS,
] as const satisfies readonly ReportFieldKey[];

/** Explicitly excluded from Hourglass LP score calculation. */
export const SCORING_METADATA_ONLY_KEYS = [
  "cutGrade",
  "carat",
  "measurements",
] as const satisfies readonly ReportFieldKey[];

export const LAB_NEUTRAL_SCORE = true;

function part(fields: CalibrationReportFields, key: ReportFieldKey): string {
  return `${key}=${(fields[key] ?? "").trim()}`;
}

/** Fingerprint for cross-lab checks (all scoring drivers except shape). */
export function buildScoringDriverFingerprint(
  fields: CalibrationReportFields,
  includeShape = false,
): string {
  const keys: ReportFieldKey[] = includeShape
    ? [...SCORING_DRIVER_KEYS]
    : SCORING_DRIVER_KEYS.filter((k) => k !== "shape");
  return keys.map((k) => part(fields, k)).join("|");
}

/** Proportion-only fingerprint per LP design-input rule. */
export function buildProportionDesignFingerprint(
  fields: CalibrationReportFields,
): string {
  const keys: ReportFieldKey[] = ["shape", ...PROPORTION_SCORING_KEYS];
  return keys.map((k) => part(fields, k)).join("|");
}

export function labGradeDisagreementNote(
  fieldsA: CalibrationReportFields,
  fieldsB: CalibrationReportFields,
): string | null {
  const metaKeys: ReportFieldKey[] = ["cutGrade", "polish", "symmetry"];
  const diffs: string[] = [];
  for (const key of metaKeys) {
    const a = (fieldsA[key] ?? "").trim();
    const b = (fieldsB[key] ?? "").trim();
    if (a !== b) diffs.push(`${key}: "${a || "(empty)"}" vs "${b || "(empty)"}"`);
  }
  if (diffs.length === 0) return null;
  return `Lab grade lines differ (metadata / finish component): ${diffs.join("; ")}`;
}
