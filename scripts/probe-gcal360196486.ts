import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { runCalibrationUploadExtraction } from "../lib/calibration-library/extract-upload-pipeline";
import { parseReportGradeHints } from "../lib/diamond-intelligence/report-grade-hints";
import { CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS } from "../lib/calibration-library/runtime-limits";

const JPG = "C:/Users/justi/OneDrive/Desktop/GCAL360196486.jpg";

async function main() {
  const bytes = readFileSync(JPG);
  const result = await runCalibrationUploadExtraction({
    bytes,
    mime: "image/jpeg",
    lab: "GCAL",
    mode: "calibration",
    pipelineTimeoutMs: 120_000,
  });

  const out = {
    parserType: result.parserType,
    lab: result.metadata?.lab,
    reportNumber: result.metadata?.reportNumber,
    fields: result.fields,
    gcalInternal: result.gcalInternal,
    hints: parseReportGradeHints(result.reportGradeHintText ?? ""),
    hintTextLen: (result.reportGradeHintText ?? "").length,
    hintSample: (result.reportGradeHintText ?? "").slice(0, 1200),
  };

  console.log(JSON.stringify(out, null, 2));
  writeFileSync(
    "data/diamond-intelligence/debug/gcal360196486-probe.json",
    JSON.stringify(out, null, 2),
  );
  writeFileSync(
    "data/diamond-intelligence/debug/gcal360196486-hint.txt",
    result.reportGradeHintText ?? "",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
