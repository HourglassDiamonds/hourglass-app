/**
 * PDF render comparison harness — infrastructure validation only.
 *
 * Usage:
 *   npx tsx scripts/pdf-render-harness.ts
 *   npx tsx scripts/pdf-render-harness.ts 2496027047
 *
 * Writes: data/light-performance-calibration/pdf-render-harness-report.json
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
} from "@/lib/calibration-library/anchor-pdf-paths";
import {
  runPdfRenderValidation,
  writePdfRenderValidationReport,
  type AnchorPdfInput,
} from "@/lib/calibration-library/pdf-render-audit";

const VALIDATION_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);

const VALIDATION_PDFS: Array<{ label: string; lab: string; file: string }> = [
  { label: "GIA-2496027047", lab: "GIA", file: "GIA-2496027047.pdf" },
  { label: "GIA-6233708773", lab: "GIA", file: "GIA-6233708773.pdf" },
  { label: "GIA-2527039693", lab: "GIA", file: "GIA-2527039693.pdf" },
  { label: "IGI-LG636401995", lab: "IGI", file: "IGI-LG636401995.pdf" },
  { label: "GCAL-LG360796192", lab: "GCAL", file: "GCAL-LG360796192.pdf" },
];

function loadAnchorPdf(
  reportNumber: string,
  lab: string,
  label: string,
): AnchorPdfInput | null {
  const spec = ANCHOR_PDF_SPECS.find((s) => s.reportNumber === reportNumber);
  if (!spec) return null;
  const path = resolveAnchorPdfPath(spec);
  if (!path || !existsSync(path)) return null;
  return {
    label,
    lab,
    bytes: readFileSync(path),
  };
}

function resolvePdfs(args: string[]): AnchorPdfInput[] {
  const pdfs: AnchorPdfInput[] = [];

  for (const spec of VALIDATION_PDFS) {
    if (args.length && !args.some((a) => spec.label.includes(a))) continue;
    const path = join(VALIDATION_DIR, spec.file);
    if (existsSync(path)) {
      pdfs.push({
        label: spec.label,
        lab: spec.lab,
        bytes: readFileSync(path),
      });
      continue;
    }
    const reportNum = spec.label.split("-").pop() ?? "";
    const anchor = loadAnchorPdf(reportNum, spec.lab, spec.label);
    if (anchor) pdfs.push(anchor);
  }

  if (!pdfs.some((p) => p.label.includes("2527039693"))) {
    const anchor = loadAnchorPdf("2527039693", "GIA", "GIA-2527039693-anchor");
    if (anchor && (!args.length || args.some((a) => anchor.label.includes(a)))) {
      pdfs.push(anchor);
    }
  }

  return pdfs;
}

function printMatrix(
  rows: ReturnType<typeof runPdfRenderValidation> extends Promise<infer R>
    ? R["matrix"]
    : never,
): void {
  console.log("\n=== MATRIX: Report | Renderer | Success | Failure | OCR Ready ===");
  const col = (s: string, w: number) => s.slice(0, w).padEnd(w);
  console.log(
    col("Report", 22) +
      col("Renderer", 42) +
      col("OK", 5) +
      col("Failure", 36) +
      col("OCR", 6),
  );
  console.log("-".repeat(115));
  for (const row of rows) {
    console.log(
      col(row.report, 22) +
        col(row.renderer.slice(0, 40), 42) +
        col(row.success ? "yes" : "no", 5) +
        col(row.failureReason?.slice(0, 34) ?? "—", 36) +
        col(
          row.ocrReady === "n/a" ? "n/a" : row.ocrReady ? "yes" : "no",
          6,
        ),
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const pdfs = resolvePdfs(args);

  if (pdfs.length === 0) {
    console.error("No anchor PDFs found. Check validation-reports/ or anchor-pdfs/");
    process.exit(1);
  }

  console.log("PDF render validation harness");
  console.log("Anchors:", pdfs.map((p) => `${p.label} (${p.lab})`).join(", "));

  const report = await runPdfRenderValidation({
    pdfs,
    scales: [5],
    probeOcr: true,
  });

  const outPath = join(
    process.cwd(),
    "data/light-performance-calibration/pdf-render-harness-report.json",
  );
  await writePdfRenderValidationReport(report, outPath);

  console.log("\n=== EXTERNAL TOOLS ===");
  for (const [tool, status] of Object.entries(report.externalTools)) {
    console.log(`  ${tool}: ${status}`);
  }

  console.log("\n=== SUMMARY BY REPORT ===");
  for (const [label, s] of Object.entries(report.summary.byReport)) {
    console.log(`  ${label}: ${s.succeeded}/${s.total} render attempts succeeded`);
  }

  console.log("\n=== SUMMARY BY RENDERER ===");
  for (const [backend, s] of Object.entries(report.summary.byRenderer)) {
    console.log(
      `  ${backend}: ${s.succeeded}/${s.total} ok, avg ${s.avgMs}ms, ocrReady=${s.ocrReady}`,
    );
  }

  printMatrix(report.matrix);

  console.log("\n=== ROOT CAUSE ===");
  console.log(report.rootCause);

  console.log("\n=== ARCHITECTURE RECOMMENDATION ===");
  console.log(`Choice ${report.architecture.choice}: ${report.architecture.label}`);
  console.log(report.architecture.rationale);
  console.log("Minimum change:", report.architecture.minimumChangePath);
  console.log("Expected recovery:", report.architecture.expectedExtractionRecovery);
  console.log(`\nFull report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
