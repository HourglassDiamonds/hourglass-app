/**
 * Extraction Diagnostic Harness — developer-only visibility tool.
 * Usage:
 *   npx tsx scripts/diagnose-extraction.ts            # all anchors, calibration path
 *   npx tsx scripts/diagnose-extraction.ts --client   # client interpret path
 *   npx tsx scripts/diagnose-extraction.ts LG773657228 # single report
 *
 * Runs real anchor PDFs through the CURRENT parser paths with
 * `collectDiagnostics: true` and prints why each target field passed/failed.
 * This does NOT change parser behavior — diagnostics are read-only.
 */
import { readFileSync } from "fs";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
} from "@/lib/calibration-library/anchor-pdf-paths";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import type { ExtractionDiagnosticReport } from "@/lib/diamond-intelligence/extraction-diagnostics";

const ALL_TARGETS = [
  "LG773657228",
  "LG803682542",
  "LG353466126",
  "LG360796191",
  "2527039693",
];

const args = process.argv.slice(2);
const clientMode = args.includes("--client");
const requested = args.filter((a) => !a.startsWith("--"));
const targets = requested.length ? requested : ALL_TARGETS;

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printReport(reportNumber: string, diag: ExtractionDiagnosticReport): void {
  console.log("");
  console.log("=".repeat(96));
  console.log(
    `REPORT ${reportNumber}  family=${diag.reportFamily}  lab=${diag.lab || "?"}  ` +
      `textMethod=${diag.textMethod}  usedImageOCR=${diag.usedImageOCR}  ` +
      `pdfTextLen=${diag.pdfTextLayerLength}  gcalImageOnly=${diag.gcalImageOnlyPdf}`,
  );
  console.log(
    `  target fields accepted: ${diag.summary.targetAccepted}/${diag.summary.targetTotal}  ` +
      `(all: ${diag.summary.accepted} accepted / ${diag.summary.rejected} rejected / ${diag.summary.missing} missing)`,
  );
  if (diag.warnings.length) {
    console.log(`  warnings: ${diag.warnings.join(" | ")}`);
  }
  console.log("-".repeat(96));
  console.log(
    `  ${pad("FIELD", 16)}${pad("DECISION", 10)}${pad("VALUE", 16)}` +
      `${pad("METHOD", 13)}${pad("CLASS", 19)}CONF`,
  );
  for (const f of diag.targetFields) {
    const value = f.parsedValue ?? "—";
    const repaired = f.repairedValue ? ` (norm:${f.repairedValue})` : "";
    console.log(
      `  ${pad(f.field, 16)}${pad(f.decision, 10)}${pad(value + repaired, 16)}` +
        `${pad(f.source.method, 13)}${pad(f.source.extractionClass, 19)}${f.confidence}`,
    );
    if (f.decision !== "accepted") {
      console.log(
        `      ↳ reason: ${f.rejectionReason ?? "?"}  ` +
          `[labelInText=${f.labelPresentInRawText}]`,
      );
      if (f.rawEvidence) console.log(`      ↳ raw: ${f.rawEvidence}`);
    }
  }
}

async function runOne(reportNumber: string): Promise<void> {
  const spec = ANCHOR_PDF_SPECS.find((s) => s.reportNumber === reportNumber);
  if (!spec) {
    console.log(`SKIP ${reportNumber}: no spec`);
    return;
  }
  const path = resolveAnchorPdfPath(spec);
  if (!path) {
    console.log(`SKIP ${reportNumber}: PDF not found (set CALIBRATION_ANCHOR_PDF_DIR)`);
    return;
  }

  const bytes = readFileSync(path);
  try {
    const result = await runCalibrationUploadExtraction({
      bytes,
      mime: "application/pdf",
      reportSource: "pdf-upload",
      reportNumber,
      lab: spec.lab,
      mode: clientMode ? "client" : undefined,
      collectDiagnostics: true,
    });
    if (!result.diagnostics) {
      console.log(`SKIP ${reportNumber}: no diagnostics produced`);
      return;
    }
    printReport(reportNumber, result.diagnostics);
  } catch (err) {
    console.log(`ERROR ${reportNumber}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Extraction diagnostics — mode=${clientMode ? "client" : "calibration"}, targets=${targets.join(", ")}`,
  );
  for (const rn of targets) {
    await runOne(rn);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
