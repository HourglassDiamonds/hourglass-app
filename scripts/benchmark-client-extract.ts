/**
 * Dev benchmark: calibration vs client extraction on anchor PDFs.
 * Usage: npx tsx scripts/benchmark-client-extract.ts
 */
import { readFileSync } from "fs";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
} from "@/lib/calibration-library/anchor-pdf-paths";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { clientExtractionSufficient } from "@/lib/diamond-intelligence/client-extraction-sufficient";

async function bench(
  label: string,
  path: string,
  mode: "calibration" | "client",
): Promise<void> {
  const bytes = readFileSync(path);
  const started = Date.now();
  const out = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    mode,
    reportSource: "pdf-upload",
  });
  const elapsed = Date.now() - started;
  const sufficient = clientExtractionSufficient({
    fields: out.fields,
    confidence: out.confidence,
  });
  console.log(`\n=== ${label} (${mode}) ===`);
  console.log({
    parser: out.parserType,
    lab: out.metadata.lab,
    totalMs: elapsed,
    pipelineTimings: out.timings,
    clientSufficient: sufficient,
    timedOut: out.timedOut,
    pipelineError: out.pipelineError,
  });
}

async function main() {
  const targets = ANCHOR_PDF_SPECS.filter((s) =>
    ["LG353466126", "LG360796191", "LG773657228", "2527039693"].includes(
      s.reportNumber,
    ),
  );

  for (const spec of targets) {
    const path = resolveAnchorPdfPath(spec);
    if (!path) {
      console.warn(`Skip ${spec.reportNumber}: PDF not found`);
      continue;
    }
    await bench(spec.reportNumber, path, "calibration");
    await bench(spec.reportNumber, path, "client");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
