/**
 * Mirrors POST /api/diamond-intelligence/interpret extraction (mode: client).
 * Usage: npx tsx scripts/probe-interpret-client-path.ts <pdf-path>
 */
import { readFileSync, existsSync } from "fs";
import { basename } from "path";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import { classifyFinalized } from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path || !existsSync(path)) {
    console.error("usage: probe-interpret-client-path.ts <pdf>");
    process.exit(2);
  }
  const bytes = readFileSync(path);
  const started = Date.now();
  const finalized = await withTimeout(
    runCalibrationUploadExtraction({
      bytes,
      mime: "application/pdf",
      mode: "client",
      reportSource: "pdf-upload",
    }),
    CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
    "probe-interpret",
  );
  const routeMs = Date.now() - started;
  const decision = classifyFinalized(finalized);
  const completeness = assessExtractionCompleteness({
    fields: finalized.fields,
    timedOut: finalized.timedOut,
    pipelineError: finalized.pipelineError ?? undefined,
  });

  const httpStatus = decision.tier === "failure" ? 422 : 200;
  console.log(
    JSON.stringify(
      {
        httpStatus,
        routeMs,
        timings: finalized.timings,
        parserType: finalized.parserType,
        lab: finalized.metadata.lab,
        reportNumber: finalized.metadata.reportNumber,
        tablePercent: finalized.fields.tablePercent,
        depthPercent: finalized.fields.depthPercent,
        crownAngle: finalized.fields.crownAngle,
        pavilionAngle: finalized.fields.pavilionAngle,
        interpretTier: decision.tier,
        scoreEligible: completeness.scoreEligible,
        extractionState: completeness.extractionState,
        imageOcrMs: finalized.timings.imageOcrMs,
        timedOut: finalized.timedOut,
        pipelineError: finalized.pipelineError,
      },
      null,
      2,
    ),
  );
  console.log({ file: basename(path) });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
