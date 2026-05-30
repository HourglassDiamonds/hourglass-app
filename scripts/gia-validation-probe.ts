/**
 * Probe GIA diagram extraction on validation anchor PDFs.
 * Usage: npx tsx scripts/gia-validation-probe.ts [2496027047|6233708773]
 */
import { readFileSync } from "fs";
import { join } from "path";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  compareGiaDiagramVsCurrent,
  detectGiaDiagramLayout,
  extractGiaProportionDiagram,
} from "@/lib/calibration-library/parsers/gia/gia-diagram-extraction";

const VALIDATION_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);

const REPORTS = ["2496027047", "6233708773"] as const;
const requested = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const toRun = requested.length
  ? REPORTS.filter((r) => requested.some((q) => r.includes(q)))
  : [...REPORTS];

async function runOne(reportNumber: string): Promise<void> {
  const path = join(VALIDATION_DIR, `GIA-${reportNumber}.pdf`);
  const bytes = readFileSync(path);

  const cal = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    reportNumber,
    lab: "GIA",
    collectDiagnostics: true,
  });

  const client = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    reportSource: "pdf-upload",
    reportNumber,
    lab: "GIA",
    mode: "client",
    collectDiagnostics: true,
  });

  const layout = detectGiaDiagramLayout(cal.extractedText ?? "");
  const diagram = await extractGiaProportionDiagram(bytes, { layout });
  const cmp = compareGiaDiagramVsCurrent(diagram, cal.fields);

  console.log("\n" + "=".repeat(90));
  console.log(`GIA VALIDATION PROBE — ${reportNumber}`);
  console.log(`layout=${layout}  diagramLocated=${diagram.diagramLocated}  ${diagram.locateReason}`);
  console.log(`cal parser=${cal.parserType}  client tier=${client.clientPayload?.extractionTier ?? "?"}`);

  console.log("\nDiagram bands:");
  for (const b of diagram.bands) {
    console.log(`  ${b.id}: ${b.text.replace(/\s+/g, " ").slice(0, 90)}`);
  }

  console.log("\nField comparison (diagram vs calibration):");
  for (const row of cmp) {
    console.log(
      `  ${row.field.padEnd(18)} diagram=${String(row.diagramValue).padEnd(28)} cal=${String(row.currentValue ?? "").padEnd(28)} ${row.status}`,
    );
  }

  const keys = [
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
    "lowerHalfPercent",
    "starLengthPercent",
    "girdle",
    "culet",
  ] as const;
  console.log("\nCalibration vs client fields:");
  for (const k of keys) {
    const c = cal.fields[k] || "(empty)";
    const cl = client.fields[k] || "(empty)";
    const mark = c === cl ? "=" : "!";
    console.log(`  ${mark} ${k.padEnd(18)} cal=${String(c).padEnd(30)} client=${cl}`);
  }
}

async function main(): Promise<void> {
  for (const rn of toRun) {
    await runOne(rn);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
