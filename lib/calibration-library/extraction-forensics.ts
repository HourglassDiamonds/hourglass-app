/**
 * Extraction forensics — deterministic debugging for validation anchors.
 * Read-only aggregation: render audit, pipeline stages, OCR traces, field lifecycle.
 */
import type { UploadExtractionOutput } from "./extract-upload-pipeline";
import type { CalibrationReportFields, ReportFieldKey } from "./types";
import {
  auditProductionPdfRender,
  type PdfRenderAuditRecord,
} from "./pdf-render-audit";
import {
  buildExtractionDiagnosticReport,
  DIAGNOSTIC_TARGET_FIELDS,
  type ExtractionDiagnosticReport,
} from "@/lib/diamond-intelligence/extraction-diagnostics";
import type { ForensicSnapshot } from "./extraction-forensic-collector";

export const FORENSIC_COMPARE_FIELDS: ReportFieldKey[] = [
  ...DIAGNOSTIC_TARGET_FIELDS,
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

export type ExpectedValidationMeta = {
  style?: string;
  expectedPartial?: boolean;
  optionalFields?: string[];
  expectedMissingCore?: string[];
  scoreEligibleExpected?: boolean;
};

export type ExpectedFieldSpec = Record<string, string | number | ExpectedValidationMeta | Record<string, unknown>>;

export type ExtractionForensicReport = {
  reportId: string;
  lab: string;
  mode: "calibration" | "client";
  parserType: string;
  pass: boolean;
  harnessPass: boolean;
  corePass: boolean;
  deepPass: boolean;
  reportStyle?: string;
  expectedPartial?: boolean;
  missingFields: string[];
  mismatchFields: string[];
  optionalMissingFields: string[];
  fieldComparisons: FieldComparisonRow[];
  lifecycle: {
    renderAudit: PdfRenderAuditRecord | null;
    documentExtractMs: number;
    imageOcrMs: number;
    totalMs: number;
    timedOut: boolean;
    pipelineError: string | null;
    textMethod: string;
    pdfTextLayerLength: number;
    usedImageOCR: boolean;
    fallbackStage: string | null;
  };
  assignments: ForensicFieldAssignment[];
  snapshots: ForensicSnapshot[];
  diagnostics: ExtractionDiagnosticReport | null;
  ocrTraces: Array<{
    source: string;
    ocrRawPreview?: string;
    repairedPreview?: string;
    candidates?: unknown;
    assigned?: unknown;
    rejected?: Array<{ candidate: string; reason: string }>;
    failureMode?: string;
    pageRendered?: boolean;
    pageRenderError?: string;
  }>;
};

export type FieldComparisonRow = {
  field: ReportFieldKey;
  expected: string | null;
  actual: string | null;
  match: boolean;
  status: "ok" | "missing" | "mismatch" | "unexpected";
};

export type ForensicFieldAssignment = {
  field: ReportFieldKey;
  finalValue: string | null;
  source: string;
  decision: "accepted" | "missing" | "rejected";
  rejectionReason: string | null;
  rawEvidence: string | null;
};

const CORE_FORENSIC_FIELDS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
];

const DEEP_FORENSIC_FIELDS: ReportFieldKey[] = [
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
];

function splitExpectedSpec(raw: ExpectedFieldSpec): {
  meta: ExpectedValidationMeta;
  fields: Record<string, string | number>;
} {
  const meta = (raw._meta ?? {}) as ExpectedValidationMeta;
  const fields: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue;
    if (typeof v === "string" || typeof v === "number") fields[k] = v;
  }
  return { meta, fields };
}

function normalizeExpected(v: string | number): string {
  if (typeof v === "number") return String(v);
  return v.trim();
}

function normalizeActual(v: string | undefined): string {
  return (v ?? "").trim().replace(/%$/, "").replace(/°$/, "");
}

function valuesMatch(expected: string, actual: string, field: ReportFieldKey): boolean {
  const e = normalizeActual(expected);
  const a = normalizeActual(actual);
  if (!e && !a) return true;
  if (!e || !a) return false;
  if (field === "girdle" || field === "culet" || field === "polish" || field === "symmetry") {
    return e.toLowerCase() === a.toLowerCase() ||
      a.toLowerCase().includes(e.toLowerCase().slice(0, 12));
  }
  const en = parseFloat(e);
  const an = parseFloat(a);
  if (Number.isFinite(en) && Number.isFinite(an)) {
    const tol = field.includes("Angle") ? 0.25 : 0.15;
    return Math.abs(en - an) <= tol;
  }
  return e === a;
}

export function compareFieldsToExpected(
  fields: CalibrationReportFields,
  expected: ExpectedFieldSpec,
  compareKeys: ReportFieldKey[] = FORENSIC_COMPARE_FIELDS,
): FieldComparisonRow[] {
  return compareKeys.map((field) => {
    const expRaw = expected[field];
    const expectedStr =
      expRaw === undefined || expRaw === null ? null : normalizeExpected(expRaw);
    const actual = fields[field]?.trim() || null;
    if (!expectedStr) {
      return {
        field,
        expected: null,
        actual,
        match: true,
        status: actual ? "unexpected" : "ok",
      };
    }
    if (!actual) {
      return { field, expected: expectedStr, actual: null, match: false, status: "missing" };
    }
    const match = valuesMatch(expectedStr, actual, field);
    return {
      field,
      expected: expectedStr,
      actual,
      match,
      status: match ? "ok" : "mismatch",
    };
  });
}

function extractOcrTraces(snapshots: ForensicSnapshot[]): ExtractionForensicReport["ocrTraces"] {
  return snapshots.map((s) => {
    const p = s.payload;
    return {
      source: `${s.source}/${s.phase}`,
      ocrRawPreview:
        typeof p.ocrRawTextPreview === "string"
          ? p.ocrRawTextPreview
          : typeof p.ocrRawPreview === "string"
            ? p.ocrRawPreview
            : undefined,
      repairedPreview:
        typeof p.repairedOcrTextPreview === "string"
          ? p.repairedOcrTextPreview
          : typeof p.repairedOcrPreview === "string"
            ? p.repairedOcrPreview
            : undefined,
      candidates: p.numericCandidates ?? p.candidatesFound ?? p.proportionCandidates,
      assigned: p.assignedProportionFields ?? p.assignmentsMade ?? p.recoveredFields,
      rejected: Array.isArray(p.rejectedCandidates)
        ? (p.rejectedCandidates as Array<{ candidate: string; reason: string }>)
        : undefined,
      failureMode: typeof p.failureMode === "string" ? p.failureMode : undefined,
      pageRendered: typeof p.pageRendered === "boolean" ? p.pageRendered : undefined,
      pageRenderError:
        typeof p.pageRenderError === "string" ? p.pageRenderError : undefined,
    };
  });
}

function buildAssignments(
  diagnostics: ExtractionDiagnosticReport | null,
  fields: CalibrationReportFields,
): ForensicFieldAssignment[] {
  const byField = new Map(
    (diagnostics?.fields ?? []).map((f) => [f.field, f]),
  );
  return FORENSIC_COMPARE_FIELDS.map((field) => {
    const d = byField.get(field);
    const finalValue = fields[field]?.trim() || null;
    return {
      field,
      finalValue,
      source: d?.source.method ?? "unknown",
      decision: d?.decision ?? (finalValue ? "accepted" : "missing"),
      rejectionReason: d?.rejectionReason ?? null,
      rawEvidence: d?.rawEvidence ?? null,
    };
  });
}

export function buildExtractionForensicReport(input: {
  reportId: string;
  lab: string;
  mode: "calibration" | "client";
  result: UploadExtractionOutput;
  expected: ExpectedFieldSpec;
  renderAudit?: PdfRenderAuditRecord | null;
  snapshots?: ForensicSnapshot[];
  combinedText?: string;
}): ExtractionForensicReport {
  const { result, expected: expectedRaw } = input;
  const { meta, fields: expectedFields } = splitExpectedSpec(expectedRaw);
  const optionalFields = new Set([
    ...(meta.optionalFields ?? []),
    ...(meta.expectedPartial ? (meta.expectedMissingCore ?? []) : []),
  ]);

  const fieldComparisons = compareFieldsToExpected(
    result.fields,
    expectedFields as ExpectedFieldSpec,
  );
  const missingFields = fieldComparisons
    .filter((r) => r.status === "missing" && r.expected)
    .map((r) => r.field);
  const mismatchFields = fieldComparisons
    .filter((r) => r.status === "mismatch")
    .map((r) => r.field);
  const optionalMissingFields = missingFields.filter((f) =>
    optionalFields.has(f),
  );

  const coreExpected = CORE_FORENSIC_FIELDS.filter(
    (k) => expectedFields[k] !== undefined && !optionalFields.has(k),
  );
  const corePass = coreExpected.every((k) => {
    const row = fieldComparisons.find((r) => r.field === k);
    return row?.status === "ok";
  });

  const deepExpected = DEEP_FORENSIC_FIELDS.filter(
    (k) => expectedFields[k] !== undefined && !optionalFields.has(k),
  );
  const deepPass =
    deepExpected.length === 0 ||
    deepExpected.every((k) => {
      const row = fieldComparisons.find((r) => r.field === k);
      return row?.status === "ok";
    });

  const requiredMissing = missingFields.filter((f) => !optionalFields.has(f));
  const harnessPass =
    mismatchFields.length === 0 &&
    requiredMissing.length === 0 &&
    (meta.expectedPartial ? true : corePass);

  const pass = harnessPass;

  const diagnostics = result.diagnostics ?? null;
  const snapshots = input.snapshots ?? [];

  return {
    reportId: input.reportId,
    lab: input.lab,
    mode: input.mode,
    parserType: result.parserType ?? "generic",
    pass,
    harnessPass,
    corePass,
    deepPass,
    reportStyle: meta.style,
    expectedPartial: meta.expectedPartial,
    missingFields,
    mismatchFields,
    optionalMissingFields,
    fieldComparisons,
    lifecycle: {
      renderAudit: input.renderAudit ?? result.renderAudit ?? null,
      documentExtractMs: result.timings.documentExtractMs,
      imageOcrMs: result.timings.imageOcrMs,
      totalMs: result.timings.totalMs,
      timedOut: Boolean(result.timedOut),
      pipelineError: result.pipelineError ?? null,
      textMethod: result.textMethod ?? "none",
      pdfTextLayerLength: result.pdfTextLayerLength,
      usedImageOCR: result.ocrAttempted,
      fallbackStage: result.extractionMeta?.fallbackStage ?? null,
    },
    assignments: buildAssignments(diagnostics, result.fields),
    snapshots,
    diagnostics,
    ocrTraces: extractOcrTraces(snapshots),
  };
}

export async function probeProductionRender(
  pdfBytes: Buffer,
): Promise<PdfRenderAuditRecord> {
  return auditProductionPdfRender(pdfBytes, { scale: 5, probeOcr: true });
}

export function formatHarnessBlock(report: ExtractionForensicReport): string {
  const lines: string[] = [];
  lines.push(report.reportId);
  if (report.reportStyle) lines.push(`style: ${report.reportStyle}`);
  lines.push(`core: ${report.corePass ? "PASS" : "FAIL"}`);
  lines.push(`deep: ${report.deepPass ? "PASS" : "PARTIAL"}`);
  if (report.expectedPartial) lines.push("partial-expected: yes");
  lines.push(report.harnessPass ? "PASS" : "FAIL");

  for (const row of report.fieldComparisons) {
    if (row.status === "ok" && row.expected) {
      lines.push(`${row.field} ${row.actual}`);
    } else if (row.status === "missing" && row.expected) {
      lines.push(`missing ${row.field}`);
    } else if (row.status === "mismatch") {
      lines.push(
        `mismatch ${row.field} expected=${row.expected} actual=${row.actual ?? "—"}`,
      );
    }
  }

  if (report.lifecycle.renderAudit && !report.lifecycle.renderAudit.renderSuccess) {
    lines.push(
      `render FAIL: ${report.lifecycle.renderAudit.failureReason ?? "unknown"}`,
    );
  }
  if (report.lifecycle.timedOut) {
    lines.push(`pipeline TIMEOUT totalMs=${report.lifecycle.totalMs}`);
  }

  return lines.join("\n");
}

export function formatForensicDetail(report: ExtractionForensicReport): string {
  const lines: string[] = [];
  lines.push(`${"=".repeat(72)}`);
  lines.push(
    `${report.reportId}  ${report.lab}  mode=${report.mode}  parser=${report.parserType}  ${report.pass ? "PASS" : "FAIL"}`,
  );
  lines.push(
    `lifecycle: docExtract=${report.lifecycle.documentExtractMs}ms ocr=${report.lifecycle.imageOcrMs}ms total=${report.lifecycle.totalMs}ms timedOut=${report.lifecycle.timedOut}`,
  );
  lines.push(
    `text: method=${report.lifecycle.textMethod} pdfLen=${report.lifecycle.pdfTextLayerLength} imageOCR=${report.lifecycle.usedImageOCR} fallback=${report.lifecycle.fallbackStage ?? "—"}`,
  );

  const ra = report.lifecycle.renderAudit;
  if (ra) {
    lines.push(
      `render: success=${ra.renderSuccess} ${ra.imageDimensions ? `${ra.imageDimensions.width}x${ra.imageDimensions.height}` : "—"} ocrReady=${ra.ocrReadiness} ocrChars=${ra.ocrProbeChars ?? "—"} fail=${ra.failureReason ?? "—"}`,
    );
  }

  lines.push("-".repeat(72));
  lines.push("FIELDS (expected vs actual):");
  for (const row of report.fieldComparisons.filter((r) => r.expected)) {
    const mark =
      row.status === "ok" ? "OK" : row.status === "missing" ? "MISS" : "BAD";
    lines.push(
      `  ${mark} ${row.field.padEnd(20)} exp=${row.expected ?? "—"}  got=${row.actual ?? "—"}`,
    );
  }

  lines.push("-".repeat(72));
  lines.push("ASSIGNMENTS:");
  for (const a of report.assignments.filter((x) =>
    FORENSIC_COMPARE_FIELDS.includes(x.field),
  )) {
    if (a.decision === "accepted" && a.finalValue) {
      lines.push(`  ${a.field}: ${a.finalValue}  source=${a.source}`);
    } else if (a.decision !== "accepted") {
      lines.push(
        `  ${a.field}: —  ${a.decision}  reason=${a.rejectionReason ?? "?"}`,
      );
    }
  }

  for (const trace of report.ocrTraces) {
    lines.push("-".repeat(72));
    lines.push(`OCR TRACE ${trace.source} failureMode=${trace.failureMode ?? "—"}`);
    if (trace.pageRenderError) lines.push(`  pageRenderError: ${trace.pageRenderError}`);
    if (trace.ocrRawPreview) lines.push(`  raw: ${trace.ocrRawPreview.slice(0, 200)}`);
    if (trace.repairedPreview) lines.push(`  repaired: ${trace.repairedPreview.slice(0, 200)}`);
    if (trace.candidates) {
      lines.push(`  candidates: ${JSON.stringify(trace.candidates).slice(0, 300)}`);
    }
    if (trace.assigned) {
      lines.push(`  assigned: ${JSON.stringify(trace.assigned).slice(0, 300)}`);
    }
    if (trace.rejected?.length) {
      lines.push("  rejected:");
      for (const r of trace.rejected.slice(0, 12)) {
        lines.push(`    ${r.candidate} → ${r.reason}`);
      }
    }
  }

  return lines.join("\n");
}

export function buildDiagnosticsIfNeeded(
  result: UploadExtractionOutput,
  combinedText: string,
): ExtractionDiagnosticReport {
  if (result.diagnostics) return result.diagnostics;
  return buildExtractionDiagnosticReport({
    extraction: result,
    rawText: combinedText,
    normalizedFields: result.fieldsNormalized,
    usedImageOCR: result.ocrAttempted,
    pdfTextLayerLength: result.pdfTextLayerLength,
    gcalImageOnlyPdf: result.gcalImageOnlyPdf,
  });
}
