/**
 * GIA proportion-diagram extraction probe — FEASIBILITY / DIAGNOSTIC ONLY.
 * Usage:
 *   npx tsx scripts/gia-diagram-probe.ts             # GIA anchor(s)
 *   npx tsx scripts/gia-diagram-probe.ts 2527039693  # single report
 *
 * Runs the deterministic diagram-first extraction layer (region → crop →
 * targeted OCR → labeled parse) and compares it field-by-field against the
 * current production OCR route. Does NOT modify the production path, scoring,
 * interpretation, UI, or the public confidence framework.
 */
import { readFileSync } from "fs";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
} from "@/lib/calibration-library/anchor-pdf-paths";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  compareGiaDiagramVsCurrent,
  extractGiaProportionDiagram,
} from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";

const args = process.argv.slice(2);
const requested = args.filter((a) => !a.startsWith("--"));

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function fmtCrop(c: { left: number; top: number; width: number; height: number }): string {
  return `L${c.left} T${c.top} W${c.width} H${c.height}`;
}

const STATUS_MARK: Record<string, string> = {
  match: "= match",
  mismatch: "! MISMATCH",
  "diagram-only": "+ diagram-only",
  "current-only": "- current-only",
  "both-missing": ". both-missing",
};

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

  // Current production route (for the comparison baseline).
  const current = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    reportNumber,
    lab: spec.lab,
    collectDiagnostics: true,
  });

  // Deterministic diagram-first layer.
  const diagram = await extractGiaProportionDiagram(bytes);

  console.log("");
  console.log("=".repeat(100));
  console.log(`GIA DIAGRAM PROBE — ${reportNumber}  (parser=${current.parserType})`);
  console.log(
    `diagram located: ${diagram.diagramLocated}  ·  ${diagram.locateReason}`,
  );
  console.log(`diagram region: ${fmtCrop(diagram.region)}  ocrAvailable=${diagram.ocrAvailable}`);

  console.log("-".repeat(100));
  console.log("BAND OCR (region → crop → targeted OCR):");
  for (const b of diagram.bands) {
    const preview = b.text.replace(/\s+/g, " ").slice(0, 90);
    console.log(
      `  [${pad(b.id, 12)}] ${pad(fmtCrop(b.crop), 30)} ${b.width}x${b.height}px ${b.preprocess}`,
    );
    console.log(`      ocr: ${preview || "(empty)"}`);
  }

  const comparison = compareGiaDiagramVsCurrent(diagram, current.fields);
  console.log("-".repeat(100));
  console.log(
    `  ${pad("FIELD", 18)}${pad("DIAGRAM", 14)}${pad("CURRENT", 14)}${pad("CONF", 8)}STATUS`,
  );
  for (const c of comparison) {
    console.log(
      `  ${pad(c.field, 18)}${pad(c.diagramValue ?? "—", 14)}${pad(c.currentValue ?? "—", 14)}` +
        `${pad(c.diagramConfidence, 8)}${STATUS_MARK[c.status] ?? c.status}`,
    );
    console.log(`      note: ${c.note}`);
  }

  const matches = comparison.filter((c) => c.status === "match").length;
  const mism = comparison.filter((c) => c.status === "mismatch").length;
  const diagOnly = comparison.filter((c) => c.status === "diagram-only").length;
  const curOnly = comparison.filter((c) => c.status === "current-only").length;
  console.log("-".repeat(100));
  console.log(
    `  summary: ${matches} match · ${mism} mismatch · ${diagOnly} diagram-only · ` +
      `${curOnly} current-only · ${comparison.length} fields`,
  );
  if (mism > 0) {
    console.log("  ⚠ conflicts (production left unchanged):");
    for (const c of comparison.filter((x) => x.status === "mismatch")) {
      console.log(
        `    ${c.field}: diagram=${c.diagramValue} vs current=${c.currentValue}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const giaSpecs = ANCHOR_PDF_SPECS.filter((s) => s.lab === "GIA");
  const targets = requested.length
    ? requested
    : giaSpecs.map((s) => s.reportNumber);
  console.log(`GIA diagram extraction probe — targets=${targets.join(", ")}`);
  for (const rn of targets) {
    await runOne(rn);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
