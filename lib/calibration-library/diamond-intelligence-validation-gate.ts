/**
 * Canonical Diamond Intelligence validation gate.
 * Reuses manifest.json, expected-values.json, and extraction forensics.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { runCalibrationUploadExtraction } from "./extract-upload-pipeline";
import {
  buildExtractionForensicReport,
  type ExpectedFieldSpec,
  type ExpectedValidationMeta,
  type ExtractionForensicReport,
} from "./extraction-forensics";
import { withTimeout } from "./runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "./runtime-limits";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import type { CalibrationReportFields } from "./types";

export const VALIDATION_REPORTS_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);
export const VALIDATION_MANIFEST_PATH = join(VALIDATION_REPORTS_DIR, "manifest.json");
export const VALIDATION_EXPECTED_PATH = join(
  VALIDATION_REPORTS_DIR,
  "expected-values.json",
);
export const VALIDATION_GATE_JSON_PATH = join(
  process.cwd(),
  "data/light-performance-calibration/validation-gate-report.json",
);

export type ManifestEntry = {
  id: string;
  filename: string;
  lab: string;
  style?: string;
  notes?: string;
};

export type ValidationVerdict = "PASS" | "PARTIAL-BY-DESIGN" | "FAIL" | "SKIP";

export type ValidationGateRow = {
  reportId: string;
  style: string;
  table: string;
  depth: string;
  crown: string;
  pavilion: string;
  scoreEligible: boolean;
  verdict: ValidationVerdict;
  failures: string[];
  routeMs: number;
  timedOut: boolean;
};

export type ValidationGateResult = {
  rows: ValidationGateRow[];
  summary: {
    pass: number;
    partial: number;
    fail: number;
    skip: number;
    overall: "PASS" | "FAIL";
  };
  generatedAt: string;
};

function loadManifest(): ManifestEntry[] {
  const manifest = JSON.parse(readFileSync(VALIDATION_MANIFEST_PATH, "utf8")) as {
    reports: ManifestEntry[];
  };
  return manifest.reports;
}

function loadExpected(): Record<string, ExpectedFieldSpec> {
  return JSON.parse(readFileSync(VALIDATION_EXPECTED_PATH, "utf8")) as Record<
    string,
    ExpectedFieldSpec
  >;
}

function readMeta(expected: ExpectedFieldSpec): ExpectedValidationMeta {
  return (expected._meta ?? {}) as ExpectedValidationMeta;
}

function fieldDisplay(
  report: ExtractionForensicReport,
  key: keyof CalibrationReportFields,
): string {
  const row = report.assignments.find((a) => a.field === key);
  const value = row?.finalValue?.trim();
  return value || "—";
}

function deriveVerdict(
  forensic: ExtractionForensicReport,
  meta: ExpectedValidationMeta,
  scoreEligible: boolean,
  extraFailures: string[],
): ValidationVerdict {
  if (extraFailures.length > 0 || !forensic.harnessPass) return "FAIL";
  if (meta.expectedPartial) return "PARTIAL-BY-DESIGN";
  if (meta.scoreEligibleExpected === false && scoreEligible) return "FAIL";
  return "PASS";
}

function buildFailures(
  forensic: ExtractionForensicReport,
  meta: ExpectedValidationMeta,
  scoreEligible: boolean,
): string[] {
  const failures: string[] = [];
  for (const field of forensic.mismatchFields) {
    const row = forensic.fieldComparisons.find((r) => r.field === field);
    failures.push(
      `mismatch ${field}: expected=${row?.expected ?? "?"} actual=${row?.actual ?? "—"}`,
    );
  }
  for (const field of forensic.missingFields) {
    if (forensic.optionalMissingFields.includes(field)) continue;
    failures.push(`missing ${field}`);
  }
  if (meta.scoreEligibleExpected !== undefined && scoreEligible !== meta.scoreEligibleExpected) {
    failures.push(
      `scoreEligible expected=${meta.scoreEligibleExpected} actual=${scoreEligible}`,
    );
  }
  if (forensic.lifecycle.timedOut && !forensic.harnessPass) {
    failures.push(`pipeline timeout (${forensic.lifecycle.totalMs}ms)`);
  }
  if (forensic.lifecycle.pipelineError && !forensic.harnessPass) {
    failures.push(`pipeline error: ${forensic.lifecycle.pipelineError}`);
  }
  return failures;
}

async function extractClientInProcess(
  entry: ManifestEntry,
  expected: ExpectedFieldSpec,
): Promise<{ forensic: ExtractionForensicReport; routeMs: number }> {
  const pdfPath = join(VALIDATION_REPORTS_DIR, entry.filename);
  const bytes = readFileSync(pdfPath);
  const started = Date.now();

  const result = await withTimeout(
    runCalibrationUploadExtraction({
      bytes,
      mime: "application/pdf",
      reportNumber: entry.id,
      lab: entry.lab,
      reportSource: "pdf-upload",
      mode: "client",
      collectDiagnostics: true,
      pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
    }),
    CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
    "validation-gate",
  );

  const forensic = buildExtractionForensicReport({
    reportId: entry.id,
    lab: entry.lab,
    mode: "client",
    result,
    expected,
    snapshots: result.forensicSnapshots ?? [],
  });

  return { forensic, routeMs: Date.now() - started };
}

async function extractClientLivePost(
  entry: ManifestEntry,
  expected: ExpectedFieldSpec,
  baseUrl: string,
): Promise<{ forensic: ExtractionForensicReport; routeMs: number }> {
  const pdfPath = join(VALIDATION_REPORTS_DIR, entry.filename);
  const bytes = readFileSync(pdfPath);
  const started = Date.now();

  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    basename(entry.filename),
  );

  const headers: Record<string, string> = {};
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) headers["x-cron-secret"] = secret;

  const res = await fetch(
    `${baseUrl.replace(/\/$/, "")}/api/diamond-intelligence/interpret`,
    { method: "POST", headers, body: form },
  );
  const routeMs = Date.now() - started;
  const body = (await res.json()) as {
    ok?: boolean;
    interpretation?: {
      extractedFields?: CalibrationReportFields;
      extractionCompleteness?: { scoreEligible?: boolean };
    };
    error?: string;
  };

  if (!res.ok || !body.ok || !body.interpretation?.extractedFields) {
    const emptyFields = {} as CalibrationReportFields;
    const forensic = buildExtractionForensicReport({
      reportId: entry.id,
      lab: entry.lab,
      mode: "client",
      result: {
        fields: emptyFields,
        fieldsNormalized: emptyFields,
        parserType: "generic",
        timings: { documentExtractMs: 0, imageOcrMs: 0, totalMs: routeMs },
        timedOut: res.status === 504,
        pipelineError: body.error ?? `HTTP ${res.status}`,
        ocrAttempted: false,
        pdfTextLayerLength: 0,
        textMethod: "none",
        metadata: { lab: entry.lab, reportNumber: entry.id },
        confidence: "low",
        calibrationEligible: false,
        excludedFromCalibrationStats: true,
      },
      expected,
      snapshots: [],
    });
    return { forensic, routeMs };
  }

  const fields = body.interpretation.extractedFields;
  const forensic = buildExtractionForensicReport({
    reportId: entry.id,
    lab: entry.lab,
    mode: "client",
    result: {
      fields,
      fieldsNormalized: fields,
      parserType: "generic",
      timings: { documentExtractMs: 0, imageOcrMs: 0, totalMs: routeMs },
      timedOut: res.status === 504,
      ocrAttempted: false,
      pdfTextLayerLength: 0,
      textMethod: "none",
      metadata: { lab: entry.lab, reportNumber: entry.id },
      confidence: "medium",
      calibrationEligible: false,
      excludedFromCalibrationStats: true,
    },
    expected,
    snapshots: [],
  });

  return { forensic, routeMs };
}

function rowFromForensic(
  entry: ManifestEntry,
  expected: ExpectedFieldSpec,
  forensic: ExtractionForensicReport,
  routeMs: number,
): ValidationGateRow {
  const meta = readMeta(expected);
  const completeness = assessExtractionCompleteness({
    fields: Object.fromEntries(
      forensic.assignments
        .filter((a) => a.finalValue)
        .map((a) => [a.field, a.finalValue!]),
    ) as CalibrationReportFields,
    timedOut: forensic.lifecycle.timedOut,
    pipelineError: forensic.lifecycle.pipelineError ?? undefined,
    renderAudit: forensic.lifecycle.renderAudit ?? undefined,
  });
  const failures = buildFailures(forensic, meta, completeness.scoreEligible);
  const style =
    entry.style ?? meta.style ?? forensic.reportStyle ?? entry.lab;

  return {
    reportId: entry.id,
    style,
    table: fieldDisplay(forensic, "tablePercent"),
    depth: fieldDisplay(forensic, "depthPercent"),
    crown: fieldDisplay(forensic, "crownAngle"),
    pavilion: fieldDisplay(forensic, "pavilionAngle"),
    scoreEligible: completeness.scoreEligible,
    verdict: deriveVerdict(forensic, meta, completeness.scoreEligible, failures),
    failures,
    routeMs,
    timedOut: forensic.lifecycle.timedOut,
  };
}

export async function runValidationGate(options?: {
  filter?: string[];
  liveBaseUrl?: string;
}): Promise<ValidationGateResult> {
  const expectedAll = loadExpected();
  let entries = loadManifest();
  if (options?.filter?.length) {
    const filters = options.filter;
    const labFilter = filters.length === 1 && filters[0] === "GIA";
    entries = entries.filter((e) =>
      labFilter
        ? e.lab === "GIA"
        : filters.some((f) => e.id.includes(f) || e.filename.includes(f) || e.lab === f),
    );
  }

  const rows: ValidationGateRow[] = [];

  for (const entry of entries) {
    const pdfPath = join(VALIDATION_REPORTS_DIR, entry.filename);
    if (!existsSync(pdfPath)) {
      rows.push({
        reportId: entry.id,
        style: entry.style ?? entry.lab,
        table: "—",
        depth: "—",
        crown: "—",
        pavilion: "—",
        scoreEligible: false,
        verdict: "SKIP",
        failures: ["PDF missing"],
        routeMs: 0,
        timedOut: false,
      });
      continue;
    }

    const expected = expectedAll[entry.id] ?? {};
    const { forensic, routeMs } = options?.liveBaseUrl
      ? await extractClientLivePost(entry, expected, options.liveBaseUrl)
      : await extractClientInProcess(entry, expected);

    rows.push(rowFromForensic(entry, expected, forensic, routeMs));
  }

  const pass = rows.filter((r) => r.verdict === "PASS").length;
  const partial = rows.filter((r) => r.verdict === "PARTIAL-BY-DESIGN").length;
  const fail = rows.filter((r) => r.verdict === "FAIL").length;
  const skip = rows.filter((r) => r.verdict === "SKIP").length;
  const overall = fail > 0 || skip > 0 ? "FAIL" : "PASS";

  return {
    rows,
    summary: { pass, partial, fail, skip, overall },
    generatedAt: new Date().toISOString(),
  };
}

export function formatValidationGateReport(result: ValidationGateResult): string {
  const lines: string[] = [];
  lines.push("DIAMOND INTELLIGENCE VALIDATION GATE");
  lines.push("");
  lines.push(
    "Report ID".padEnd(14) +
      "Style".padEnd(32) +
      "Table".padEnd(7) +
      "Depth".padEnd(7) +
      "Crown".padEnd(7) +
      "Pavilion".padEnd(9) +
      "Score".padEnd(7) +
      "Verdict",
  );
  lines.push("-".repeat(96));

  for (const row of result.rows) {
    lines.push(
      row.reportId.padEnd(14) +
        row.style.slice(0, 30).padEnd(32) +
        row.table.padEnd(7) +
        row.depth.padEnd(7) +
        row.crown.padEnd(7) +
        row.pavilion.padEnd(9) +
        (row.scoreEligible ? "yes" : "no").padEnd(7) +
        row.verdict,
    );
    if (row.failures.length) {
      for (const failure of row.failures) {
        lines.push(`  └ ${failure}`);
      }
    }
  }

  lines.push("");
  lines.push(`PASS: ${result.summary.pass}`);
  lines.push(`PARTIAL: ${result.summary.partial}`);
  lines.push(`FAIL: ${result.summary.fail}`);
  if (result.summary.skip) lines.push(`SKIP: ${result.summary.skip}`);
  lines.push(`OVERALL: ${result.summary.overall}`);
  return lines.join("\n");
}

export function writeValidationGateJson(result: ValidationGateResult): void {
  writeFileSync(VALIDATION_GATE_JSON_PATH, JSON.stringify(result, null, 2));
}

/** Run each anchor in an isolated Node process to avoid OCR memory pressure. */
export async function runValidationGateIsolated(options?: {
  filter?: string[];
}): Promise<ValidationGateResult> {
  const { spawnSync } = await import("child_process");

  let entries = loadManifest();
  if (options?.filter?.length) {
    const filters = options.filter;
    const labFilter = filters.length === 1 && filters[0] === "GIA";
    entries = entries.filter((e) =>
      labFilter
        ? e.lab === "GIA"
        : filters.some((f) => e.id.includes(f) || e.filename.includes(f) || e.lab === f),
    );
  }

  const rowScript = join(process.cwd(), "scripts/validate-diamond-intelligence-row.ts");

  const rows: ValidationGateRow[] = [];

  for (const entry of entries) {
    const pdfPath = join(VALIDATION_REPORTS_DIR, entry.filename);
    if (!existsSync(pdfPath)) {
      rows.push({
        reportId: entry.id,
        style: entry.style ?? entry.lab,
        table: "—",
        depth: "—",
        crown: "—",
        pavilion: "—",
        scoreEligible: false,
        verdict: "SKIP",
        failures: ["PDF missing"],
        routeMs: 0,
        timedOut: false,
      });
      continue;
    }

    const child = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", rowScript, entry.id],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        shell: process.platform === "win32",
      },
    );

    const stdout = (child.stdout ?? "").trim();
    const lastLine = stdout.split(/\r?\n/).filter(Boolean).pop() ?? "";
    try {
      rows.push(JSON.parse(lastLine) as ValidationGateRow);
    } catch {
      rows.push({
        reportId: entry.id,
        style: entry.style ?? entry.lab,
        table: "—",
        depth: "—",
        crown: "—",
        pavilion: "—",
        scoreEligible: false,
        verdict: "FAIL",
        failures: [
          child.error?.message ??
            `isolated run failed (exit ${child.status})${child.stderr ? `: ${child.stderr.slice(0, 200)}` : ""}`,
        ],
        routeMs: 0,
        timedOut: false,
      });
    }
  }

  const pass = rows.filter((r) => r.verdict === "PASS").length;
  const partial = rows.filter((r) => r.verdict === "PARTIAL-BY-DESIGN").length;
  const fail = rows.filter((r) => r.verdict === "FAIL").length;
  const skip = rows.filter((r) => r.verdict === "SKIP").length;
  const overall = fail > 0 || skip > 0 ? "FAIL" : "PASS";

  return {
    rows,
    summary: { pass, partial, fail, skip, overall },
    generatedAt: new Date().toISOString(),
  };
}
