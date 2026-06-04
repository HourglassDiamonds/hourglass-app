/**
 * GCAL variant failure investigation — read-only diagnostics.
 *
 * Usage:
 *   npx tsx scripts/probe-gcal-variant-investigation.ts path/to/LG353006384.pdf ...
 *   npx tsx scripts/probe-gcal-variant-investigation.ts LG353006384 LG352560006
 *     (resolves under validation-reports, anchor-pdfs, uploads)
 *
 * Runs client-mode upload pipeline (production timeouts) + optional extended
 * document-extract pass when --extended-doc-extract is set (env only, no code change).
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, join } from "path";
import { extractTextFromDocument } from "@/lib/calibration-library/document-extract";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  looksLikeGcal8xReportText,
  looksLikeGcalSarine4csReportText,
} from "@/lib/calibration-library/parsers/gcal/gcal-layout-detector";
import { hasSarineColumnListSignature } from "@/lib/calibration-library/parsers/gcal/gcal-sarine-4cs";
import { detectReportFamily } from "@/lib/calibration-library/parsers/router";
import { detectLabFromText } from "@/lib/calibration-library/lab-parsers";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS,
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import {
  classifyFinalized,
  snapshotFieldSummary,
} from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";

const SEARCH_DIRS = [
  join(process.cwd(), "data/light-performance-calibration/validation-reports"),
  join(process.cwd(), "data/light-performance-calibration/anchor-pdfs"),
  join(process.cwd(), "data/light-performance-calibration/uploads"),
];

function resolveReportPath(arg: string): string | null {
  if (existsSync(arg)) return arg;
  const base = `GCAL-${arg}.pdf`;
  for (const dir of SEARCH_DIRS) {
    const p = join(dir, base);
    if (existsSync(p)) return p;
  }
  for (const dir of SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    for (const hint of [arg, arg.replace(/^LG/i, "")]) {
      const hits = readdirSync(dir).filter(
        (f) => f.toLowerCase().endsWith(".pdf") && f.includes(hint),
      );
      if (hits.length === 1) return join(dir, hits[0]!);
      if (hits.length > 1) {
        const newest = hits.sort().reverse()[0]!;
        return join(dir, newest);
      }
    }
  }
  return null;
}

function countPopulatedFields(
  fields: Record<string, string>,
): { total: number; keys: string[] } {
  const keys = REPORT_FIELD_KEYS.filter((k) => (fields[k] ?? "").trim().length > 0);
  return { total: keys.length, keys };
}

function categorizeFailure(input: {
  lab: string;
  parser: string;
  useful: boolean;
  tier: string;
  timedOut: boolean;
  pipelineError: string | null;
  docExtractMs: number;
  combinedLen: number;
  pdfTextLen: number;
  gcalImageOnly: boolean;
  ocrAttempted: boolean;
  fieldCount: number;
}): string {
  if (input.timedOut && input.pipelineError?.includes("document-extract")) {
    return `PIPELINE: client document-extract timeout (${CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS}ms) before text-parse — empty snapshot`;
  }
  if (input.timedOut && !input.combinedLen) {
    return "PIPELINE: upload timeout with no combined text";
  }
  if (input.lab === "OTHER" && !input.combinedLen) {
    return "A) Lab detection failure (no text — cannot detect GCAL)";
  }
  if (input.lab === "GCAL" && input.parser === "generic") {
    return "B/C) Report-style / unsupported — routed generic";
  }
  if (input.gcalImageOnly && !input.ocrAttempted && input.fieldCount < 4) {
    return "D) OCR failure or skipped — image-only PDF without region OCR recovery";
  }
  if (input.useful && input.tier === "partial") {
    return "F) Frontend gate — partial (useful but not proportion-sufficient)";
  }
  if (!input.useful) {
    return "F) Frontend gate — failure tier (isUsefulClientInterpretation false)";
  }
  return "PASS / full tier";
}

async function probeDocExtractOnly(bytes: Buffer): Promise<void> {
  const t0 = Date.now();
  try {
    const doc = await extractTextFromDocument(bytes, "application/pdf", {
      mode: "client",
    });
    console.log(
      `  doc-extract-only: ${Date.now() - t0}ms method=${doc.method} pdfTextLen=${doc.pdfTextLayerLength} gcalImageOnly=${doc.gcalImageOnlyPdf} textLen=${doc.text.length}`,
    );
    const lab = detectLabFromText(doc.text) ?? "OTHER";
    const family = detectReportFamily(doc.text, {
      gcalImageOnlyPdf: doc.gcalImageOnlyPdf,
    });
    console.log(
      `  pre-parse routing: lab=${lab} parser=${family.parserType} reason=${family.reason}`,
    );
    console.log(
      `  layout flags: gcal8x=${looksLikeGcal8xReportText(doc.text)} sarine=${looksLikeGcalSarine4csReportText(doc.text)} sarineColumnList=${hasSarineColumnListSignature(doc.text)}`,
    );
  } catch (err) {
    console.log(
      `  doc-extract-only: ERROR ${Date.now() - t0}ms — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function runClientPipeline(
  bytes: Buffer,
  reportNumber: string,
  label: string,
): Promise<void> {
  const t0 = Date.now();
  let finalized;
  try {
    finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime: "application/pdf",
        reportNumber,
        lab: "GCAL",
        reportSource: "pdf-upload",
        mode: "client",
        collectDiagnostics: true,
        pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
      }),
      CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
      label,
    );
  } catch (err) {
    console.log(
      `  client-pipeline: ROUTE TIMEOUT ${Date.now() - t0}ms — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  const decision = classifyFinalized(finalized);
  const populated = countPopulatedFields(finalized.fields);
  const diag = finalized.diagnostics;

  console.log(`  client-pipeline: ${Date.now() - t0}ms timedOut=${Boolean(finalized.timedOut)}`);
  console.log(
    `  detected lab=${finalized.metadata.lab} parser=${finalized.parserType} textMethod=${finalized.textMethod ?? "?"}`,
  );
  console.log(
    `  pdfTextLen=${finalized.pdfTextLayerLength} gcalImageOnly=${finalized.gcalImageOnlyPdf} ocrAttempted=${finalized.ocrAttempted} combinedLen=${finalized.extractedCharCount ?? 0}`,
  );
  if (finalized.pipelineError) {
    console.log(`  pipelineError=${finalized.pipelineError}`);
  }
  console.log(
    `  fields=${populated.total}/15 [${populated.keys.join(",")}] summary=${snapshotFieldSummary(decision.snapshot)}`,
  );
  console.log(
    `  interpret tier=${decision.tier} useful=${decision.useful} sufficient=${decision.sufficient}`,
  );
  if (diag) {
    console.log(
      `  diagnostics: family=${diag.reportFamily} targetAccepted=${diag.summary.targetAccepted}/${diag.summary.targetTotal}`,
    );
  }
  console.log(
    `  CATEGORY: ${categorizeFailure({
      lab: finalized.metadata.lab,
      parser: finalized.parserType ?? "generic",
      useful: decision.useful,
      tier: decision.tier,
      timedOut: Boolean(finalized.timedOut),
      pipelineError: finalized.pipelineError ?? null,
      docExtractMs: finalized.timings.documentExtractMs,
      combinedLen: finalized.extractedCharCount ?? 0,
      pdfTextLen: finalized.pdfTextLayerLength,
      gcalImageOnly: finalized.gcalImageOnlyPdf,
      ocrAttempted: finalized.ocrAttempted,
      fieldCount: populated.total,
    })}`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const extended = args.includes("--extended-doc-extract");
  const targets = args.filter((a) => !a.startsWith("--"));

  if (targets.length === 0) {
    console.error(
      "Provide PDF paths or report IDs: LG353006384 LG352560006 LG352146308 LG353126278",
    );
    process.exit(1);
  }

  console.log(
    `budgets: docExtract=${CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS}ms pipeline=${CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS}ms route=${CLIENT_INTERPRET_ROUTE_TIMEOUT_MS}ms`,
  );

  if (extended) {
    process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS = "15000";
    console.log("extended doc-extract: CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS=15000 (env only)");
  }

  for (const arg of targets) {
    const path = resolveReportPath(arg);
    console.log("\n" + "=".repeat(88));
    if (!path) {
      console.log(`REPORT ${arg}: PDF NOT FOUND`);
      console.log(`  Searched: ${SEARCH_DIRS.join(", ")}`);
      continue;
    }

    const bytes = readFileSync(path);
    const reportNumber = arg.match(/^LG\d+/i)?.[0] ?? basename(path, ".pdf");
    console.log(`REPORT ${reportNumber}`);
    console.log(`  file: ${path} (${bytes.length} bytes)`);

    await probeDocExtractOnly(bytes);
    await runClientPipeline(bytes, reportNumber, reportNumber);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
