import { isActiveCorpusRecord } from "./corpus-core";
import { computeCorpusSafetySnapshot } from "./corpus-metrics";
import {
  buildDistributionCalibrationReport,
  buildDistributionHistogram,
  deriveCalibrationSanityFlags,
  deriveDatasetHealthNotes,
} from "./distribution-calibration";
import { buildLpTestRows } from "./light-performance-test-rows";
import {
  buildCalibrationReviewRecord,
  buildScoreDistribution,
} from "./light-performance-calibration-review";
import type { CalibrationWorkbookEntry } from "./types";

export type ActiveCorpusDistributionStressReport = {
  generatedAt: string;
  activeCorpusCount: number;
  calibrationSafeActive: number;
  statisticsIncludedActive: number;
  scoredActiveCount: number;
  histogram: ReturnType<typeof buildDistributionHistogram>;
  bandSpread: { bandId: string; label: string; count: number }[];
  averageByLab: { lab: string; count: number; average: number | null }[];
  averageByParserFamily: {
    parserFamily: string;
    count: number;
    average: number | null;
  }[];
  ocrOnlyVsTextLayer: {
    ocrOnly: { count: number; average: number | null };
    textLayer: { count: number; average: number | null };
    mixed: { count: number; average: number | null };
  };
  confidenceDistribution: Record<string, number>;
  datasetHealthNotes: string[];
  sanityFlags: ReturnType<typeof deriveCalibrationSanityFlags>;
  clusteringFlags: string[];
  parserSkewFlags: string[];
  observationalOnly: true;
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function buildActiveCorpusDistributionStressReport(
  entries: CalibrationWorkbookEntry[],
): ActiveCorpusDistributionStressReport {
  const active = entries.filter(
    (e) => !e.syntheticCalibration && isActiveCorpusRecord(e),
  );
  const rows = buildLpTestRows(active);
  const reviews = rows.map(buildCalibrationReviewRecord);
  const distribution = buildScoreDistribution(reviews);
  const distReport = buildDistributionCalibrationReport({
    rows,
    reviews,
    distribution,
  });

  const scoredRows = rows.filter((r) => {
    const review = reviews.find((rev) => rev.rowId === r.id);
    return review?.calibrationScore != null;
  });

  const ocrScores: number[] = [];
  const textScores: number[] = [];
  const mixedScores: number[] = [];
  for (const row of scoredRows) {
    const review = reviews.find((r) => r.rowId === row.id)!;
    const score = review.calibrationScore!;
    const tm = row.entry.textMethod ?? "none";
    if (tm === "ocr") ocrScores.push(score);
    else if (tm === "pdf-text") textScores.push(score);
    else mixedScores.push(score);
  }

  const confidenceDistribution: Record<string, number> = {};
  for (const row of active) {
    for (const c of Object.values(row.confidence)) {
      confidenceDistribution[c] = (confidenceDistribution[c] ?? 0) + 1;
    }
  }

  const clusteringFlags: string[] = [];
  const tens = reviews.filter((r) => r.calibrationScore === 10).length;
  if (tens >= 2) {
    clusteringFlags.push(
      `suspicious 10.0 cluster: ${tens} scores at ceiling in active corpus`,
    );
  }
  const hist = buildDistributionHistogram(
    reviews.filter((r) => r.calibrationScore != null).map((r) => r.calibrationScore!),
  );
  const topBucket = [...hist].sort((a, b) => b.count - a.count)[0];
  if (topBucket && topBucket.count >= 4 && scoredRows.length >= 8) {
    clusteringFlags.push(
      `band clustering: ${topBucket.count}/${scoredRows.length} in bucket ${topBucket.label}`,
    );
  }

  const parserSkewFlags: string[] = [];
  for (const p of distReport.averageByParserFamily) {
    if (p.count >= 3 && p.average != null && p.average >= 9.5) {
      parserSkewFlags.push(
        `parser skew: ${p.parserFamily} average ${p.average} (n=${p.count})`,
      );
    }
  }
  const gcalOnly =
    distReport.averageByParserFamily.filter((p) => p.parserFamily.startsWith("gcal")).length >=
      1 && active.length < 25;
  if (gcalOnly && active.length >= 10) {
    const nonGcal = distReport.averageByParserFamily.filter(
      (p) => !p.parserFamily.startsWith("gcal") && p.count > 0,
    );
    if (nonGcal.length <= 2) {
      parserSkewFlags.push("lab/parser overrepresentation — GCAL-heavy active set");
    }
  }

  const snapshot = computeCorpusSafetySnapshot(entries);

  return {
    generatedAt: new Date().toISOString(),
    activeCorpusCount: active.length,
    calibrationSafeActive: snapshot.calibrationSafeActiveCorpus,
    statisticsIncludedActive: snapshot.statisticsIncludedActive,
    scoredActiveCount: distribution.scoredEligibleCount,
    histogram: distReport.histogram,
    bandSpread: distribution.byBand.map((b) => ({
      bandId: b.bandId,
      label: b.label,
      count: b.count,
    })),
    averageByLab: distReport.averageByLab,
    averageByParserFamily: distReport.averageByParserFamily,
    ocrOnlyVsTextLayer: {
      ocrOnly: { count: ocrScores.length, average: avg(ocrScores) },
      textLayer: { count: textScores.length, average: avg(textScores) },
      mixed: { count: mixedScores.length, average: avg(mixedScores) },
    },
    confidenceDistribution,
    datasetHealthNotes: deriveDatasetHealthNotes({ distribution, reviews, rows }),
    sanityFlags: deriveCalibrationSanityFlags(rows, reviews),
    clusteringFlags,
    parserSkewFlags,
    observationalOnly: true,
  };
}

export function formatActiveCorpusDistributionStressReport(
  report: ActiveCorpusDistributionStressReport,
): string {
  const lines: string[] = [
    "=== Active corpus distribution stress (observational) ===",
    `Generated: ${report.generatedAt}`,
    `Active records: ${report.activeCorpusCount}`,
    `Calibration-safe active: ${report.calibrationSafeActive}`,
    `Statistics-included active: ${report.statisticsIncludedActive}`,
    `Scored active: ${report.scoredActiveCount}`,
    "",
    "Band spread:",
  ];
  for (const b of report.bandSpread) {
    lines.push(`  ${b.label}: ${b.count}`);
  }
  lines.push("", "Parser family averages:");
  for (const p of report.averageByParserFamily) {
    lines.push(`  ${p.parserFamily}: n=${p.count} avg=${p.average ?? "—"}`);
  }
  lines.push("", "Lab averages:");
  for (const l of report.averageByLab) {
    lines.push(`  ${l.lab}: n=${l.count} avg=${l.average ?? "—"}`);
  }
  lines.push(
    "",
    `OCR-only: n=${report.ocrOnlyVsTextLayer.ocrOnly.count} avg=${report.ocrOnlyVsTextLayer.ocrOnly.average ?? "—"}`,
  );
  lines.push(
    `PDF text-layer: n=${report.ocrOnlyVsTextLayer.textLayer.count} avg=${report.ocrOnlyVsTextLayer.textLayer.average ?? "—"}`,
  );
  lines.push("", "Confidence field counts:", JSON.stringify(report.confidenceDistribution));
  if (report.clusteringFlags.length) {
    lines.push("", "Clustering flags:");
    for (const f of report.clusteringFlags) lines.push(`  · ${f}`);
  }
  if (report.parserSkewFlags.length) {
    lines.push("", "Parser skew flags:");
    for (const f of report.parserSkewFlags) lines.push(`  · ${f}`);
  }
  if (report.datasetHealthNotes.length) {
    lines.push("", "Dataset health notes:");
    for (const n of report.datasetHealthNotes) lines.push(`  · ${n}`);
  }
  if (report.sanityFlags.length) {
    lines.push("", "Sanity flags (sample):");
    for (const s of report.sanityFlags.slice(0, 12)) {
      lines.push(`  · ${s.reportNumber || "—"} ${s.flag}`);
    }
  }
  return lines.join("\n");
}
