import { scoreRoundBrilliant } from "./scoring/round-brilliant";
import {
  FINISH_SCORING_KEYS,
  SCORING_DRIVER_KEYS,
  SCORING_METADATA_ONLY_KEYS,
} from "./scoring/scoring-inputs";
import type { LpTestRow } from "./light-performance-test-rows";
import { LP_TEST_OPTIONAL_KEYS, LP_TEST_REQUIRED_KEYS } from "./light-performance-test-rows";
import type {
  CalibrationReportFields,
  ReportFieldKey,
  RoundBrilliantScoreDimension,
  RoundBrilliantScoreResult,
} from "./types";
import { FIELD_LABELS } from "./fields";

/** Internal calibration scale (0–10) derived from v1 overall / 100. */
export function overallToCalibrationScale(overall100: number): number {
  return Math.round((overall100 / 10) * 100) / 100;
}

export type CalibrationBandDefinition = {
  id: string;
  min: number;
  max: number;
  label: string;
};

/** Internal LP calibration bands — avoid “perfect” wording. */
export const CALIBRATION_BANDS: CalibrationBandDefinition[] = [
  { id: "exceptional", min: 9.3, max: 10.0, label: "Exceptional / Rare" },
  { id: "superb", min: 8.5, max: 9.29, label: "Superb" },
  { id: "strong", min: 7.5, max: 8.49, label: "Strong" },
  { id: "balanced", min: 6.5, max: 7.49, label: "Balanced" },
  { id: "mixed", min: 5.5, max: 6.49, label: "Mixed" },
  { id: "compromise", min: 0, max: 5.49, label: "Significant Compromise" },
];

export function calibrationBandFromScale(
  calibrationScore: number,
): CalibrationBandDefinition {
  for (const band of CALIBRATION_BANDS) {
    if (calibrationScore >= band.min && calibrationScore <= band.max) {
      return band;
    }
  }
  return CALIBRATION_BANDS[CALIBRATION_BANDS.length - 1]!;
}

export type ReviewFlagId =
  | "score_seems_too_high"
  | "score_seems_too_low"
  | "needs_manual_review"
  | "missing_visual_evidence"
  | "finish_influence_notable"
  | "proportion_finish_spread_notable";

export type ReviewFlag = {
  id: ReviewFlagId;
  label: string;
};

export const REVIEW_FLAG_LABELS: Record<ReviewFlagId, string> = {
  score_seems_too_high: "Score seems too high",
  score_seems_too_low: "Score seems too low",
  needs_manual_review: "Needs manual review",
  missing_visual_evidence: "Missing visual evidence",
  finish_influence_notable: "Finish influence notable",
  proportion_finish_spread_notable: "Proportion vs finish spread notable",
};

export type CalibrationReviewRecord = {
  rowId: string;
  reportNumber: string;
  lab: string;
  scoreReady: boolean;
  calibrationScore: number | null;
  calibrationBandId: string | null;
  calibrationBandLabel: string;
  strengths: string[];
  tradeoffs: string[];
  missingRequired: ReportFieldKey[];
  missingOptional: ReportFieldKey[];
  scoringDriversUsed: string[];
  metadataNotUsed: string[];
  reviewFlags: ReviewFlag[];
  proportionOnlyCalibrationScore: number | null;
  finishSpreadCalibration: number | null;
  parserType: string;
  parserConfidence?: string;
  reportSource: string;
  textMethod?: string;
  engineBand: string | null;
};

export type ScoreDistribution = {
  scoreReadyCount: number;
  scoredEligibleCount: number;
  min: number | null;
  max: number | null;
  average: number | null;
  byBand: { bandId: string; label: string; count: number }[];
};

export type CalibrationReviewReport = {
  distribution: ScoreDistribution;
  reviews: CalibrationReviewRecord[];
  scoreReadyReportNumbers: string[];
  topScoring: { reportNumber: string; lab: string; score: number }[];
  lowestScoring: { reportNumber: string; lab: string; score: number }[];
  suspicious: { reportNumber: string; lab: string; flags: string[] }[];
};

function fieldsWithoutFinish(fields: CalibrationReportFields): CalibrationReportFields {
  const out = { ...fields };
  for (const key of FINISH_SCORING_KEYS) {
    out[key] = "";
  }
  return out;
}

function strengthsFromDimensions(
  dimensions: RoundBrilliantScoreDimension[],
): string[] {
  return dimensions
    .filter(
      (d) =>
        d.score >= 92 &&
        (d.note.includes("Within calibration band") ||
          d.note.includes("Reported none") ||
          d.note.includes("neutral scale")),
    )
    .map((d) => `${d.label} (${d.value ?? "—"}) — ${d.note}`)
    .slice(0, 6);
}

function tradeoffsFromDimensions(
  dimensions: RoundBrilliantScoreDimension[],
): string[] {
  return dimensions
    .filter(
      (d) =>
        d.score < 75 ||
        d.note.includes("Missing") ||
        d.note.includes("Below") ||
        d.note.includes("Above") ||
        d.note.includes("extreme"),
    )
    .map((d) => `${d.label} (${d.value ?? "—"}) — ${d.note}`)
    .slice(0, 8);
}

function deriveReviewFlags(input: {
  row: LpTestRow;
  calibrationScore: number | null;
  strengths: string[];
  tradeoffs: string[];
  finishSpreadCalibration: number | null;
  full: RoundBrilliantScoreResult;
}): ReviewFlag[] {
  const flags: ReviewFlagId[] = [];
  const { row, calibrationScore, strengths, tradeoffs, finishSpreadCalibration } =
    input;

  if (
    row.status !== "READY" ||
    row.scoreMismatch ||
    row.hasRuntimeWarning ||
    row.hasParserWarning ||
    row.parserConfidence === "low"
  ) {
    flags.push("needs_manual_review");
  }

  const meta = row.entry.parserMetadata?.extractionMeta;
  const imageOnly =
    row.entry.metadata.reportSource === "screenshot-upload" ||
    meta?.gcalImageOnlyPdf === true ||
    row.entry.textMethod === "ocr";

  if (
    imageOnly &&
    (row.requiredMissing.length > 0 ||
      !row.entry.fieldsNormalized.lowerHalfPercent.trim())
  ) {
    flags.push("missing_visual_evidence");
  }

  if (
    finishSpreadCalibration != null &&
    Math.abs(finishSpreadCalibration) >= 0.5
  ) {
    flags.push("finish_influence_notable");
    flags.push("proportion_finish_spread_notable");
  }

  if (calibrationScore != null) {
    if (calibrationScore >= 9.0 && tradeoffs.length >= 2) {
      flags.push("score_seems_too_high");
    }
    if (calibrationScore < 6.5 && strengths.length >= 3 && tradeoffs.length <= 1) {
      flags.push("score_seems_too_low");
    }
  }

  if (!input.full.eligible && row.scoreReady) {
    flags.push("needs_manual_review");
  }

  return [...new Set(flags)].map((id) => ({
    id,
    label: REVIEW_FLAG_LABELS[id],
  }));
}

export function buildCalibrationReviewRecord(row: LpTestRow): CalibrationReviewRecord {
  const fields = row.entry.fieldsNormalized ?? row.entry.fields;
  const full = scoreRoundBrilliant(fields);
  const proportionOnly = scoreRoundBrilliant(fieldsWithoutFinish(fields));

  const calibrationScore = full.eligible
    ? overallToCalibrationScale(full.overall)
    : null;
  const band = calibrationScore != null
    ? calibrationBandFromScale(calibrationScore)
    : null;

  const proportionOnlyCalibrationScore =
    proportionOnly.eligible && full.eligible
      ? overallToCalibrationScale(proportionOnly.overall)
      : proportionOnly.eligible
        ? overallToCalibrationScale(proportionOnly.overall)
        : null;

  const finishSpreadCalibration =
    calibrationScore != null && proportionOnlyCalibrationScore != null
      ? Math.round((calibrationScore - proportionOnlyCalibrationScore) * 100) / 100
      : null;

  const strengths = strengthsFromDimensions(full.dimensions);
  const tradeoffs = tradeoffsFromDimensions(full.dimensions);

  const missingRequired = LP_TEST_REQUIRED_KEYS.filter(
    (k) => !fields[k]?.trim(),
  );
  const missingOptional = LP_TEST_OPTIONAL_KEYS.filter(
    (k) => !fields[k]?.trim(),
  );

  const scoringDriversUsed = SCORING_DRIVER_KEYS.filter((k) =>
    fields[k]?.trim(),
  ).map((k) => FIELD_LABELS[k]);

  const metadataNotUsed = [...SCORING_METADATA_ONLY_KEYS].map(
    (k) => FIELD_LABELS[k],
  );

  const reviewFlags = deriveReviewFlags({
    row,
    calibrationScore,
    strengths,
    tradeoffs,
    finishSpreadCalibration,
    full,
  });

  return {
    rowId: row.id,
    reportNumber: row.reportNumber,
    lab: row.lab,
    scoreReady: row.scoreReady,
    calibrationScore,
    calibrationBandId: band?.id ?? null,
    calibrationBandLabel: band?.label ?? "—",
    strengths,
    tradeoffs,
    missingRequired,
    missingOptional,
    scoringDriversUsed,
    metadataNotUsed,
    reviewFlags,
    proportionOnlyCalibrationScore,
    finishSpreadCalibration,
    parserType: row.parserType,
    parserConfidence: row.parserConfidence,
    reportSource: row.reportSource,
    textMethod: row.entry.textMethod,
    engineBand: full.eligible ? full.band : null,
  };
}

export function buildScoreDistribution(
  reviews: CalibrationReviewRecord[],
): ScoreDistribution {
  const scoreReadyCount = reviews.filter((r) => r.scoreReady).length;
  const scored = reviews
    .filter((r) => r.calibrationScore != null)
    .map((r) => r.calibrationScore!);

  const byBand = CALIBRATION_BANDS.map((b) => ({
    bandId: b.id,
    label: b.label,
    count: 0,
  }));

  for (const score of scored) {
    const band = calibrationBandFromScale(score);
    const slot = byBand.find((b) => b.bandId === band.id);
    if (slot) slot.count += 1;
  }

  return {
    scoreReadyCount,
    scoredEligibleCount: scored.length,
    min: scored.length ? Math.min(...scored) : null,
    max: scored.length ? Math.max(...scored) : null,
    average: scored.length
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) /
        100
      : null,
    byBand,
  };
}

export function buildCalibrationReviewReport(
  rows: LpTestRow[],
): CalibrationReviewReport {
  const reviews = rows.map(buildCalibrationReviewRecord);
  const distribution = buildScoreDistribution(reviews);
  const scoreReadyReportNumbers = reviews
    .filter((r) => r.scoreReady && r.calibrationScore != null)
    .map((r) => r.reportNumber);

  const scored = reviews
    .filter((r) => r.calibrationScore != null)
    .sort((a, b) => (b.calibrationScore ?? 0) - (a.calibrationScore ?? 0));

  const topScoring = scored.slice(0, 5).map((r) => ({
    reportNumber: r.reportNumber,
    lab: r.lab,
    score: r.calibrationScore!,
  }));

  const lowestScoring = [...scored]
    .reverse()
    .slice(0, 5)
    .map((r) => ({
      reportNumber: r.reportNumber,
      lab: r.lab,
      score: r.calibrationScore!,
    }));

  const suspicious = reviews
    .filter((r) => r.reviewFlags.length > 0)
    .map((r) => ({
      reportNumber: r.reportNumber,
      lab: r.lab,
      flags: r.reviewFlags.map((f) => f.label),
    }));

  return {
    distribution,
    reviews,
    scoreReadyReportNumbers,
    topScoring,
    lowestScoring,
    suspicious,
  };
}
