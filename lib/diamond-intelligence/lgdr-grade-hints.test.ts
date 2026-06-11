import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, it } from "node:test";
import { runCalibrationUploadExtraction } from "@/lib/calibration-library/extract-upload-pipeline";
import {
  CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
} from "@/lib/calibration-library/runtime-limits";
import { withTimeout } from "@/lib/calibration-library/runtime-guard";
import {
  listMissingGradeFields,
  needsPartialGradeReview,
} from "@/app/diamond-intelligence/components/v3-presentation";
import { toClientSafeInterpretationPayload } from "./client-api";

const VALIDATION_DIR = join(
  process.cwd(),
  "data/light-performance-calibration/validation-reports",
);

const LGDR_ANCHORS = [
  {
    id: "2496027047",
    file: "GIA-2496027047.pdf",
    expectedColor: "F",
    expectedClarity: "VVS2",
  },
  {
    id: "1493739085",
    file: "GIA-1493739085.pdf",
    expectedColor: "D",
    expectedClarity: "VS1",
  },
  {
    id: "6502274288",
    file: "GIA-6502274288.pdf",
    expectedColor: "D",
    expectedClarity: "VS1",
  },
] as const;

describe("GIA LGDR validation anchors — grade hint passthrough", () => {
  for (const spec of LGDR_ANCHORS) {
    const path = join(VALIDATION_DIR, spec.file);
    if (!existsSync(path)) continue;

    it(`${spec.id} client extract populates gradeHints and skips partial grade review`, async () => {
      const bytes = readFileSync(path);
      const finalized = await withTimeout(
        runCalibrationUploadExtraction({
          bytes,
          mime: "application/pdf",
          reportSource: "pdf-upload",
          reportNumber: spec.id,
          lab: "GIA",
          mode: "client",
          pipelineTimeoutMs: CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
        }),
        CLIENT_INTERPRET_ROUTE_TIMEOUT_MS,
        `lgdr-grade-hints-${spec.id}`,
      );

      const payload = toClientSafeInterpretationPayload(finalized, undefined, {
        partial: finalized.clientPartial,
      });

      assert.equal(payload.gradeHints?.color, spec.expectedColor, spec.id);
      assert.equal(payload.gradeHints?.clarity, spec.expectedClarity, spec.id);
      assert.equal(
        payload.decisionProfile?.gradeHints?.color,
        spec.expectedColor,
      );
      assert.equal(
        payload.decisionProfile?.gradeHints?.clarity,
        spec.expectedClarity,
      );
      assert.deepEqual(listMissingGradeFields(payload.gradeHints), []);
      assert.equal(
        needsPartialGradeReview({
          gradeHints: payload.gradeHints,
          canShowScore: false,
        }),
        false,
      );
    });
  }
});
