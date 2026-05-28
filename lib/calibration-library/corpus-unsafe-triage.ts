import { isActiveCorpusRecord } from "./corpus-core";
import {
  assessCalibrationInclusion,
  type CalibrationInclusionDenialReason,
} from "./calibration-inclusion-policy";
import {
  assessCalibrationSafety,
  type CalibrationSafetyFlagId,
} from "./calibration-safety";
import { isGiaFacsimileGirdlePhraseUnreadable } from "./gia-facsimile-calibration-policy";
import { buildLpTestRow } from "./light-performance-test-rows";
import type { CalibrationWorkbookEntry, ReportFieldKey } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

/** Primary triage bucket for unsafe non-synthetic records. */
export type UnsafeBlockerKey =
  | CalibrationSafetyFlagId
  | "missing_shape"
  | "missing_table"
  | "missing_depth"
  | "missing_crown"
  | "missing_pavilion"
  | "missing_lower_half"
  | "missing_star"
  | "missing_girdle"
  | "parser_warning"
  | "score_mismatch"
  | "runtime_warning"
  | "unresolved_lab_specific_issue"
  | "impossible_geometry"
  | "inclusion_denied";

export type UnsafeRecordClassification =
  | "FIXABLE_PARSER_GAP"
  | "ACCEPTABLE_WARNING"
  | "MANUAL_REVIEW_ONLY"
  | "EXCLUDE_FROM_CALIBRATION";

export type UnsafeRecordTriageRow = {
  id: string;
  reportNumber: string;
  lab: string;
  parserType: string;
  reportSource: string;
  textMethod: string;
  parserConfidence: string;
  completenessPercent: number;
  blockers: UnsafeBlockerKey[];
  primaryBlocker: UnsafeBlockerKey;
  classification: UnsafeRecordClassification;
  classificationReason: string;
  safetyFlags: CalibrationSafetyFlagId[];
  missingRequired: ReportFieldKey[];
  lowConfidenceFieldCount: number;
  manualOverrideCount: number;
  warningCount: number;
  inclusionDenialReasons: CalibrationInclusionDenialReason[];
};

export type UnsafeBlockerGroup = {
  blocker: UnsafeBlockerKey;
  count: number;
  labs: Record<string, number>;
  parserFamilies: Record<string, number>;
  reportSources: Record<string, number>;
  records: Array<{
    reportNumber: string;
    lab: string;
    parserType: string;
    classification: UnsafeRecordClassification;
  }>;
};

export type CorpusUnsafeTriageReport = {
  generatedAt: string;
  nonSyntheticTotal: number;
  unsafeCount: number;
  safeCount: number;
  byBlocker: UnsafeBlockerGroup[];
  byClassification: Record<UnsafeRecordClassification, number>;
  rows: UnsafeRecordTriageRow[];
};

const FIELD_BLOCKER_MAP: Partial<Record<ReportFieldKey, UnsafeBlockerKey>> = {
  shape: "missing_shape",
  tablePercent: "missing_table",
  depthPercent: "missing_depth",
  crownAngle: "missing_crown",
  pavilionAngle: "missing_pavilion",
  lowerHalfPercent: "missing_lower_half",
  starLengthPercent: "missing_star",
  girdle: "missing_girdle",
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function deriveFieldBlockers(
  entry: CalibrationWorkbookEntry,
  missingRequired: ReportFieldKey[],
): UnsafeBlockerKey[] {
  const fields = entry.fieldsNormalized ?? entry.fields;
  const blockers: UnsafeBlockerKey[] = [];
  for (const key of missingRequired) {
    const b = FIELD_BLOCKER_MAP[key];
    if (b) blockers.push(b);
  }
  for (const key of REPORT_FIELD_KEYS) {
    if (missingRequired.includes(key)) continue;
    if (!fields[key]?.trim()) {
      const b = FIELD_BLOCKER_MAP[key];
      if (b && !blockers.includes(b)) blockers.push(b);
    }
  }
  return blockers;
}

export function deriveUnsafeBlockers(entry: CalibrationWorkbookEntry): UnsafeBlockerKey[] {
  const safety = assessCalibrationSafety(entry);
  const lp = buildLpTestRow(entry);
  const inclusion = assessCalibrationInclusion(entry);
  const blockers = new Set<UnsafeBlockerKey>();

  for (const flag of safety.reviewFlags) {
    if (flag !== "not_calibration_eligible") blockers.add(flag);
  }
  for (const b of deriveFieldBlockers(entry, safety.missingRequired)) {
    blockers.add(b);
  }
  if (lp.hasParserWarning) blockers.add("parser_warning");
  if (lp.scoreMismatch) blockers.add("score_mismatch");
  if (lp.hasRuntimeWarning) blockers.add("runtime_warning");
  if (isGiaFacsimileGirdlePhraseUnreadable(entry)) {
    blockers.add("unresolved_lab_specific_issue");
  }
  if (inclusion.denialReasons.includes("impossible_geometry")) {
    blockers.add("impossible_geometry");
  }
  if (!inclusion.includedInCalibrationStatistics && safety.calibrationEligible) {
    blockers.add("inclusion_denied");
  }

  return [...blockers];
}

function pickPrimaryBlocker(blockers: UnsafeBlockerKey[]): UnsafeBlockerKey {
  const priority: UnsafeBlockerKey[] = [
    "manual_override_present",
    "incomplete_proportion_set",
    "missing_key_angles",
    "missing_pavilion",
    "missing_crown",
    "missing_table",
    "missing_depth",
    "missing_shape",
    "low_confidence_extraction",
    "impossible_geometry",
    "score_mismatch",
    "unresolved_lab_specific_issue",
    "parser_warning",
    "ocr_only_record",
    "migration_record",
    "missing_girdle",
    "missing_lower_half",
    "missing_star",
    "runtime_warning",
    "gia_girdle_phrase_unreadable",
    "inclusion_denied",
  ];
  for (const p of priority) {
    if (blockers.includes(p)) return p;
  }
  return blockers[0] ?? "not_calibration_eligible";
}

export function classifyUnsafeRecord(
  entry: CalibrationWorkbookEntry,
  blockers: UnsafeBlockerKey[],
): { classification: UnsafeRecordClassification; reason: string } {
  const safety = assessCalibrationSafety(entry);
  const fields = entry.fieldsNormalized ?? entry.fields;
  const lp = buildLpTestRow(entry);
  const populated = REPORT_FIELD_KEYS.filter((k) => fields[k]?.trim()).length;
  const completeness = Math.round(
    (populated / REPORT_FIELD_KEYS.length) * 100,
  );

  const coreMissing = [
    "missing_shape",
    "missing_table",
    "missing_depth",
    "missing_crown",
    "missing_pavilion",
    "incomplete_proportion_set",
    "missing_key_angles",
  ].some((b) => blockers.includes(b as UnsafeBlockerKey));

  if (
    blockers.includes("manual_override_present") ||
    blockers.includes("impossible_geometry") ||
    (coreMissing && completeness < 55)
  ) {
    return {
      classification: "EXCLUDE_FROM_CALIBRATION",
      reason: "Critical manual change, impossible geometry, or severely incomplete core proportions",
    };
  }

  if (
    blockers.length === 1 &&
    (blockers[0] === "missing_girdle" ||
      blockers[0] === "missing_lower_half" ||
      blockers[0] === "missing_star" ||
      blockers[0] === "ocr_only_record" ||
      blockers[0] === "parser_warning")
  ) {
    return {
      classification: "ACCEPTABLE_WARNING",
      reason: "Optional/context gap or informational OCR flag without core proportion loss",
    };
  }

  if (
    blockers.includes("low_confidence_extraction") &&
    safety.missingRequired.length === 0 &&
    !safety.reviewFlags.includes("incomplete_proportion_set")
  ) {
    const allCorePresent =
      fields.tablePercent.trim() &&
      fields.depthPercent.trim() &&
      fields.crownAngle.trim() &&
      fields.pavilionAngle.trim();
    if (allCorePresent) {
      return {
        classification: "FIXABLE_PARSER_GAP",
        reason:
          "Core proportions populated but OCR provenance classified low-confidence — threshold or assignment tuning",
      };
    }
  }

  const singleCoreGap =
    [
      "missing_pavilion",
      "missing_crown",
      "missing_table",
      "missing_depth",
    ].filter((b) => blockers.includes(b as UnsafeBlockerKey)).length === 1;

  if (singleCoreGap && completeness >= 72 && !lp.hasRuntimeWarning) {
    return {
      classification: "FIXABLE_PARSER_GAP",
      reason:
        "Single core proportion gap on otherwise strong record — likely OCR crop or assignment",
    };
  }

  if (
    blockers.includes("score_mismatch") ||
    blockers.includes("runtime_warning") ||
    (blockers.includes("parser_warning") && coreMissing)
  ) {
    return {
      classification: "MANUAL_REVIEW_ONLY",
      reason: "Score drift, runtime failure, or ambiguous parser warnings with core gaps",
    };
  }

  if (coreMissing) {
    return {
      classification: "EXCLUDE_FROM_CALIBRATION",
      reason: "Incomplete core proportion set for calibration statistics",
    };
  }

  if (blockers.includes("low_confidence_extraction")) {
    return {
      classification: "MANUAL_REVIEW_ONLY",
      reason: "Low-confidence extraction across multiple proportion fields",
    };
  }

  return {
    classification: "MANUAL_REVIEW_ONLY",
    reason: "Unresolved multi-factor safety blockers",
  };
}

export function buildUnsafeRecordTriageRow(
  entry: CalibrationWorkbookEntry,
): UnsafeRecordTriageRow | null {
  if (entry.syntheticCalibration) return null;
  if (!isActiveCorpusRecord(entry)) return null;
  const safety = assessCalibrationSafety(entry);
  if (safety.calibrationEligible && !entry.excludedFromCalibrationStats) {
    return null;
  }

  const blockers = deriveUnsafeBlockers(entry);
  const { classification, reason } = classifyUnsafeRecord(entry, blockers);
  const inclusion = assessCalibrationInclusion(entry);
  const lp = buildLpTestRow(entry);

  return {
    id: entry.id,
    reportNumber: entry.metadata.reportNumber,
    lab: entry.metadata.lab,
    parserType: entry.parserType ?? "unknown",
    reportSource: entry.metadata.reportSource,
    textMethod: entry.textMethod ?? "none",
    parserConfidence: entry.parserConfidence ?? "unknown",
    completenessPercent: safety.completenessPercent,
    blockers,
    primaryBlocker: pickPrimaryBlocker(blockers),
    classification,
    classificationReason: reason,
    safetyFlags: safety.reviewFlags,
    missingRequired: safety.missingRequired,
    lowConfidenceFieldCount: safety.lowConfidenceFieldCount,
    manualOverrideCount: safety.manualOverrideCount,
    warningCount: entry.warnings.length,
    inclusionDenialReasons: inclusion.denialReasons,
  };
}

export function buildCorpusUnsafeTriageReport(
  entries: CalibrationWorkbookEntry[],
): CorpusUnsafeTriageReport {
  const nonSynthetic = entries.filter((e) => !e.syntheticCalibration);
  const rows = nonSynthetic
    .map(buildUnsafeRecordTriageRow)
    .filter((r): r is UnsafeRecordTriageRow => r !== null);

  const byClassification: Record<UnsafeRecordClassification, number> = {
    FIXABLE_PARSER_GAP: 0,
    ACCEPTABLE_WARNING: 0,
    MANUAL_REVIEW_ONLY: 0,
    EXCLUDE_FROM_CALIBRATION: 0,
  };
  for (const r of rows) byClassification[r.classification]++;

  const groupMap = new Map<UnsafeBlockerKey, UnsafeBlockerGroup>();
  for (const row of rows) {
    for (const blocker of row.blockers) {
      let g = groupMap.get(blocker);
      if (!g) {
        g = {
          blocker,
          count: 0,
          labs: {},
          parserFamilies: {},
          reportSources: {},
          records: [],
        };
        groupMap.set(blocker, g);
      }
      g.count++;
      bump(g.labs, row.lab);
      bump(g.parserFamilies, row.parserType);
      bump(g.reportSources, row.reportSource);
      g.records.push({
        reportNumber: row.reportNumber,
        lab: row.lab,
        parserType: row.parserType,
        classification: row.classification,
      });
    }
  }

  const byBlocker = [...groupMap.values()].sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    nonSyntheticTotal: nonSynthetic.length,
    unsafeCount: rows.length,
    safeCount: nonSynthetic.length - rows.length,
    byBlocker,
    byClassification,
    rows,
  };
}

export function formatCorpusUnsafeTriageReport(
  report: CorpusUnsafeTriageReport,
): string {
  const lines: string[] = [
    "=== Corpus unsafe record triage (non-synthetic) ===",
    `Generated: ${report.generatedAt}`,
    `Non-synthetic: ${report.nonSyntheticTotal} · safe: ${report.safeCount} · unsafe: ${report.unsafeCount}`,
    "",
    "By classification:",
    `  FIXABLE_PARSER_GAP: ${report.byClassification.FIXABLE_PARSER_GAP}`,
    `  ACCEPTABLE_WARNING: ${report.byClassification.ACCEPTABLE_WARNING}`,
    `  MANUAL_REVIEW_ONLY: ${report.byClassification.MANUAL_REVIEW_ONLY}`,
    `  EXCLUDE_FROM_CALIBRATION: ${report.byClassification.EXCLUDE_FROM_CALIBRATION}`,
    "",
    "Top blockers (record may appear in multiple groups):",
  ];
  for (const g of report.byBlocker.slice(0, 20)) {
    lines.push(
      `  ${g.blocker}: ${g.count} (labs: ${Object.entries(g.labs).map(([k, v]) => `${k}=${v}`).join(", ") || "—"})`,
    );
    const sample = g.records.slice(0, 8);
    for (const r of sample) {
      lines.push(
        `    · ${r.lab} ${r.reportNumber} [${r.parserType}] → ${r.classification}`,
      );
    }
    if (g.records.length > 8) {
      lines.push(`    … +${g.records.length - 8} more`);
    }
  }
  return lines.join("\n");
}
