import type { ReadinessVerdict } from "./bulk-ingestion-readiness";
import {
  assessCalibrationInclusion,
} from "./calibration-inclusion-policy";
import { assessCalibrationSafety } from "./calibration-safety";
import { computeCorpusSafetySnapshot } from "./corpus-metrics";
import { isActiveCorpusRecord } from "./corpus-core";
import {
  buildCorpusUnsafeTriageReport,
  type CorpusUnsafeTriageReport,
  type UnsafeBlockerKey,
  type UnsafeRecordClassification,
} from "./corpus-unsafe-triage";
import { buildLpTestRows } from "./light-performance-test-rows";
import type { CalibrationWorkbookEntry } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export type LiveAnchorHealthSummary = {
  count: number;
  avgCompletenessPercent: number;
  minCompletenessPercent: number;
  allCalibrationEligible: boolean;
};

export type CalibrationSafetyDashboard = {
  generatedAt: string;
  totalRecords: number;
  syntheticRecords: number;
  nonSyntheticRecords: number;
  activeCorpusRecords: number;
  quarantinedRecords: number;
  excludedFromStatsRecords: number;
  calibrationSafePercent: number;
  calibrationSafeNonSyntheticPercent: number;
  calibrationSafeActiveCorpusPercent: number;
  calibrationStatisticsIncludedPercent: number;
  calibrationStatisticsIncludedNonSyntheticPercent: number;
  calibrationStatisticsIncludedActivePercent: number;
  manualOverridePercent: number;
  ocrOnlyPercent: number;
  excludedFromCalibrationPercent: number;
  reviewOnlyPercent: number;
  acceptableWarningPercent: number;
  fixableParserGapPercent: number;
  calibrationReadyPercent: number;
  parserFamilyBreakdown: Record<
    string,
    { total: number; safe: number; included: number; quarantined: number }
  >;
  unsafeBlockerBreakdown: Array<{ blocker: UnsafeBlockerKey; count: number }>;
  classificationBreakdown: Record<UnsafeRecordClassification, number>;
  topBlockersPreventingSeeding: string[];
  triage: CorpusUnsafeTriageReport;
  liveAnchorHealth?: LiveAnchorHealthSummary;
  verdicts: {
    controlledProductionSeeding: ReadinessVerdict;
  };
};

function pct(num: number, den: number): number {
  return den ? Math.round((num / den) * 100) : 0;
}

export function buildCalibrationSafetyDashboard(
  entries: CalibrationWorkbookEntry[],
  opts?: {
    liveAnchorCompleteness?: number[];
    liveAnchorCalibrationEligible?: boolean[];
  },
): CalibrationSafetyDashboard {
  const corpus = computeCorpusSafetySnapshot(entries);
  const synthetic = entries.filter((e) => e.syntheticCalibration);
  const nonSynthetic = entries.filter((e) => !e.syntheticCalibration);
  const activeCorpus = nonSynthetic.filter((e) => isActiveCorpusRecord(e));
  const assessments = entries.map((e) => ({
    entry: e,
    safety: assessCalibrationSafety(e),
    inclusion: assessCalibrationInclusion(e),
  }));
  const nonSynthAssess = assessments.filter((a) => !a.entry.syntheticCalibration);

  const safe = assessments.filter((a) => a.safety.calibrationEligible).length;
  const safeNonSynth = nonSynthAssess.filter(
    (a) => a.safety.calibrationEligible,
  ).length;
  const included = assessments.filter(
    (a) => a.inclusion.includedInCalibrationStatistics,
  ).length;
  const includedNonSynth = nonSynthAssess.filter(
    (a) => a.inclusion.includedInCalibrationStatistics,
  ).length;

  const manualOverrides = assessments.filter(
    (a) => a.safety.manualOverrideCount > 0,
  ).length;
  const ocrOnly = assessments.filter((a) =>
    a.safety.reviewFlags.includes("ocr_only_record"),
  ).length;

  const triage = buildCorpusUnsafeTriageReport(entries);
  const unsafeRows = triage.rows;

  const excluded = unsafeRows.filter(
    (r) => r.classification === "EXCLUDE_FROM_CALIBRATION",
  ).length;
  const reviewOnly = unsafeRows.filter(
    (r) => r.classification === "MANUAL_REVIEW_ONLY",
  ).length;
  const acceptableWarning = unsafeRows.filter(
    (r) => r.classification === "ACCEPTABLE_WARNING",
  ).length;
  const fixableGap = unsafeRows.filter(
    (r) => r.classification === "FIXABLE_PARSER_GAP",
  ).length;

  const lpRows = buildLpTestRows(entries);
  const calibrationReady = lpRows.filter(
    (r) => r.scoreReady && r.calibrationEligible,
  ).length;

  const parserFamilyBreakdown: CalibrationSafetyDashboard["parserFamilyBreakdown"] =
    {};
  for (const { entry, safety, inclusion } of assessments) {
    const fam = entry.parserType ?? "unknown";
    if (!parserFamilyBreakdown[fam]) {
      parserFamilyBreakdown[fam] = {
        total: 0,
        safe: 0,
        included: 0,
        quarantined: 0,
      };
    }
    parserFamilyBreakdown[fam].total++;
    if (entry.corpusStatus === "quarantined") {
      parserFamilyBreakdown[fam].quarantined++;
    }
    if (safety.calibrationEligible) parserFamilyBreakdown[fam].safe++;
    if (inclusion.includedInCalibrationStatistics) {
      parserFamilyBreakdown[fam].included++;
    }
  }

  const unsafeBlockerBreakdown = triage.byBlocker
    .slice(0, 15)
    .map((g) => ({ blocker: g.blocker, count: g.count }));

  const topBlockersPreventingSeeding: string[] = [];
  for (const g of triage.byBlocker.slice(0, 8)) {
    topBlockersPreventingSeeding.push(
      `${g.blocker}: ${g.count} records (${Object.entries(g.labs)
        .map(([lab, n]) => `${lab}=${n}`)
        .join(", ")})`,
    );
  }
  if (fixableGap > 0) {
    topBlockersPreventingSeeding.push(
      `FIXABLE_PARSER_GAP (classified): ${fixableGap} records — targeted parser/OCR pass candidate`,
    );
  }
  if (corpus.quarantinedRecords > 0) {
    topBlockersPreventingSeeding.push(
      `Quarantined junk/stale rows: ${corpus.quarantinedRecords} (excluded from active corpus)`,
    );
  }
  if (corpus.calibrationSafeActiveCorpusPercent < 50) {
    topBlockersPreventingSeeding.push(
      `Active-corpus calibration-safe below 50% (${corpus.calibrationSafeActiveCorpusPercent}%)`,
    );
  }

  const calibrationSafeNonSyntheticPercent =
    corpus.calibrationSafeNonSyntheticPercent;
  const calibrationSafeActiveCorpusPercent =
    corpus.calibrationSafeActiveCorpusPercent;

  let liveAnchorHealth: LiveAnchorHealthSummary | undefined;
  const liveCompleteness = opts?.liveAnchorCompleteness ?? [];
  if (liveCompleteness.length > 0) {
    const sum = liveCompleteness.reduce((a, b) => a + b, 0);
    liveAnchorHealth = {
      count: liveCompleteness.length,
      avgCompletenessPercent: Math.round((sum / liveCompleteness.length) * 10) / 10,
      minCompletenessPercent: Math.min(...liveCompleteness),
      allCalibrationEligible:
        opts?.liveAnchorCalibrationEligible?.every(Boolean) ?? false,
    };
  }

  let controlledProductionSeeding: ReadinessVerdict = "NOT_READY";
  if (
    calibrationSafeActiveCorpusPercent >= 50 &&
    corpus.statisticsIncludedActivePercent >= 45
  ) {
    controlledProductionSeeding = "PARTIAL_READY";
  }
  if (
    calibrationSafeActiveCorpusPercent >= 70 &&
    corpus.statisticsIncludedActivePercent >= 65 &&
    (liveAnchorHealth?.minCompletenessPercent ?? 0) >= 90 &&
    (liveAnchorHealth?.allCalibrationEligible ?? false)
  ) {
    controlledProductionSeeding = "READY";
  }

  return {
    generatedAt: new Date().toISOString(),
    totalRecords: entries.length,
    syntheticRecords: synthetic.length,
    nonSyntheticRecords: nonSynthetic.length,
    activeCorpusRecords: activeCorpus.length,
    quarantinedRecords: corpus.quarantinedRecords,
    excludedFromStatsRecords: corpus.excludedFromStats,
    calibrationSafePercent: pct(safe, entries.length),
    calibrationSafeNonSyntheticPercent,
    calibrationSafeActiveCorpusPercent,
    calibrationStatisticsIncludedPercent: pct(included, entries.length),
    calibrationStatisticsIncludedNonSyntheticPercent: pct(
      includedNonSynth,
      nonSynthetic.length,
    ),
    calibrationStatisticsIncludedActivePercent:
      corpus.statisticsIncludedActivePercent,
    manualOverridePercent: pct(manualOverrides, entries.length),
    ocrOnlyPercent: pct(ocrOnly, entries.length),
    excludedFromCalibrationPercent: pct(excluded, nonSynthetic.length),
    reviewOnlyPercent: pct(reviewOnly, nonSynthetic.length),
    acceptableWarningPercent: pct(acceptableWarning, nonSynthetic.length),
    fixableParserGapPercent: pct(fixableGap, nonSynthetic.length),
    calibrationReadyPercent: pct(calibrationReady, entries.length),
    parserFamilyBreakdown,
    unsafeBlockerBreakdown,
    classificationBreakdown: triage.byClassification,
    topBlockersPreventingSeeding,
    triage,
    liveAnchorHealth,
    verdicts: { controlledProductionSeeding },
  };
}

export function formatCalibrationSafetyDashboard(
  dash: CalibrationSafetyDashboard,
): string {
  const lines: string[] = [
    "=== Calibration safety dashboard ===",
    `Generated: ${dash.generatedAt}`,
    "",
    "Corpus:",
    `  total records: ${dash.totalRecords}`,
    `  synthetic: ${dash.syntheticRecords}`,
    `  non-synthetic: ${dash.nonSyntheticRecords}`,
    `  active calibration corpus: ${dash.activeCorpusRecords}`,
    `  quarantined: ${dash.quarantinedRecords}`,
    `  excluded from calibration stats: ${dash.excludedFromStatsRecords}`,
    "",
    "Safety & inclusion:",
    `  calibration-safe (all): ${dash.calibrationSafePercent}%`,
    `  calibration-safe (non-synthetic): ${dash.calibrationSafeNonSyntheticPercent}%`,
    `  calibration-safe (active corpus): ${dash.calibrationSafeActiveCorpusPercent}%`,
    `  calibration statistics included (active): ${dash.calibrationStatisticsIncludedActivePercent}%`,
    `  calibration statistics included (non-synthetic): ${dash.calibrationStatisticsIncludedNonSyntheticPercent}%`,
    `  calibration-ready (score + eligible): ${dash.calibrationReadyPercent}%`,
    "",
    "Unsafe triage (non-synthetic):",
    `  excluded from calibration: ${dash.excludedFromCalibrationPercent}%`,
    `  manual review only: ${dash.reviewOnlyPercent}%`,
    `  acceptable warning (unsafe flag only): ${dash.acceptableWarningPercent}%`,
    `  fixable parser gap: ${dash.fixableParserGapPercent}%`,
    "",
    `  manual override records: ${dash.manualOverridePercent}%`,
    `  OCR-only records: ${dash.ocrOnlyPercent}%`,
    "",
    "Parser family:",
  ];
  for (const [fam, stats] of Object.entries(dash.parserFamilyBreakdown).sort(
    (a, b) => b[1].total - a[1].total,
  )) {
    lines.push(
      `  ${fam}: n=${stats.total} safe=${stats.safe} included=${stats.included} quarantined=${stats.quarantined}`,
    );
  }
  if (dash.liveAnchorHealth) {
    lines.push(
      "",
      "Live anchor health:",
      `  anchors: ${dash.liveAnchorHealth.count}`,
      `  avg completeness: ${dash.liveAnchorHealth.avgCompletenessPercent}%`,
      `  min completeness: ${dash.liveAnchorHealth.minCompletenessPercent}%`,
      `  all calibration-eligible: ${dash.liveAnchorHealth.allCalibrationEligible}`,
    );
  }
  lines.push("", "Top blockers preventing production seeding:");
  for (const b of dash.topBlockersPreventingSeeding) {
    lines.push(`  - ${b}`);
  }
  lines.push(
    "",
    `Controlled production seeding: ${dash.verdicts.controlledProductionSeeding}`,
  );
  return lines.join("\n");
}

/** Entries that may contribute to LP reference / distribution calibration. */
export function listCalibrationStatisticsPopulation(
  entries: CalibrationWorkbookEntry[],
): CalibrationWorkbookEntry[] {
  return entries.filter(
    (e) => assessCalibrationInclusion(e).includedInCalibrationStatistics,
  );
}

export function countFieldPopulation(entries: CalibrationWorkbookEntry[]): number {
  let n = 0;
  for (const e of entries) {
    const f = e.fieldsNormalized ?? e.fields;
    for (const k of REPORT_FIELD_KEYS) {
      if (f[k]?.trim()) n++;
    }
  }
  return n;
}
