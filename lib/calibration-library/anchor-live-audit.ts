import { readFileSync } from "fs";
import {
  ANCHOR_OPTIONAL_ABSENT,
  buildAnchorExtractionAudit,
  buildAuditRows,
  type AnchorExtractionAudit,
  type FieldExtractionAuditRow,
} from "./extraction-field-audit";
import { ANCHOR_FIELD_TARGETS } from "./anchor-field-targets";
import { resolveAllAnchorPdfPaths, type AnchorPdfSpec } from "./anchor-pdf-paths";
import { assessCalibrationSafety } from "./calibration-safety";
import {
  CALIBRATION_SAFETY_FLAG_LABELS,
  type CalibrationSafetyFlagId,
} from "./calibration-safety";
import { buildFieldProvenanceFromExtraction } from "./extraction-provenance";
import { runCalibrationUploadExtraction } from "./extract-upload-pipeline";
import { buildEntryFromSaveInputForAudit } from "./anchor-audit-entry";
import type { CalibrationLab, ReportFieldKey } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

export type LiveAnchorExtractionAudit = AnchorExtractionAudit & {
  source: "live-pdf";
  pdfPath: string | null;
  pdfFound: boolean;
  timedOut?: boolean;
  pipelineError?: string;
  timings: {
    documentExtractMs: number;
    textParseMs: number;
    imageOcrMs: number;
    totalMs: number;
  };
  calibrationEligible: boolean;
  reviewFlags: string[];
  targetMatches: string[];
  targetMisses: string[];
  unexpectedValues: { field: ReportFieldKey; expected: string; actual: string }[];
};

export type AnchorFixtureLiveParity = {
  reportNumber: string;
  lab: CalibrationLab;
  matchingFields: ReportFieldKey[];
  missingLiveOnly: ReportFieldKey[];
  missingFixtureOnly: ReportFieldKey[];
  confidenceDifferences: {
    field: ReportFieldKey;
    fixture: string;
    live: string;
  }[];
  ocrOnlyDifferences: string[];
  calibrationSafetyDifferences: string[];
};

function compareToTargets(
  fields: Record<ReportFieldKey, string>,
  reportNumber: string,
): {
  targetMatches: string[];
  targetMisses: string[];
  unexpectedValues: LiveAnchorExtractionAudit["unexpectedValues"];
} {
  const targets = ANCHOR_FIELD_TARGETS[reportNumber] ?? {};
  const targetMatches: string[] = [];
  const targetMisses: string[] = [];
  const unexpectedValues: LiveAnchorExtractionAudit["unexpectedValues"] = [];

  for (const [key, expected] of Object.entries(targets) as [
    ReportFieldKey,
    string,
  ][]) {
    const actual = fields[key]?.trim() ?? "";
    if (!actual) {
      targetMisses.push(key);
      continue;
    }
    if (
      actual.toLowerCase() === expected.toLowerCase() ||
      actual.includes(expected) ||
      expected.includes(actual)
    ) {
      targetMatches.push(key);
    } else {
      unexpectedValues.push({ field: key, expected, actual });
    }
  }

  return { targetMatches, targetMisses, unexpectedValues };
}

export async function buildLiveAnchorExtractionAudit(
  spec: AnchorPdfSpec,
  pdfPath: string | null,
): Promise<LiveAnchorExtractionAudit> {
  if (!pdfPath) {
    return {
      reportNumber: spec.reportNumber,
      lab: spec.lab,
      scenarioId: spec.scenarioId,
      textMethod: "none",
      rawTextLength: 0,
      completenessPercent: 0,
      populatedCount: 0,
      requiredFieldCount: REPORT_FIELD_KEYS.length,
      fields: REPORT_FIELD_KEYS.map((field) => ({
        field,
        label: field,
        value: "",
        populated: false,
        channel: "unavailable",
        extractionClass: "UNAVAILABLE",
        valueSource: "extracted",
        extractionMethod: "unavailable",
        legacyConfidence: "missing",
        presentInRawText: false,
        whyMissing: "anchor PDF not found",
      })),
      warnings: ["anchor PDF not found"],
      source: "live-pdf",
      pdfPath: null,
      pdfFound: false,
      timings: {
        documentExtractMs: 0,
        textParseMs: 0,
        imageOcrMs: 0,
        totalMs: 0,
      },
      calibrationEligible: false,
      reviewFlags: ["Anchor PDF missing"],
      targetMatches: [],
      targetMisses: Object.keys(ANCHOR_FIELD_TARGETS[spec.reportNumber] ?? {}),
      unexpectedValues: [],
    };
  }

  const bytes = readFileSync(pdfPath);
  const result = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    lab: spec.lab,
    reportNumber: spec.reportNumber,
    reportSource: "pdf-upload",
  });

  const fields = result.fields;
  const provenance =
    result.fieldProvenance ??
    buildFieldProvenanceFromExtraction(
      { ...result, fields },
      result.rawTextSnippet ?? "",
      { usedImageOCR: result.ocrAttempted },
    );

  const optionalAbsent = new Set(
    ANCHOR_OPTIONAL_ABSENT[spec.reportNumber] ?? [],
  );
  const requiredKeys = REPORT_FIELD_KEYS.filter((k) => !optionalAbsent.has(k));
  const auditRows = buildAuditRows(
    { ...result, fields },
    provenance,
  );
  const populatedRequired = auditRows.filter(
    (r) => requiredKeys.includes(r.field) && r.populated,
  ).length;

  const entry = buildEntryFromSaveInputForAudit({
    spec,
    fields,
    result,
    provenance,
  });
  const safety = assessCalibrationSafety(entry);

  const { targetMatches, targetMisses, unexpectedValues } = compareToTargets(
    fields,
    spec.reportNumber,
  );

  return {
    reportNumber: spec.reportNumber,
    lab: spec.lab,
    scenarioId: spec.scenarioId,
    textMethod: result.textMethod ?? "none",
    parserType: result.parserType,
    parserConfidence: result.parserConfidence,
    rawTextLength: result.extractedCharCount,
    completenessPercent: Math.round(
      (populatedRequired / requiredKeys.length) * 100,
    ),
    populatedCount: auditRows.filter((r) => r.populated).length,
    requiredFieldCount: requiredKeys.length,
    fields: auditRows,
    warnings: [...result.warnings, ...result.pipelineNotices],
    usedImageOcr: result.ocrAttempted,
    source: "live-pdf",
    pdfPath,
    pdfFound: true,
    timedOut: result.timedOut,
    pipelineError: result.pipelineError,
    timings: result.timings,
    calibrationEligible: safety.calibrationEligible,
    reviewFlags: safety.reviewFlags.map(
      (f) => CALIBRATION_SAFETY_FLAG_LABELS[f as CalibrationSafetyFlagId] ?? f,
    ),
    targetMatches,
    targetMisses,
    unexpectedValues,
  };
}

export async function buildAllLiveAnchorAudits(): Promise<
  LiveAnchorExtractionAudit[]
> {
  const resolved = resolveAllAnchorPdfPaths();
  const audits: LiveAnchorExtractionAudit[] = [];
  for (const { spec, path } of resolved) {
    audits.push(await buildLiveAnchorExtractionAudit(spec, path));
  }
  return audits;
}

function rowMap(
  rows: FieldExtractionAuditRow[],
): Map<ReportFieldKey, FieldExtractionAuditRow> {
  return new Map(rows.map((r) => [r.field, r]));
}

export function compareFixtureAndLiveAnchorAudits(
  fixture: AnchorExtractionAudit,
  live: LiveAnchorExtractionAudit,
): AnchorFixtureLiveParity {
  const fixtureMap = rowMap(fixture.fields);
  const liveMap = rowMap(live.fields);
  const matchingFields: ReportFieldKey[] = [];
  const missingLiveOnly: ReportFieldKey[] = [];
  const missingFixtureOnly: ReportFieldKey[] = [];
  const confidenceDifferences: AnchorFixtureLiveParity["confidenceDifferences"] =
    [];
  const ocrOnlyDifferences: string[] = [];

  for (const key of REPORT_FIELD_KEYS) {
    const f = fixtureMap.get(key);
    const l = liveMap.get(key);
    const fPop = Boolean(f?.populated);
    const lPop = Boolean(l?.populated);
    if (fPop && lPop) matchingFields.push(key);
    if (fPop && !lPop) missingLiveOnly.push(key);
    if (!fPop && lPop) missingFixtureOnly.push(key);
    if (f && l && f.extractionClass !== l.extractionClass) {
      confidenceDifferences.push({
        field: key,
        fixture: f.extractionClass,
        live: l.extractionClass,
      });
    }
    if (f?.channel !== l?.channel) {
      ocrOnlyDifferences.push(
        `${key}: fixture channel=${f?.channel ?? "—"} live=${l?.channel ?? "—"}`,
      );
    }
  }

  const calibrationSafetyDifferences: string[] = [];
  if (fixture.completenessPercent !== live.completenessPercent) {
    calibrationSafetyDifferences.push(
      `completeness fixture=${fixture.completenessPercent}% live=${live.completenessPercent}%`,
    );
  }
  if (!live.calibrationEligible) {
    calibrationSafetyDifferences.push(
      `live not calibration-eligible: ${live.reviewFlags.join("; ") || "see flags"}`,
    );
  }

  return {
    reportNumber: fixture.reportNumber,
    lab: fixture.lab,
    matchingFields,
    missingLiveOnly,
    missingFixtureOnly,
    confidenceDifferences,
    ocrOnlyDifferences,
    calibrationSafetyDifferences,
  };
}

export function formatLiveAnchorAuditReport(
  audits: LiveAnchorExtractionAudit[],
): string {
  const lines: string[] = ["=== Live PDF anchor extraction audit ===", ""];
  for (const a of audits) {
    lines.push(
      `[${a.scenarioId}] ${a.lab} ${a.reportNumber} · pdf=${a.pdfFound ? a.pdfPath : "MISSING"}`,
    );
    if (a.timedOut) lines.push(`  TIMED OUT: ${a.pipelineError ?? "yes"}`);
    lines.push(
      `  parser=${a.parserType ?? "n/a"} · complete=${a.completenessPercent}% · calEligible=${a.calibrationEligible}`,
    );
    lines.push(
      `  timings(ms): doc=${a.timings.documentExtractMs} parse=${a.timings.textParseMs} ocr=${a.timings.imageOcrMs} total=${a.timings.totalMs}`,
    );
    lines.push(
      `  targets: ${a.targetMatches.length} match · ${a.targetMisses.length} miss · ${a.unexpectedValues.length} mismatch`,
    );
    if (a.targetMisses.length) {
      lines.push(`  missing targets: ${a.targetMisses.join(", ")}`);
    }
    if (a.unexpectedValues.length) {
      for (const u of a.unexpectedValues) {
        lines.push(`  mismatch ${u.field}: expected "${u.expected}" got "${u.actual}"`);
      }
    }
    for (const row of a.fields) {
      const status = row.populated
        ? `${row.channel} · ${row.extractionClass}`
        : `MISSING · ${row.whyMissing ?? ""}`;
      lines.push(
        `  ${row.label.padEnd(14)} ${row.populated ? row.value.padEnd(24) : "(empty)".padEnd(24)} ${status}`,
      );
    }
    if (a.reviewFlags.length) {
      lines.push(`  review flags: ${a.reviewFlags.join("; ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function formatFixtureLiveParityReport(
  parity: AnchorFixtureLiveParity[],
): string {
  const lines: string[] = ["=== Fixture vs live PDF parity ===", ""];
  for (const p of parity) {
    lines.push(`[${p.lab} ${p.reportNumber}]`);
    lines.push(`  matching: ${p.matchingFields.join(", ") || "(none)"}`);
    lines.push(
      `  missing on live only: ${p.missingLiveOnly.join(", ") || "(none)"}`,
    );
    lines.push(
      `  missing on fixture only: ${p.missingFixtureOnly.join(", ") || "(none)"}`,
    );
    if (p.confidenceDifferences.length) {
      lines.push("  confidence class differences:");
      for (const d of p.confidenceDifferences) {
        lines.push(`    ${d.field}: fixture=${d.fixture} live=${d.live}`);
      }
    }
    if (p.ocrOnlyDifferences.length) {
      lines.push(`  channel differences: ${p.ocrOnlyDifferences.join("; ")}`);
    }
    if (p.calibrationSafetyDifferences.length) {
      lines.push(
        `  safety: ${p.calibrationSafetyDifferences.join("; ")}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
