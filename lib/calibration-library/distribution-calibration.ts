import {
  CALIBRATION_BANDS,
  type CalibrationReviewRecord,
  type ScoreDistribution,
} from "./light-performance-calibration-review";
import type { LpTestRow } from "./light-performance-test-rows";

export type DistributionHistogramBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type LabScoreAverage = {
  lab: string;
  count: number;
  average: number | null;
};

export type ParserFamilyAverage = {
  parserFamily: string;
  count: number;
  average: number | null;
  syntheticCount: number;
};

export type FinishSpreadSummary = {
  scoredCount: number;
  withFinishSpread: number;
  averageFinishSpread: number | null;
  averageProportionOnly: number | null;
  averageFull: number | null;
};

export type CalibrationSanityFlag = {
  rowId: string;
  reportNumber: string;
  lab: string;
  flag: string;
};

export type DistributionCalibrationReport = {
  histogram: DistributionHistogramBucket[];
  distribution: ScoreDistribution;
  datasetHealthNotes: string[];
  averageByLab: LabScoreAverage[];
  averageByParserFamily: ParserFamilyAverage[];
  finishSpread: FinishSpreadSummary;
  syntheticCount: number;
  parserExtractedCount: number;
  tierCounts: { tier: string; count: number }[];
  sanityFlags: CalibrationSanityFlag[];
  examplesByBand: {
    bandId: string;
    label: string;
    examples: { reportNumber: string; lab: string; score: number }[];
  }[];
};

const HISTOGRAM_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<5.0", min: 0, max: 4.99 },
  { label: "5.0–5.49", min: 5.0, max: 5.49 },
  { label: "5.5–5.99", min: 5.5, max: 5.99 },
  { label: "6.0–6.49", min: 6.0, max: 6.49 },
  { label: "6.5–6.99", min: 6.5, max: 6.99 },
  { label: "7.0–7.49", min: 7.0, max: 7.49 },
  { label: "7.5–7.99", min: 7.5, max: 7.99 },
  { label: "8.0–8.49", min: 8.0, max: 8.49 },
  { label: "8.5–8.99", min: 8.5, max: 8.99 },
  { label: "9.0–9.29", min: 9.0, max: 9.29 },
  { label: "9.3–9.99", min: 9.3, max: 9.99 },
  { label: "10.0", min: 10.0, max: 10.0 },
];

function isSyntheticRow(row: LpTestRow): boolean {
  return Boolean(
    row.entry.syntheticCalibration ??
      row.entry.parserMetadata?.syntheticCalibration,
  );
}

function parserFamily(row: LpTestRow): string {
  if (isSyntheticRow(row)) return "synthetic-calibration";
  return row.parserType || "unknown";
}

export function buildDistributionHistogram(
  scores: number[],
): DistributionHistogramBucket[] {
  return HISTOGRAM_BUCKETS.map((b) => ({
    ...b,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));
}

export function deriveDatasetHealthNotes(input: {
  distribution: ScoreDistribution;
  reviews: CalibrationReviewRecord[];
  rows: LpTestRow[];
}): string[] {
  const notes: string[] = [];
  const scored = input.reviews.filter((r) => r.calibrationScore != null);
  const avg = input.distribution.average;
  const total = scored.length;

  const bandCount = (id: string) =>
    input.distribution.byBand.find((b) => b.bandId === id)?.count ?? 0;

  const balanced = bandCount("balanced");
  const mixed = bandCount("mixed");
  const compromise = bandCount("compromise");
  const exceptional = bandCount("exceptional");
  const lowerMid = balanced + mixed + compromise;

  if (avg != null && avg > 9.0 && lowerMid === 0) {
    notes.push("dataset likely top-heavy");
  }
  if (balanced + mixed < 5) {
    notes.push("commercial-average coverage insufficient");
  }
  if (total > 0 && lowerMid / total < 0.15) {
    notes.push("distribution incomplete — balanced/mixed/compromise under 15%");
  }

  const synthetic = input.rows.filter(isSyntheticRow).length;
  if (synthetic === 0 && total > 0) {
    notes.push("no synthetic calibration records — add mixed-quality fixtures");
  }

  if (total > 0 && exceptional / total > 0.4) {
    notes.push("excessive clustering in exceptional band (>40%)");
  }

  const tens = scored.filter((r) => r.calibrationScore === 10).length;
  if (tens >= 3) {
    notes.push("multiple 10.0 scores — verify ceiling calibration");
  }

  return notes;
}

export function deriveCalibrationSanityFlags(
  rows: LpTestRow[],
  reviews: CalibrationReviewRecord[],
): CalibrationSanityFlag[] {
  const reviewById = new Map(reviews.map((r) => [r.rowId, r]));
  const flags: CalibrationSanityFlag[] = [];
  const scores = reviews
    .filter((r) => r.calibrationScore != null)
    .map((r) => r.calibrationScore!);

  const push = (
    row: LpTestRow,
    flag: string,
  ) => {
    flags.push({
      rowId: row.id,
      reportNumber: row.reportNumber,
      lab: row.lab,
      flag,
    });
  };

  for (const row of rows) {
    const review = reviewById.get(row.id);
    const score = review?.calibrationScore;
    if (score == null) continue;

    if (score >= 9.95) {
      push(row, "suspicious 10.0 — verify rare ceiling");
    }
    if (score < 4.5 && review && review.strengths.length >= 2) {
      push(row, "suspicious low score vs highlighted strengths");
    }
    if (score < 5.0 && !isSyntheticRow(row) && row.parserType !== "generic") {
      push(row, "suspicious low score on parser-extracted record");
    }

    const table = parseFloat(row.entry.fieldsNormalized.tablePercent);
    const depth = parseFloat(row.entry.fieldsNormalized.depthPercent);
    if (!Number.isNaN(table) && !Number.isNaN(depth)) {
      if (table >= 62 || depth >= 64 || depth <= 57) {
        push(row, "proportion outlier (table/depth extreme)");
      }
    }

    if (
      review &&
      review.finishSpreadCalibration != null &&
      Math.abs(review.finishSpreadCalibration) >= 1.2
    ) {
      push(row, "finish influence unusually large");
    }
  }

  if (scores.length >= 8) {
    const rounded = scores.map((s) => Math.round(s * 10) / 10);
    const freq = new Map<number, number>();
    for (const s of rounded) {
      freq.set(s, (freq.get(s) ?? 0) + 1);
    }
    for (const [value, count] of freq) {
      if (count / scores.length >= 0.25) {
        flags.push({
          rowId: "",
          reportNumber: `(distribution)`,
          lab: "",
          flag: `score compression / clustering at ${value} (${count}/${scores.length})`,
        });
      }
    }
  }

  return flags;
}

export function buildDistributionCalibrationReport(input: {
  rows: LpTestRow[];
  reviews: CalibrationReviewRecord[];
  distribution: ScoreDistribution;
}): DistributionCalibrationReport {
  const { rows, reviews, distribution } = input;
  const scoredReviews = reviews.filter((r) => r.calibrationScore != null);
  const scores = scoredReviews.map((r) => r.calibrationScore!);

  const histogram = buildDistributionHistogram(scores);

  const labMap = new Map<string, number[]>();
  for (const r of scoredReviews) {
    const list = labMap.get(r.lab) ?? [];
    list.push(r.calibrationScore!);
    labMap.set(r.lab, list);
  }
  const averageByLab = [...labMap.entries()]
    .map(([lab, vals]) => ({
      lab,
      count: vals.length,
      average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
    }))
    .sort((a, b) => a.lab.localeCompare(b.lab));

  const parserMap = new Map<string, { scores: number[]; synthetic: number }>();
  for (const row of rows) {
    const review = reviews.find((r) => r.rowId === row.id);
    if (review?.calibrationScore == null) continue;
    const family = parserFamily(row);
    const slot = parserMap.get(family) ?? { scores: [], synthetic: 0 };
    slot.scores.push(review.calibrationScore);
    if (isSyntheticRow(row)) slot.synthetic += 1;
    parserMap.set(family, slot);
  }
  const averageByParserFamily = [...parserMap.entries()]
    .map(([parserFamily, slot]) => ({
      parserFamily,
      count: slot.scores.length,
      average:
        Math.round(
          (slot.scores.reduce((a, b) => a + b, 0) / slot.scores.length) * 100,
        ) / 100,
      syntheticCount: slot.synthetic,
    }))
    .sort((a, b) => a.parserFamily.localeCompare(b.parserFamily));

  const withSpread = scoredReviews.filter(
    (r) => r.finishSpreadCalibration != null,
  );
  const finishSpread: FinishSpreadSummary = {
    scoredCount: scoredReviews.length,
    withFinishSpread: withSpread.length,
    averageFinishSpread:
      withSpread.length > 0
        ? Math.round(
            (withSpread.reduce((a, r) => a + (r.finishSpreadCalibration ?? 0), 0) /
              withSpread.length) *
              100,
          ) / 100
        : null,
    averageProportionOnly:
      scoredReviews.length > 0
        ? Math.round(
            (scoredReviews.reduce(
              (a, r) => a + (r.proportionOnlyCalibrationScore ?? 0),
              0,
            ) /
              scoredReviews.length) *
              100,
          ) / 100
        : null,
    averageFull:
      distribution.average,
  };

  const tierMap = new Map<string, number>();
  for (const row of rows) {
    const tier = row.entry.calibrationTier ?? "(unspecified)";
    tierMap.set(tier, (tierMap.get(tier) ?? 0) + 1);
  }
  const tierCounts = [...tierMap.entries()]
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => a.tier.localeCompare(b.tier));

  const examplesByBand = CALIBRATION_BANDS.map((band) => {
    const inBand = scoredReviews
      .filter((r) => r.calibrationBandId === band.id)
      .sort((a, b) => (b.calibrationScore ?? 0) - (a.calibrationScore ?? 0))
      .slice(0, 3)
      .map((r) => ({
        reportNumber: r.reportNumber,
        lab: r.lab,
        score: r.calibrationScore!,
      }));
    return { bandId: band.id, label: band.label, examples: inBand };
  });

  return {
    histogram,
    distribution,
    datasetHealthNotes: deriveDatasetHealthNotes({ distribution, reviews, rows }),
    averageByLab,
    averageByParserFamily,
    finishSpread,
    syntheticCount: rows.filter(isSyntheticRow).length,
    parserExtractedCount: rows.filter((r) => !isSyntheticRow(r)).length,
    tierCounts,
    sanityFlags: deriveCalibrationSanityFlags(rows, reviews),
    examplesByBand,
  };
}

export type LpSortKey =
  | "score-desc"
  | "score-asc"
  | "spread-desc"
  | "spread-asc"
  | "crown-pavilion"
  | "missing-fields"
  | "finish-influence"
  | "report-number";

export function sortLpTestRows(
  rows: LpTestRow[],
  reviews: CalibrationReviewRecord[],
  sortKey: LpSortKey,
): LpTestRow[] {
  const reviewById = new Map(reviews.map((r) => [r.rowId, r]));
  const copy = [...rows];

  const num = (v: number | null | undefined, fallback: number) =>
    v ?? fallback;

  copy.sort((a, b) => {
    const ra = reviewById.get(a.id);
    const rb = reviewById.get(b.id);
    const fa = a.entry.fieldsNormalized;
    const fb = b.entry.fieldsNormalized;

    switch (sortKey) {
      case "score-desc":
        return num(rb?.calibrationScore, -1) - num(ra?.calibrationScore, -1);
      case "score-asc":
        return num(ra?.calibrationScore, 99) - num(rb?.calibrationScore, 99);
      case "spread-desc": {
        const spreadA = parseFloat(fa.depthPercent) - parseFloat(fa.tablePercent);
        const spreadB = parseFloat(fb.depthPercent) - parseFloat(fb.tablePercent);
        return (Number.isNaN(spreadB) ? 0 : spreadB) - (Number.isNaN(spreadA) ? 0 : spreadA);
      }
      case "spread-asc": {
        const spreadA = parseFloat(fa.depthPercent) - parseFloat(fa.tablePercent);
        const spreadB = parseFloat(fb.depthPercent) - parseFloat(fb.tablePercent);
        return (Number.isNaN(spreadA) ? 0 : spreadA) - (Number.isNaN(spreadB) ? 0 : spreadB);
      }
      case "crown-pavilion": {
        const ca = `${fa.crownAngle}/${fa.pavilionAngle}`;
        const cb = `${fb.crownAngle}/${fb.pavilionAngle}`;
        return ca.localeCompare(cb);
      }
      case "missing-fields":
        return b.missingFields.length - a.missingFields.length;
      case "finish-influence":
        return (
          Math.abs(rb?.finishSpreadCalibration ?? 0) -
          Math.abs(ra?.finishSpreadCalibration ?? 0)
        );
      case "report-number":
      default:
        return a.reportNumber.localeCompare(b.reportNumber);
    }
  });

  return copy;
}
