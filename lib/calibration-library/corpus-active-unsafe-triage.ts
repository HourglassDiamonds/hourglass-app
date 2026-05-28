import {
  isActiveCorpusRecord,
  isCalibrationSeedOrTestArtifact,
  isRealUploadedCalibrationRecord,
  isRuntimeDupTestReport,
} from "./corpus-core";
import {
  assessCalibrationInclusion,
  type CalibrationInclusionDenialReason,
} from "./calibration-inclusion-policy";
import {
  assessCalibrationSafety,
  type CalibrationSafetyFlagId,
} from "./calibration-safety";
import {
  buildUnsafeRecordTriageRow,
  classifyUnsafeRecord,
  deriveUnsafeBlockers,
  type UnsafeBlockerKey,
  type UnsafeRecordClassification,
} from "./corpus-unsafe-triage";
import type { FieldProvenanceMap } from "./extraction-provenance";
import type { CalibrationWorkbookEntry, ReportFieldKey } from "./types";

export type ActiveUnsafeTriageBucket =
  | "missing_pavilion"
  | "missing_crown"
  | "missing_lower_half"
  | "missing_girdle"
  | "ocr_only"
  | "manual_override"
  | "low_confidence"
  | "other_blocker";

export type RecoveryCandidateClassification =
  | "HIGH_RECOVERY_PROBABILITY"
  | "LIMITED_VALUE_RECOVERY"
  | "MANUAL_REVIEW_ONLY"
  | "PERMANENT_EXCLUDE";

export type ActiveUnsafeTriageRow = {
  id: string;
  reportNumber: string;
  lab: string;
  parserFamily: string;
  reportSource: string;
  textMethod: string;
  parserConfidence: string;
  completenessPercent: number;
  isRealUpload: boolean;
  isSeedOrTestArtifact: boolean;
  triageBuckets: ActiveUnsafeTriageBucket[];
  blockers: UnsafeBlockerKey[];
  primaryBlocker: UnsafeBlockerKey;
  legacyClassification: UnsafeRecordClassification;
  recoveryClassification: RecoveryCandidateClassification;
  recoveryReason: string;
  safetyFlags: CalibrationSafetyFlagId[];
  missingRequired: ReportFieldKey[];
  inclusionDenialReasons: CalibrationInclusionDenialReason[];
  preventingCalibrationSafe: string[];
  fieldProvenanceSummary: string;
  sourceFilename?: string;
};

export type ActiveUnsafeTriageReport = {
  generatedAt: string;
  activeUnsafeCount: number;
  realUploadUnsafeCount: number;
  highRecoveryCount: number;
  byBucket: Record<ActiveUnsafeTriageBucket, number>;
  byRecoveryClassification: Record<RecoveryCandidateClassification, number>;
  rows: ActiveUnsafeTriageRow[];
};

function summarizeProvenance(fp?: FieldProvenanceMap): string {
  if (!fp) return "none";
  const classes = new Set<string>();
  for (const p of Object.values(fp)) {
    if (p?.extractionClass) classes.add(p.extractionClass);
  }
  return classes.size ? [...classes].join(", ") : "none";
}

function deriveTriageBuckets(
  entry: CalibrationWorkbookEntry,
  blockers: UnsafeBlockerKey[],
): ActiveUnsafeTriageBucket[] {
  const buckets = new Set<ActiveUnsafeTriageBucket>();
  if (blockers.includes("missing_pavilion")) buckets.add("missing_pavilion");
  if (blockers.includes("missing_crown")) buckets.add("missing_crown");
  if (blockers.includes("missing_lower_half")) buckets.add("missing_lower_half");
  if (blockers.includes("missing_girdle")) buckets.add("missing_girdle");
  if (blockers.includes("ocr_only_record")) buckets.add("ocr_only");
  if (blockers.includes("manual_override_present")) buckets.add("manual_override");
  if (blockers.includes("low_confidence_extraction")) buckets.add("low_confidence");
  if (buckets.size === 0) buckets.add("other_blocker");
  return [...buckets];
}

function listPreventingSafe(
  entry: CalibrationWorkbookEntry,
  blockers: UnsafeBlockerKey[],
): string[] {
  const safety = assessCalibrationSafety(entry);
  const inclusion = assessCalibrationInclusion(entry);
  const reasons: string[] = [];
  if (!safety.calibrationEligible) {
    reasons.push(...safety.reasons);
    for (const f of safety.reviewFlags) {
      if (f !== "not_calibration_eligible") reasons.push(f);
    }
  }
  for (const d of inclusion.denialReasons) {
    if (!reasons.includes(d)) reasons.push(d);
  }
  for (const b of blockers) {
    if (!reasons.includes(b)) reasons.push(b);
  }
  return [...new Set(reasons)];
}

export function classifyRecoveryCandidate(
  entry: CalibrationWorkbookEntry,
  blockers: UnsafeBlockerKey[],
  legacy: UnsafeRecordClassification,
): { classification: RecoveryCandidateClassification; reason: string } {
  if (isRuntimeDupTestReport(entry.metadata.reportNumber)) {
    return {
      classification: "PERMANENT_EXCLUDE",
      reason: "Runtime duplicate-test artifact",
    };
  }

  const rn = entry.metadata.reportNumber.trim();
  const anchorIgiPdf =
    /^LG773657228$/i.test(rn) &&
    entry.metadata.reportSource === "pdf-upload" &&
    Boolean(entry.sourceFilename?.trim());

  if (anchorIgiPdf && blockers.includes("missing_shape")) {
      return {
        classification: "HIGH_RECOVERY_PROBABILITY",
        reason:
          "Anchor PDF upload missing shape only — targeted pipeline/OCR rerun may recover without fabrication",
      };
  }

  if (isCalibrationSeedOrTestArtifact(entry)) {
    return {
      classification: "PERMANENT_EXCLUDE",
      reason:
        "Seed scenario, OCR fixture variant, or runtime test artifact — not a production upload target",
    };
  }

  if (legacy === "EXCLUDE_FROM_CALIBRATION") {
    const coreMissing = [
      "missing_shape",
      "incomplete_proportion_set",
      "missing_key_angles",
      "impossible_geometry",
    ].some((b) => blockers.includes(b as UnsafeBlockerKey));

    if (
      coreMissing &&
      isRealUploadedCalibrationRecord(entry) &&
      entry.sourceFilename?.trim()
    ) {
      const onlyShape =
        blockers.includes("missing_shape") &&
        !blockers.includes("incomplete_proportion_set") &&
        !blockers.includes("missing_key_angles");
      if (onlyShape && entry.metadata.reportSource === "pdf-upload") {
        return {
          classification: "HIGH_RECOVERY_PROBABILITY",
          reason:
            "Real PDF upload with core proportions present — shape may recover via targeted OCR / diagram rerun",
        };
      }
    }

    if (isRealUploadedCalibrationRecord(entry) && legacy === "EXCLUDE_FROM_CALIBRATION") {
      return {
        classification: "PERMANENT_EXCLUDE",
        reason:
          "Excluded: incomplete core, impossible geometry, or insufficient evidence — no safe inference path",
      };
    }
  }

  if (legacy === "FIXABLE_PARSER_GAP") {
    return {
      classification: "HIGH_RECOVERY_PROBABILITY",
      reason:
        "Single-field or provenance gap on otherwise strong record — targeted OCR / provenance refresh candidate",
    };
  }

  if (legacy === "ACCEPTABLE_WARNING") {
    return {
      classification: "LIMITED_VALUE_RECOVERY",
      reason:
        "Optional-field or informational gap — partial improvement possible, unlikely to reach calibration-safe",
    };
  }

  if (legacy === "MANUAL_REVIEW_ONLY") {
    return {
      classification: "MANUAL_REVIEW_ONLY",
      reason:
        "Ambiguous parser warnings, score drift, or multi-field low confidence — requires human confirmation",
    };
  }

  return {
    classification: "PERMANENT_EXCLUDE",
    reason: "No automated recovery path under current standards",
  };
}

export function buildActiveUnsafeTriageRow(
  entry: CalibrationWorkbookEntry,
): ActiveUnsafeTriageRow | null {
  if (entry.syntheticCalibration) return null;
  if (!isActiveCorpusRecord(entry)) return null;
  const safety = assessCalibrationSafety(entry);
  if (safety.calibrationEligible) return null;

  const base = buildUnsafeRecordTriageRow(entry);
  if (!base) return null;

  const blockers = deriveUnsafeBlockers(entry);
  const { classification: recoveryClassification, reason: recoveryReason } =
    classifyRecoveryCandidate(entry, blockers, base.classification);

  return {
    id: entry.id,
    reportNumber: base.reportNumber,
    lab: base.lab,
    parserFamily: base.parserType,
    reportSource: base.reportSource,
    textMethod: base.textMethod,
    parserConfidence: base.parserConfidence,
    completenessPercent: base.completenessPercent,
    isRealUpload: isRealUploadedCalibrationRecord(entry),
    isSeedOrTestArtifact: isCalibrationSeedOrTestArtifact(entry),
    triageBuckets: deriveTriageBuckets(entry, blockers),
    blockers,
    primaryBlocker: base.primaryBlocker,
    legacyClassification: base.classification,
    recoveryClassification,
    recoveryReason,
    safetyFlags: base.safetyFlags,
    missingRequired: base.missingRequired,
    inclusionDenialReasons: base.inclusionDenialReasons,
    preventingCalibrationSafe: listPreventingSafe(entry, blockers),
    fieldProvenanceSummary: summarizeProvenance(entry.fieldProvenance),
    sourceFilename: entry.sourceFilename,
  };
}

export function buildActiveUnsafeTriageReport(
  entries: CalibrationWorkbookEntry[],
): ActiveUnsafeTriageReport {
  const rows = entries
    .map(buildActiveUnsafeTriageRow)
    .filter((r): r is ActiveUnsafeTriageRow => r !== null);

  const byBucket = {
    missing_pavilion: 0,
    missing_crown: 0,
    missing_lower_half: 0,
    missing_girdle: 0,
    ocr_only: 0,
    manual_override: 0,
    low_confidence: 0,
    other_blocker: 0,
  } satisfies Record<ActiveUnsafeTriageBucket, number>;

  const byRecoveryClassification = {
    HIGH_RECOVERY_PROBABILITY: 0,
    LIMITED_VALUE_RECOVERY: 0,
    MANUAL_REVIEW_ONLY: 0,
    PERMANENT_EXCLUDE: 0,
  } satisfies Record<RecoveryCandidateClassification, number>;

  for (const row of rows) {
    byRecoveryClassification[row.recoveryClassification]++;
    for (const b of row.triageBuckets) byBucket[b]++;
  }

  return {
    generatedAt: new Date().toISOString(),
    activeUnsafeCount: rows.length,
    realUploadUnsafeCount: rows.filter((r) => r.isRealUpload && !r.isSeedOrTestArtifact)
      .length,
    highRecoveryCount: rows.filter(
      (r) => r.recoveryClassification === "HIGH_RECOVERY_PROBABILITY",
    ).length,
    byBucket,
    byRecoveryClassification,
    rows,
  };
}

export function formatActiveUnsafeTriageReport(
  report: ActiveUnsafeTriageReport,
): string {
  const lines: string[] = [
    "=== Active corpus — unsafe record triage ===",
    `Generated: ${report.generatedAt}`,
    `Active unsafe: ${report.activeUnsafeCount}`,
    `Real-upload unsafe (excl. seed/test): ${report.realUploadUnsafeCount}`,
    `HIGH_RECOVERY_PROBABILITY: ${report.highRecoveryCount}`,
    "",
    "By triage bucket (record may appear in multiple):",
  ];
  for (const [k, v] of Object.entries(report.byBucket)) {
    if (v > 0) lines.push(`  ${k}: ${v}`);
  }
  lines.push("", "By recovery classification:");
  for (const [k, v] of Object.entries(report.byRecoveryClassification)) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push("", "Rows:");
  for (const r of report.rows) {
    lines.push(
      `  ${r.id} | ${r.lab} ${r.reportNumber} | ${r.parserFamily} | ${r.textMethod} | ${r.recoveryClassification}`,
    );
    lines.push(
      `    buckets: ${r.triageBuckets.join(", ")} | blockers: ${r.blockers.join(", ")}`,
    );
    lines.push(`    preventing safe: ${r.preventingCalibrationSafe.join("; ")}`);
    lines.push(`    provenance: ${r.fieldProvenanceSummary}`);
    if (r.sourceFilename) lines.push(`    source: ${r.sourceFilename}`);
    lines.push(`    → ${r.recoveryReason}`);
  }
  return lines.join("\n");
}
