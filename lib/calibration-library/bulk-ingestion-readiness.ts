import { assessCalibrationSafety } from "./calibration-safety";
import {
  buildCalibrationSafetyDashboard,
  type CalibrationSafetyDashboard,
} from "./calibration-safety-dashboard";
import { computeCorpusSafetySnapshot } from "./corpus-metrics";
import {
  buildAllLiveAnchorAudits,
  compareFixtureAndLiveAnchorAudits,
  type LiveAnchorExtractionAudit,
} from "./anchor-live-audit";
import {
  buildLockedAnchorExtractionAudits,
  type AnchorExtractionAudit,
} from "./extraction-field-audit";
import type { ExtractionConfidenceClass } from "./extraction-provenance";
import { buildLpTestRows } from "./light-performance-test-rows";
import type { CalibrationWorkbookEntry } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export type ReadinessVerdict = "READY" | "PARTIAL_READY" | "NOT_READY";

export type BulkIngestionReadinessReport = {
  generatedAt: string;
  totalRecords: number;
  nonSyntheticRecords: number;
  syntheticRecords: number;
  fixtureAnchorAudits: AnchorExtractionAudit[];
  liveAnchorAudits: LiveAnchorExtractionAudit[];
  fixtureAnchorCompleteness: number;
  liveAnchorCompleteness: number;
  anchorParitySummary: {
    reportNumber: string;
    missingLiveOnly: string[];
    missingFixtureOnly: string[];
    confidenceDiffCount: number;
  }[];
  extractionCompletenessPercent: number;
  confidenceBreakdown: Record<ExtractionConfidenceClass, number>;
  calibrationSafePercent: number;
  calibrationSafeNonSyntheticPercent: number;
  calibrationSafeActiveCorpusPercent: number;
  activeCorpusRecords: number;
  quarantinedRecords: number;
  manualOverridePercent: number;
  ocrOnlyPercent: number;
  manualReviewRequiredPercent: number;
  perLab: {
    lab: string;
    count: number;
    avgCompleteness: number;
    calibrationSafePercent: number;
  }[];
  topFailurePatterns: string[];
  verdicts: {
    bulkMigration: ReadinessVerdict;
    publicLpBeta: ReadinessVerdict;
    calibrationDistributionScaling: ReadinessVerdict;
    controlledProductionSeeding: ReadinessVerdict;
  };
  safetyDashboard: CalibrationSafetyDashboard;
  notes: string[];
};

function confidenceBreakdownFromEntries(
  entries: CalibrationWorkbookEntry[],
): Record<ExtractionConfidenceClass, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    for (const key of REPORT_FIELD_KEYS) {
      const cls = entry.fieldProvenance?.[key]?.extractionClass ?? "UNAVAILABLE";
      counts[cls] = (counts[cls] ?? 0) + 1;
    }
  }
  return counts as Record<ExtractionConfidenceClass, number>;
}

function avgCompleteness(entries: CalibrationWorkbookEntry[]): number {
  if (!entries.length) return 0;
  const sum = entries.reduce((a, e) => {
    const populated = REPORT_FIELD_KEYS.filter((k) =>
      (e.fieldsNormalized ?? e.fields)[k]?.trim(),
    ).length;
    return a + (populated / REPORT_FIELD_KEYS.length) * 100;
  }, 0);
  return Math.round((sum / entries.length) * 10) / 10;
}

function avgAnchorCompleteness(audits: { completenessPercent: number }[]): number {
  if (!audits.length) return 0;
  return (
    Math.round(
      (audits.reduce((a, x) => a + x.completenessPercent, 0) / audits.length) *
        10,
    ) / 10
  );
}

export async function buildBulkIngestionReadinessReport(
  entries: CalibrationWorkbookEntry[],
  opts?: { includeLiveAnchorAudits?: boolean },
): Promise<BulkIngestionReadinessReport> {
  const fixtureAnchorAudits = buildLockedAnchorExtractionAudits();
  const liveAnchorAudits = opts?.includeLiveAnchorAudits
    ? await buildAllLiveAnchorAudits()
    : [];

  const anchorParitySummary = fixtureAnchorAudits.map((fixture) => {
    const live = liveAnchorAudits.find(
      (l) => l.reportNumber === fixture.reportNumber,
    );
    if (!live) {
      return {
        reportNumber: fixture.reportNumber,
        missingLiveOnly: [],
        missingFixtureOnly: [],
        confidenceDiffCount: 0,
      };
    }
    const parity = compareFixtureAndLiveAnchorAudits(fixture, live);
    return {
      reportNumber: fixture.reportNumber,
      missingLiveOnly: parity.missingLiveOnly,
      missingFixtureOnly: parity.missingFixtureOnly,
      confidenceDiffCount: parity.confidenceDifferences.length,
    };
  });

  const rows = buildLpTestRows(entries);
  const nonSynthetic = entries.filter((e) => !e.syntheticCalibration);
  const syntheticRecords = entries.length - nonSynthetic.length;
  const assessments = entries.map(assessCalibrationSafety);
  const nonSyntheticAssessments = nonSynthetic.map(assessCalibrationSafety);

  const calibrationSafe = assessments.filter((a) => a.calibrationEligible).length;
  const corpusSnapshot = computeCorpusSafetySnapshot(entries);
  const calibrationSafeActiveCorpusPercent =
    corpusSnapshot.calibrationSafeActiveCorpusPercent;
  const calibrationSafeNonSynthetic = nonSyntheticAssessments.filter(
    (a) => a.calibrationEligible,
  ).length;

  const manualReview = assessments.filter((a) =>
    a.reviewFlags.includes("manual_override_present"),
  ).length;
  const ocrOnly = assessments.filter((a) =>
    a.reviewFlags.includes("ocr_only_record"),
  ).length;

  const labMap = new Map<string, CalibrationWorkbookEntry[]>();
  for (const e of entries) {
    const list = labMap.get(e.metadata.lab) ?? [];
    list.push(e);
    labMap.set(e.metadata.lab, list);
  }

  const perLab = [...labMap.entries()].map(([lab, group]) => {
    const groupAssess = group.map(assessCalibrationSafety);
    const safe = groupAssess.filter((a) => a.calibrationEligible).length;
    return {
      lab,
      count: group.length,
      avgCompleteness: avgCompleteness(group),
      calibrationSafePercent: group.length
        ? Math.round((safe / group.length) * 100)
        : 0,
    };
  });

  const failurePatterns: string[] = [];
  const missingPavilion = rows.filter(
    (r) => !r.syntheticCalibration && !r.entry.fieldsNormalized.pavilionAngle.trim(),
  ).length;
  const missingGirdle = rows.filter(
    (r) => !r.syntheticCalibration && !r.entry.fieldsNormalized.girdle.trim(),
  ).length;
  const manualOverrides = assessments.filter((a) => a.manualOverrideCount > 0).length;

  if (missingPavilion > 0) {
    failurePatterns.push(`missing pavilion angle (${missingPavilion} non-synth)`);
  }
  if (missingGirdle > 0) {
    failurePatterns.push(`missing girdle (${missingGirdle} non-synth)`);
  }
  if (manualOverrides > 0) {
    failurePatterns.push(`manual overrides present (${manualOverrides})`);
  }
  if (ocrOnly > 0) failurePatterns.push(`OCR-only uploads (${ocrOnly})`);
  if (syntheticRecords > 0) {
    failurePatterns.push(`synthetic calibration fixtures (${syntheticRecords})`);
  }

  for (const p of anchorParitySummary) {
    if (p.missingLiveOnly.length) {
      failurePatterns.push(
        `live PDF missing vs fixture [${p.reportNumber}]: ${p.missingLiveOnly.join(", ")}`,
      );
    }
  }

  const extractionCompletenessPercent = avgCompleteness(entries);
  const calibrationSafePercent = entries.length
    ? Math.round((calibrationSafe / entries.length) * 100)
    : 0;
  const calibrationSafeNonSyntheticPercent = nonSynthetic.length
    ? Math.round((calibrationSafeNonSynthetic / nonSynthetic.length) * 100)
    : 0;
  const manualOverridePercent = entries.length
    ? Math.round((manualOverrides / entries.length) * 100)
    : 0;
  const ocrOnlyPercent = entries.length
    ? Math.round((ocrOnly / entries.length) * 100)
    : 0;
  const manualReviewRequiredPercent = entries.length
    ? Math.round((manualReview / entries.length) * 100)
    : 0;

  const fixtureAnchorCompleteness = avgAnchorCompleteness(fixtureAnchorAudits);
  const liveAnchorCompleteness = avgAnchorCompleteness(liveAnchorAudits);
  const anchorMinLive = liveAnchorAudits.length
    ? Math.min(...liveAnchorAudits.map((a) => a.completenessPercent))
    : fixtureAnchorCompleteness;

  const notes: string[] = [
    "Scoring remains lab-neutral — extraction integrity pass does not alter weights.",
    "User-entered values are tracked separately; manual proportion overrides block calibration eligibility.",
  ];

  if (liveAnchorAudits.length && liveAnchorCompleteness < fixtureAnchorCompleteness) {
    notes.push(
      `Live PDF anchors (${liveAnchorCompleteness}%) trail fixture anchors (${fixtureAnchorCompleteness}%) — fixtures may be optimistic.`,
    );
  }

  let bulkMigration: ReadinessVerdict = "NOT_READY";
  if (
    anchorMinLive >= 90 &&
    calibrationSafeNonSyntheticPercent >= 50 &&
    !liveAnchorAudits.some((a) => !a.pdfFound || a.timedOut)
  ) {
    bulkMigration = "PARTIAL_READY";
  }
  if (
    anchorMinLive >= 95 &&
    calibrationSafeNonSyntheticPercent >= 70 &&
    manualOverridePercent <= 5
  ) {
    bulkMigration = "READY";
  }

  let publicLpBeta: ReadinessVerdict = "NOT_READY";
  if (anchorMinLive >= 85 && missingPavilion <= 2) {
    publicLpBeta = "PARTIAL_READY";
  }
  if (
    anchorMinLive >= 93 &&
    calibrationSafeActiveCorpusPercent >= 40
  ) {
    publicLpBeta = "READY";
  }

  let calibrationDistributionScaling: ReadinessVerdict = "NOT_READY";
  if (
    calibrationSafeActiveCorpusPercent >= 50 &&
    manualReviewRequiredPercent <= 15
  ) {
    calibrationDistributionScaling = "PARTIAL_READY";
  }
  if (
    calibrationSafeActiveCorpusPercent >= 65 &&
    manualReviewRequiredPercent <= 10 &&
    anchorMinLive >= 90
  ) {
    calibrationDistributionScaling = "READY";
  }

  const safetyDashboard = buildCalibrationSafetyDashboard(entries, {
    liveAnchorCompleteness: liveAnchorAudits.map((a) => a.completenessPercent),
    liveAnchorCalibrationEligible: liveAnchorAudits.map(
      (a) => a.calibrationEligible,
    ),
  });

  return {
    generatedAt: new Date().toISOString(),
    totalRecords: entries.length,
    nonSyntheticRecords: nonSynthetic.length,
    syntheticRecords,
    fixtureAnchorAudits,
    liveAnchorAudits,
    fixtureAnchorCompleteness,
    liveAnchorCompleteness,
    anchorParitySummary,
    extractionCompletenessPercent,
    confidenceBreakdown: confidenceBreakdownFromEntries(entries),
    calibrationSafePercent,
    calibrationSafeNonSyntheticPercent,
    calibrationSafeActiveCorpusPercent,
    activeCorpusRecords: corpusSnapshot.activeCorpusRecords,
    quarantinedRecords: corpusSnapshot.quarantinedRecords,
    manualOverridePercent,
    ocrOnlyPercent,
    manualReviewRequiredPercent,
    perLab,
    topFailurePatterns: failurePatterns,
    verdicts: {
      bulkMigration,
      publicLpBeta,
      calibrationDistributionScaling,
      controlledProductionSeeding:
        safetyDashboard.verdicts.controlledProductionSeeding,
    },
    safetyDashboard,
    notes,
  };
}

export function formatBulkIngestionReadinessReport(
  report: BulkIngestionReadinessReport,
): string {
  const lines: string[] = [
    "=== Bulk ingestion readiness ===",
    `Generated: ${report.generatedAt}`,
    `Records: ${report.totalRecords} (non-synthetic: ${report.nonSyntheticRecords}, synthetic: ${report.syntheticRecords})`,
    `Dataset extraction completeness: ${report.extractionCompletenessPercent}%`,
    `Calibration-safe (all): ${report.calibrationSafePercent}%`,
    `Calibration-safe (non-synthetic): ${report.calibrationSafeNonSyntheticPercent}%`,
    `Calibration-safe (active corpus): ${report.calibrationSafeActiveCorpusPercent}%`,
    `Active corpus: ${report.activeCorpusRecords} · Quarantined: ${report.quarantinedRecords}`,
    `Manual overrides: ${report.manualOverridePercent}%`,
    `OCR-only: ${report.ocrOnlyPercent}%`,
    `Fixture anchor completeness: ${report.fixtureAnchorCompleteness}%`,
    `Live PDF anchor completeness: ${report.liveAnchorCompleteness || "n/a"}%`,
    "",
    "Verdicts:",
    `  bulk migration: ${report.verdicts.bulkMigration}`,
    `  public LP beta: ${report.verdicts.publicLpBeta}`,
    `  calibration distribution scaling: ${report.verdicts.calibrationDistributionScaling}`,
    `  controlled production seeding: ${report.verdicts.controlledProductionSeeding}`,
    "",
    "Top blockers preventing production seeding:",
  ];
  for (const b of report.safetyDashboard.topBlockersPreventingSeeding.slice(0, 10)) {
    lines.push(`  - ${b}`);
  }
  lines.push(
    "",
    `Unsafe triage: excluded=${report.safetyDashboard.classificationBreakdown.EXCLUDE_FROM_CALIBRATION} review-only=${report.safetyDashboard.classificationBreakdown.MANUAL_REVIEW_ONLY} fixable-gap=${report.safetyDashboard.classificationBreakdown.FIXABLE_PARSER_GAP}`,
    "",
    "Anchor fixture vs live parity:",
  );
  const parityLines: string[] = [];
  for (const p of report.anchorParitySummary) {
    parityLines.push(
      `  ${p.reportNumber}: live-missing=[${p.missingLiveOnly.join(", ") || "—"}] fixture-only=[${p.missingFixtureOnly.join(", ") || "—"}] confDiffs=${p.confidenceDiffCount}`,
    );
  }
  lines.push(...parityLines);
  lines.push("", "Per lab:");
  for (const lab of report.perLab) {
    lines.push(
      `  ${lab.lab}: n=${lab.count} completeness=${lab.avgCompleteness}% safe=${lab.calibrationSafePercent}%`,
    );
  }
  if (report.topFailurePatterns.length) {
    lines.push("", "Top failure patterns:");
    for (const p of report.topFailurePatterns) lines.push(`  - ${p}`);
  }
  if (report.notes.length) {
    lines.push("", "Notes:");
    for (const n of report.notes) lines.push(`  - ${n}`);
  }
  return lines.join("\n");
}
