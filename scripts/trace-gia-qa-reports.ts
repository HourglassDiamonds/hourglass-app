/**
 * Trace GIA QA anchor reports through upload → interpret payload.
 * Run: DI_GIA_QA_TRACE=1 npx tsx scripts/trace-gia-qa-reports.ts
 */
import { readFileSync } from "node:fs";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { interpretUploadedReport } from "@/lib/diamond-intelligence/interpret-uploaded-report";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import {
  GIA_QA_TRACE_REPORTS,
  giaQaTraceFieldsForReport,
  traceClientPayloadStages,
  traceRawOcrPreview,
  type GiaQaFieldSnapshot,
  type GiaQaTraceStage,
} from "@/lib/diamond-intelligence/gia-qa-pipeline-trace";

process.env.DI_GIA_QA_TRACE = "1";
process.env.CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS ??= "90000";
process.env.CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS ??= "90000";
process.env.CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS ??= "90000";
process.env.CLIENT_INTERPRET_ROUTE_TIMEOUT_MS ??= "90000";

const REPORTS = [
  {
    id: "7438591452",
    path: "C:/Users/justi/OneDrive/Desktop/7438591452.pdf",
  },
  {
    id: "2524422799",
    path: "C:/Users/justi/OneDrive/Desktop/2524422799.pdf",
  },
] as const;

function snapshotFromFinalized(
  reportNumber: string,
  stage: GiaQaTraceStage,
  fields: Record<string, string>,
): { stage: GiaQaTraceStage; fields: GiaQaFieldSnapshot } {
  const keys = giaQaTraceFieldsForReport(reportNumber);
  const out: GiaQaFieldSnapshot = {};
  for (const key of keys) {
    out[key] = fields[key]?.trim() || "(empty)";
  }
  return { stage, fields: out };
}

async function traceReport(spec: (typeof REPORTS)[number]): Promise<void> {
  console.log(`\n========== ${spec.id} ==========\n`);
  const bytes = readFileSync(spec.path);

  const finalized = await runCalibrationUploadExtraction({
    bytes,
    mime: "application/pdf",
    lab: "GIA",
    mode: "client",
    reportNumber: spec.id,
    collectDiagnostics: true,
  });

  traceRawOcrPreview(spec.id, finalized.rawTextSnippet ?? "", {
    textMethod: finalized.textMethod,
    parserType: finalized.parserType,
    ocrSkipped: finalized.timings?.imageOcrMs === 0,
    imageOcrMs: finalized.timings?.imageOcrMs,
    timedOut: finalized.timedOut,
  });

  const stages: Array<{ stage: GiaQaTraceStage; fields: GiaQaFieldSnapshot }> = [];

  stages.push(
    snapshotFromFinalized(spec.id, "finalizedFields", finalized.fields),
  );
  traceClientPayloadStages(finalized, { partial: finalized.clientPartial });

  const interpret = await interpretUploadedReport({
    bytes,
    mime: "application/pdf",
    sourceFilename: `${spec.id}.pdf`,
  });

  if (interpret.ok) {
    stages.push(
      snapshotFromFinalized(
        spec.id,
        "apiExtractedFields",
        interpret.interpretation.extractedFields,
      ),
    );
    console.log("[GIA QA TRACE] interpretRoute", {
      reportNumber: spec.id,
      partial: interpret.partial,
      cacheHit: interpret.cacheHit,
      tier: interpret.decision.tier,
      heroWouldBlock:
        !interpret.interpretation.decisionProfile?.confidence ||
        interpret.interpretation.decisionProfile.confidence.band === "Low",
      confidenceBand: interpret.interpretation.decisionProfile?.confidence.band,
    });
  } else {
    console.log("[GIA QA TRACE] interpretRoute FAILED", {
      reportNumber: spec.id,
      error: interpret.error,
      timedOut: interpret.timedOut,
    });
  }

  const keys = giaQaTraceFieldsForReport(spec.id);
  const completeness = assessExtractionCompleteness({ fields: finalized.fields });
  console.log("\n[GIA QA SUMMARY]", spec.id);
  for (const key of keys) {
    console.log(`  ${key}: ${finalized.fields[key]?.trim() || "(empty)"}`);
  }
  console.log("  scoreEligible:", completeness.scoreEligible);
  console.log("  extractionState:", completeness.extractionState);
  console.log("  missingCoreFields:", completeness.missingCoreFields);
  console.log("  clientPartial:", finalized.clientPartial);
  console.log("  timedOut:", finalized.timedOut);
  console.log("  imageOcrMs:", finalized.timings?.imageOcrMs);
}

async function main(): Promise<void> {
  console.log("GIA QA pipeline trace", [...GIA_QA_TRACE_REPORTS].join(", "));
  for (const spec of REPORTS) {
    await traceReport(spec);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
