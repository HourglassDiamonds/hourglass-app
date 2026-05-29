/**
 * Dev benchmark: CLIENT interpretation state machine on anchor PDFs.
 * Usage: npx tsx scripts/benchmark-client-extract.ts
 *
 * Reports per anchor: route timing, tier (full|partial|failure), and the
 * deterministic snapshot summary — mirrors /api/diamond-intelligence/interpret.
 */
import { readFileSync } from "fs";
import {
  ANCHOR_PDF_SPECS,
  resolveAnchorPdfPath,
} from "@/lib/calibration-library/anchor-pdf-paths";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import {
  classifyFinalized,
  snapshotFieldSummary,
} from "@/lib/diamond-intelligence/client-interpretation-pipeline";
import { buildDiamondInterpretationContext } from "@/lib/diamond-intelligence/client-interpretation-context";
import { presentClientInterpretationScore } from "@/lib/diamond-intelligence/client-score-present";

const TARGETS = [
  "LG773657228",
  "LG803682542",
  "LG353466126",
  "LG360796191",
  "2527039693",
];

async function runOne(reportNumber: string): Promise<void> {
  const spec = ANCHOR_PDF_SPECS.find((s) => s.reportNumber === reportNumber);
  if (!spec) {
    console.log(`SKIP ${reportNumber}: no spec`);
    return;
  }
  const path = resolveAnchorPdfPath(spec);
  if (!path) {
    console.log(`SKIP ${reportNumber}: PDF not found`);
    return;
  }

  const bytes = readFileSync(path);
  const t0 = Date.now();
  let tier = "failure";
  let summary = "";
  let timedOut = false;
  let parser = "";
  let confidence = "";
  let cap: number | null = 0;
  let readState = "";
  try {
    const finalized = await withTimeout(
      runCalibrationUploadExtraction({
        bytes,
        mime: "application/pdf",
        mode: "client",
        reportSource: "pdf-upload",
        pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
      }),
      CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
      "benchmark-route",
    );
    const decision = classifyFinalized(finalized);
    tier = decision.tier;
    summary = snapshotFieldSummary(decision.snapshot);
    timedOut = Boolean(finalized.timedOut);
    parser = finalized.parserType;
    const score = presentClientInterpretationScore(finalized.fields, "deep");
    const ctx = buildDiamondInterpretationContext({
      fields: finalized.fields,
      rawScore: score.eligible ? score.overall : null,
    });
    confidence = ctx.confidenceLevel;
    cap = ctx.displayScore;
    readState = `${ctx.readState}/${ctx.displayLabel}`;
  } catch (err) {
    tier = "route-timeout";
    summary = err instanceof Error ? err.message : String(err);
  }

  const routeMs = Date.now() - t0;
  const httpStatus =
    tier === "full" || tier === "partial"
      ? 200
      : tier === "failure"
        ? 422
        : 504;

  console.log(
    `RESULT ${reportNumber} parser=${parser} tier=${tier} http=${httpStatus} readState=${readState} confidence=${confidence} cap=${cap} routeMs=${routeMs} timedOut=${timedOut} fields=${summary}`,
  );
}

async function main() {
  console.log(
    `budgets: route=${CLIENT_INTERPRET_ROUTE_TIMEOUT_MS}ms pipeline=${CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS}ms`,
  );
  for (const rn of TARGETS) {
    await runOne(rn);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
