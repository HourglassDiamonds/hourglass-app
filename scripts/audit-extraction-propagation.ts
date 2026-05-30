/**
 * Field propagation audit — dev-only extraction truth harness.
 *
 * Usage:
 *   npx tsx scripts/audit-extraction-propagation.ts
 *   npx tsx scripts/audit-extraction-propagation.ts LG636401995 2496027047
 *
 * Traces each validation PDF through:
 *   raw text → text-parse → calibration pipeline → client pipeline →
 *   interpretation payload → UI field mapping
 *
 * Does NOT change parsers, scoring, confidence, or UI.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { extractTextFromDocument } from "@/lib/calibration-library/document-extract";
import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { detectReportFamily } from "@/lib/calibration-library/parsers/router";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import {
  CLIENT_DISPLAY_FIELD_KEYS,
  toClientSafeInterpretationPayload,
} from "@/lib/diamond-intelligence/client-api";
import { buildClientInterpretationSnapshot } from "@/lib/diamond-intelligence/client-interpretation-record";
import {
  classifyFinalized,
  type ClientInterpretationTier,
} from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import type { ExtractionDiagnosticField } from "@/lib/diamond-intelligence/extraction-diagnostics";

const ROOT = join(process.cwd(), "data/light-performance-calibration/validation-reports");
const MANIFEST = JSON.parse(
  readFileSync(join(ROOT, "manifest.json"), "utf8"),
) as {
  reports: Array<{ id: string; filename: string; lab: string; notes: string }>;
};
const EXPECTED = JSON.parse(
  readFileSync(join(ROOT, "expected-values.json"), "utf8"),
) as Record<string, Record<string, unknown>>;

/** Proportions + finish fields shown on Diamond Intelligence dashboard. */
const UI_PROPORTION_KEYS: ReportFieldKey[] = [
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "girdle",
  "culet",
];
const UI_FINISH_KEYS: ReportFieldKey[] = [
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];
const UI_IDENTITY_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
];

const AUDIT_FIELD_KEYS: ReportFieldKey[] = [
  "shape",
  "carat",
  "measurements",
  "tablePercent",
  "depthPercent",
  "crownAngle",
  "pavilionAngle",
  "lowerHalfPercent",
  "starLengthPercent",
  "girdle",
  "culet",
  "polish",
  "symmetry",
  "fluorescence",
  "cutGrade",
];

type MatchStatus = "exact" | "near" | "mismatch" | "missing" | "extra";

type StageValues = {
  textParse: string;
  calibrationFields: string;
  calibrationNormalized: string;
  calibrationConfidence: string;
  clientFields: string;
  clientNormalized: string;
  clientConfidence: string;
  interpretationInput: string;
  dashboardExtracted: string;
  dashboardInterpretation: string;
  uiVisible: string;
};

type FieldAuditRow = {
  field: ReportFieldKey;
  expected: string | null;
  matchVsClient: MatchStatus;
  rawPdfTextPresent: boolean;
  ocrLikelyPresent: boolean;
  stages: StageValues;
  lossPoint: string;
  diagnosticDecision?: string;
  diagnosticRejection?: string | null;
};

type ReportAudit = {
  reportId: string;
  lab: string;
  filename: string;
  route: string;
  textMethod: string;
  clientTextMethod: string;
  usedImageOcrCalibration: boolean;
  usedImageOcrClient: boolean;
  clientTier: ClientInterpretationTier;
  guidedCompletionFields: string[];
  needsExpertDiagramReview: boolean;
  parserPathCalibration: string;
  parserPathClient: string;
  pdfTextLayerLength: number;
  rawTextLength: number;
  internalFields: Record<string, string>;
  gcalOpticalNote: string | null;
  fields: FieldAuditRow[];
  summary: {
    exact: number;
    near: number;
    mismatch: number;
    missing: number;
    lossPoints: Record<string, number>;
  };
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[°%]/g, "")
    .replace(/[,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumeric(s: string): number | null {
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function compareExpected(
  field: ReportFieldKey,
  expectedRaw: unknown,
  actual: string,
): MatchStatus {
  if (expectedRaw === undefined || expectedRaw === null) {
    return actual.trim() ? "extra" : "missing";
  }
  const exp = String(expectedRaw).trim();
  if (!actual.trim()) return "missing";

  const numFields = new Set<ReportFieldKey>([
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
    "lowerHalfPercent",
    "starLengthPercent",
    "carat",
  ]);
  if (numFields.has(field)) {
    const e = normalizeNumeric(exp);
    const a = normalizeNumeric(actual);
    if (e === null || a === null) {
      return normalizeText(exp) === normalizeText(actual) ? "exact" : "mismatch";
    }
    const tol =
      field === "carat" ? 0.02 : field.includes("Angle") ? 0.15 : 0.2;
    if (Math.abs(e - a) <= tol) return Math.abs(e - a) < 0.001 ? "exact" : "near";
    return "mismatch";
  }

  const en = normalizeText(exp);
  const an = normalizeText(actual);
  if (en === an) return "exact";
  if (en.includes(an) || an.includes(en)) return "near";
  // girdle synonyms
  if (field === "girdle") {
    const strip = (x: string) =>
      x.replace(/\bfaceted\b/g, "").replace(/\s+/g, " ").trim();
    if (strip(en) === strip(an)) return "near";
  }
  if (field === "culet" && en === "none" && an === "pointed") return "mismatch";
  return "mismatch";
}

function valueInText(text: string, expected: unknown, field: ReportFieldKey): boolean {
  if (expected === undefined || expected === null) return false;
  const raw = String(expected);
  const norm = normalizeText(text);
  if (norm.includes(normalizeText(raw))) return true;

  const num = normalizeNumeric(raw);
  if (num !== null) {
    if (field.includes("Angle")) {
      return (
        norm.includes(String(num)) ||
        norm.includes(`${num}°`) ||
        norm.includes(`${num} °`)
      );
    }
    if (field.endsWith("Percent") || field === "carat") {
      return (
        norm.includes(String(num)) ||
        norm.includes(`${num}%`) ||
        norm.includes(`${num} %`)
      );
    }
  }
  return false;
}

function uiDisplayValue(
  field: ReportFieldKey,
  fields: CalibrationReportFields,
): string {
  const v = (fields[field] ?? "").trim();
  if (!v) return "";
  if (field === "tablePercent" || field === "depthPercent") return `${v}%`;
  if (field === "crownAngle" || field === "pavilionAngle") return `${v}°`;
  if (field === "carat" && !v.includes("ct")) return `${v} ct`;
  return v;
}

function uiFieldVisible(field: ReportFieldKey): boolean {
  return (
    UI_PROPORTION_KEYS.includes(field) ||
    UI_FINISH_KEYS.includes(field) ||
    UI_IDENTITY_KEYS.includes(field)
  );
}

function fmt(v: string): string {
  return v.trim() || "—";
}

function inferLossPoint(row: FieldAuditRow): string {
  const exp = row.expected;
  const client = row.stages.clientFields;
  const cal = row.stages.calibrationFields;
  const text = row.stages.textParse;
  const interp = row.stages.dashboardInterpretation;
  const ui = row.stages.uiVisible;

  if (!exp) {
    return client.trim() ? "unexpected value present" : "none (not expected)";
  }
  if (!client.trim()) {
    if (!cal.trim() && !text.trim()) {
      if (!row.rawPdfTextPresent && !row.ocrLikelyPresent) {
        return "not present in raw/OCR text";
      }
      if (row.rawPdfTextPresent || row.ocrLikelyPresent) {
        if (!text.trim()) return "present in text but text-parser missed";
        return "parser/OCR path missed (pre-finalize)";
      }
      return "parser never extracted";
    }
    if (cal.trim() && !client.trim()) {
      return "calibration extracted → client mode dropped (routing/budget)";
    }
    if (text.trim() && !cal.trim()) {
      return "text-parse only → pipeline did not promote";
    }
    return "extraction failed all stages";
  }
  if (interp.trim() && !ui.trim() && uiFieldVisible(row.field)) {
    return "payload has value → UI mapping empty (dashValue)";
  }
  if (
    row.field === "lowerHalfPercent" ||
    row.field === "starLengthPercent"
  ) {
    if (client.trim() && !ui.trim()) {
      return "extracted but not shown on dashboard (no UI row)";
    }
  }
  return "none";
}

function diagFor(
  fields: ExtractionDiagnosticField[] | undefined,
  key: ReportFieldKey,
): ExtractionDiagnosticField | undefined {
  return fields?.find((f) => f.field === key);
}

function buildInternalSnapshot(parsed: {
  giaInternal?: Record<string, string | undefined>;
  gcalInternal?: Record<string, string | undefined>;
  igiInternal?: Record<string, string | undefined>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.giaInternal ?? {})) {
    if (v?.trim()) out[`gia.${k}`] = v.trim();
  }
  for (const [k, v] of Object.entries(parsed.gcalInternal ?? {})) {
    if (v?.trim()) out[`gcal.${k}`] = v.trim();
  }
  for (const [k, v] of Object.entries(parsed.igiInternal ?? {})) {
    if (v?.trim()) out[`igi.${k}`] = v.trim();
  }
  return out;
}

async function auditReport(spec: (typeof MANIFEST.reports)[number]): Promise<ReportAudit> {
  const pdfPath = join(ROOT, spec.filename);
  const bytes = readFileSync(pdfPath);
  const expected = EXPECTED[spec.id] ?? {};

  const docCalib = await extractTextFromDocument(bytes, "application/pdf", {
    mode: "calibration",
  });
  const docClient = await extractTextFromDocument(bytes, "application/pdf", {
    mode: "client",
  });

  const family = detectReportFamily(docCalib.text || "", { lab: spec.lab });

  const textParse = extractFieldsFromReportText(docCalib.text || "", {
    lab: spec.lab,
    reportNumber: spec.id,
    textMethod: docCalib.method,
  });

  const calResult = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    reportNumber: spec.id,
    lab: spec.lab,
    mode: "calibration",
    collectDiagnostics: true,
  });

  const clientResult = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    reportNumber: spec.id,
    lab: spec.lab,
    mode: "client",
    collectDiagnostics: true,
  });

  const snapshot = buildClientInterpretationSnapshot({
    extractedFields: clientResult.fields,
    clientCompletedFields: {},
  });

  const payload = toClientSafeInterpretationPayload(clientResult, undefined, {
    partial: clientResult.clientPartial,
  });

  const decision = classifyFinalized(clientResult);

  const ocrText =
    docCalib.method === "ocr" || docCalib.ocrAttempted
      ? docCalib.text
      : docClient.text !== docCalib.text
        ? docClient.text
        : "";

  const internalFields = buildInternalSnapshot(clientResult);

  const rows: FieldAuditRow[] = [];

  for (const field of AUDIT_FIELD_KEYS) {
    const expVal = expected[field];
    const expectedStr =
      expVal !== undefined && expVal !== null ? String(expVal) : null;

    const stages: StageValues = {
      textParse: textParse.fields[field] ?? "",
      calibrationFields: calResult.fields[field] ?? "",
      calibrationNormalized: calResult.fieldsNormalized?.[field] ?? calResult.fields[field] ?? "",
      calibrationConfidence: calResult.confidence[field] ?? "",
      clientFields: clientResult.fields[field] ?? "",
      clientNormalized: clientResult.fieldsNormalized?.[field] ?? clientResult.fields[field] ?? "",
      clientConfidence: clientResult.confidence[field] ?? "",
      interpretationInput: snapshot.interpretationFields[field] ?? "",
      dashboardExtracted: payload.extractedFields[field] ?? "",
      dashboardInterpretation: payload.interpretationFields[field] ?? "",
      uiVisible: uiFieldVisible(field)
        ? uiDisplayValue(field, payload.interpretationFields)
        : "",
    };

    const dCal = diagFor(calResult.diagnostics?.fields, field);
    const dClient = diagFor(clientResult.diagnostics?.fields, field);

    const row: FieldAuditRow = {
      field,
      expected: expectedStr,
      matchVsClient: compareExpected(field, expVal, stages.clientFields),
      rawPdfTextPresent: valueInText(docCalib.text || "", expVal, field),
      ocrLikelyPresent: ocrText
        ? valueInText(ocrText, expVal, field)
        : valueInText(docCalib.text || "", expVal, field) &&
          docCalib.method === "ocr",
      stages,
      lossPoint: "pending",
      diagnosticDecision: dClient?.decision ?? dCal?.decision,
      diagnosticRejection: dClient?.rejectionReason ?? dCal?.rejectionReason,
    };
    row.lossPoint = inferLossPoint(row);
    rows.push(row);
  }

  const summary = {
    exact: rows.filter((r) => r.matchVsClient === "exact").length,
    near: rows.filter((r) => r.matchVsClient === "near").length,
    mismatch: rows.filter((r) => r.matchVsClient === "mismatch").length,
    missing: rows.filter((r) => r.matchVsClient === "missing" && r.expected).length,
    lossPoints: {} as Record<string, number>,
  };
  for (const r of rows) {
    if (r.expected && r.lossPoint !== "none" && r.lossPoint !== "none (not expected)") {
      summary.lossPoints[r.lossPoint] = (summary.lossPoints[r.lossPoint] ?? 0) + 1;
    }
  }

  return {
    reportId: spec.id,
    lab: spec.lab,
    filename: spec.filename,
    route: family.parserType,
    textMethod: docCalib.method,
    clientTextMethod: docClient.method,
    usedImageOcrCalibration: Boolean(calResult.diagnostics?.usedImageOCR),
    usedImageOcrClient: Boolean(clientResult.diagnostics?.usedImageOCR),
    clientTier: decision.tier,
    guidedCompletionFields: payload.capability.guidedCompletionFields,
    needsExpertDiagramReview: payload.capability.needsExpertDiagramReview,
    parserPathCalibration: calResult.parserPathUsed ?? calResult.parserType,
    parserPathClient: clientResult.parserPathUsed ?? clientResult.parserType,
    pdfTextLayerLength: docCalib.pdfTextLayerLength,
    rawTextLength: docCalib.text?.length ?? 0,
    internalFields,
    gcalOpticalNote: expected._gcalOptical
      ? "GCAL optical sections not in REPORT_FIELD_KEYS — documented only"
      : null,
    fields: rows,
    summary,
  };
}

function printReport(audit: ReportAudit): void {
  console.log("\n" + "=".repeat(100));
  console.log(`REPORT: ${audit.lab} ${audit.reportId}`);
  console.log(
    `File: ${audit.filename}  Route: ${audit.route}  ` +
      `Text: ${audit.textMethod} (client: ${audit.clientTextMethod})  ` +
      `PDF text layer: ${audit.pdfTextLayerLength} chars`,
  );
  console.log(
    `Pipeline: cal=${audit.parserPathCalibration} imageOCR=${audit.usedImageOcrCalibration} | ` +
      `client=${audit.parserPathClient} imageOCR=${audit.usedImageOcrClient} tier=${audit.clientTier}`,
  );
  if (audit.guidedCompletionFields.length) {
    console.log(`Guided completion asks: ${audit.guidedCompletionFields.join(", ")}`);
  }
  if (audit.needsExpertDiagramReview) {
    console.log("needsExpertDiagramReview: true");
  }
  if (Object.keys(audit.internalFields).length) {
    console.log(`Internal fields captured: ${JSON.stringify(audit.internalFields)}`);
  }
  if (audit.gcalOpticalNote) console.log(audit.gcalOpticalNote);

  console.log("-".repeat(100));

  for (const row of audit.fields) {
    if (!row.expected && row.matchVsClient === "missing") continue;
    console.log(`\nFIELD: ${row.field}`);
    console.log(`  Expected:           ${row.expected ?? "(not in ground truth)"}`);
    console.log(`  Match vs client:    ${row.matchVsClient}`);
    console.log(`  Raw PDF text:       ${row.rawPdfTextPresent ? "yes" : "no"}`);
    console.log(`  OCR text:           ${row.ocrLikelyPresent ? "yes" : "no"}`);
    console.log(`  Text-parse only:    ${fmt(row.stages.textParse)}`);
    console.log(`  Cal pipeline:       ${fmt(row.stages.calibrationFields)} (conf: ${row.stages.calibrationConfidence || "—"})`);
    console.log(`  Client pipeline:    ${fmt(row.stages.clientFields)} (conf: ${row.stages.clientConfidence || "—"})`);
    console.log(`  Interpretation in:  ${fmt(row.stages.interpretationInput)}`);
    console.log(`  Dashboard payload:  ${fmt(row.stages.dashboardInterpretation)}`);
    console.log(`  UI visible:         ${fmt(row.stages.uiVisible) || "—"}`);
    if (row.diagnosticDecision) {
      console.log(`  Diagnostic:         ${row.diagnosticDecision}${row.diagnosticRejection ? ` — ${row.diagnosticRejection}` : ""}`);
    }
    console.log(`  LOSS POINT:         ${row.lossPoint}`);
  }

  console.log("\n" + "-".repeat(100));
  console.log(
    `Summary: exact=${audit.summary.exact} near=${audit.summary.near} ` +
      `mismatch=${audit.summary.mismatch} missing=${audit.summary.missing}`,
  );
  if (Object.keys(audit.summary.lossPoints).length) {
    console.log("Loss point counts:");
    for (const [k, v] of Object.entries(audit.summary.lossPoints)) {
      console.log(`  ${v}× ${k}`);
    }
  }
}

function printLabSummaries(audits: ReportAudit[]): void {
  console.log("\n\n" + "#".repeat(100));
  console.log("LAB ROUTE SUMMARIES");
  console.log("#".repeat(100));

  const byLab = new Map<string, ReportAudit[]>();
  for (const a of audits) {
    const list = byLab.get(a.lab) ?? [];
    list.push(a);
    byLab.set(a.lab, list);
  }

  for (const [lab, list] of byLab) {
    console.log(`\n## ${lab}`);
    for (const a of list) {
      const props = a.fields.filter(
        (f) =>
          f.expected &&
          [
            "tablePercent",
            "depthPercent",
            "crownAngle",
            "pavilionAngle",
            "lowerHalfPercent",
            "starLengthPercent",
          ].includes(f.field),
      );
      const ok = props.filter((f) => f.matchVsClient === "exact" || f.matchVsClient === "near");
      console.log(
        `  ${a.reportId}: route=${a.route} clientTier=${a.clientTier} ` +
          `proportions ${ok.length}/${props.length} match expected`,
      );
    }
  }
}

function printRootCauseRanking(audits: ReportAudit[]): void {
  console.log("\n\n" + "#".repeat(100));
  console.log("ROOT-CAUSE RANKING (evidence-based)");
  console.log("#".repeat(100));

  const causes = [
    {
      rank: 1,
      title: "GIA diagram values not in PDF text layer — text parser cannot recover",
      reports: audits
        .filter((a) => a.lab === "GIA")
        .map((a) => a.reportId),
      fields: ["tablePercent", "crownAngle", "pavilionAngle", "lowerHalfPercent", "starLengthPercent", "girdle"],
      evidence:
        "GIA2496027047 + GIA6233708773: proportions absent from pdf-text; text-parse empty; depthPercent false-positive (60 from phone 603 on dossier). Diagram OCR required.",
      fix: "GIA extraction sprint: dossier diagram OCR + facsimile diagram crop/parser",
      risk: "medium",
      impact: "critical — blocks full read on all GIA diagram-only reports",
    },
    {
      rank: 2,
      title: "Client mode skips GIA/IGI diagram region OCR (intentional budget gate)",
      reports: audits
        .filter(
          (a) =>
            a.lab === "GIA" &&
            a.usedImageOcrCalibration !== a.usedImageOcrClient,
        )
        .map((a) => a.reportId),
      fields: ["crownAngle", "pavilionAngle", "tablePercent", "lowerHalfPercent"],
      evidence:
        "extract-upload-pipeline.ts L266-277: clientMode returns before applyGiaFacsimileDiagramImageOcr / applyIgiDiagramImageOcr. Dashboard uses mode=client.",
      fix: "Propagation/routing sprint: selective diagram OCR for client when text-layer insufficient (without full calibration OCR budget)",
      risk: "medium (latency)",
      impact: "critical — even fixed calibration path would not reach dashboard",
    },
    {
      rank: 3,
      title: "GCAL Sarine proportion diagram OCR partial / assignment mismatch",
      reports: audits.filter((a) => a.lab === "GCAL").map((a) => a.reportId),
      fields: ["depthPercent", "crownAngle", "pavilionAngle", "lowerHalfPercent"],
      evidence:
        "LG360796192: GCAL Sarine route runs image OCR in client mode but proportion fields still missing vs ground truth.",
      fix: "GCAL extraction sprint: Sarine diagram crop targets + field assignment",
      risk: "medium",
      impact: "high — primary GCAL validation anchor fails proportions",
    },
    {
      rank: 4,
      title: "False-positive depth from bare-depth heuristic on GIA dossier text",
      reports: ["2496027047"],
      fields: ["depthPercent"],
      evidence: "depthPercent=60 extracted from '603' in GIA contact phone line; expected 60.8 from diagram.",
      fix: "Parser guard: reject depth when source is non-proportion context on dossier/LGDR layout",
      risk: "low",
      impact: "medium — misleading partial read",
    },
    {
      rank: 5,
      title: "Dashboard UI does not surface lowerHalf/starLength even if extracted",
      reports: ["all"],
      fields: ["lowerHalfPercent", "starLengthPercent"],
      evidence:
        "LightPerformanceDashboard proportions card omits these keys; CLIENT_DISPLAY_FIELD_KEYS also omits them.",
      fix: "UI payload mapping sprint (separate) — not an extraction loss but visibility gap",
      risk: "low",
      impact: "low-medium — silent if extracted",
    },
  ];

  for (const c of causes) {
    console.log(`\n${c.rank}. ${c.title}`);
    console.log(`   Reports: ${c.reports.join(", ") || "n/a"}`);
    console.log(`   Fields: ${c.fields.join(", ")}`);
    console.log(`   Evidence: ${c.evidence}`);
    console.log(`   Recommended fix: ${c.fix}`);
    console.log(`   Risk: ${c.risk} | Impact: ${c.impact}`);
  }

  console.log("\n--- Tiny safe fix candidates (flag only — not implemented) ---");
  console.log(
    "• GIA dossier depthPercent false positive from phone number — add dossier-specific depth guard",
  );
  console.log(
    "• Document client-mode diagram OCR skip in dev diagnostics output (visibility, not behavior change)",
  );
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const specs = requested.length
    ? MANIFEST.reports.filter((r) =>
        requested.some((t) => r.id.includes(t) || r.filename.includes(t)),
      )
    : MANIFEST.reports;

  if (!specs.length) {
    console.error("No matching validation reports.");
    process.exit(1);
  }

  console.log(`Validation propagation audit — ${specs.length} report(s)`);
  console.log(`PDF dir: ${ROOT}`);

  const audits: ReportAudit[] = [];
  for (const spec of specs) {
    console.log(`\n>>> Auditing ${spec.lab} ${spec.id}...`);
    audits.push(await auditReport(spec));
  }

  for (const a of audits) printReport(a);
  printLabSummaries(audits);
  printRootCauseRanking(audits);

  const outJson = join(ROOT, "..", "validation-propagation-audit.json");
  writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), audits }, null, 2));
  console.log(`\nWrote ${outJson}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
