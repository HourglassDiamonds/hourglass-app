import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInterpretRequestId,
  logDiamondIntelligenceInterpretObservability,
  logDiamondIntelligenceInterpretStage,
} from "./interpret-observability";
import { emptyReportFields } from "@/lib/calibration-library/fields";
import type { UploadExtractionOutput } from "@/lib/calibration-library/extract-upload-pipeline";

describe("interpret-observability", () => {
  it("logs without throwing for a minimal finalized payload", () => {
    const fields = emptyReportFields();
    fields.tablePercent = "58";
    const finalized = {
      metadata: {
        lab: "GIA",
        reportNumber: "TEST",
        stoneType: "natural",
        reportSource: "upload",
      },
      fields,
      confidence: {},
      warnings: [],
      calibrationEligible: true,
      excludedFromCalibrationStats: false,
      parserType: "gia-modern",
      rawTextSnippet: "",
      usedImageOCR: true,
      pipelineNotices: [],
      ocrAttempted: true,
      ocrAvailable: true,
      pdfTextLayerLength: 100,
      gcalImageOnlyPdf: false,
      extractedCharCount: 100,
      timings: {
        documentExtractMs: 1,
        pdfFullPageOcrMs: 0,
        textParseMs: 1,
        imageOcrMs: 12,
        finalizerMs: 1,
        clientPayloadMs: 0,
        totalMs: 15,
      },
    } as unknown as UploadExtractionOutput;

    const requestId = createInterpretRequestId();
    assert.ok(requestId.length > 8);
    assert.doesNotThrow(() =>
      logDiamondIntelligenceInterpretObservability({
        finalized,
        httpStatus: 200,
        requestId,
      }),
    );
    assert.doesNotThrow(() =>
      logDiamondIntelligenceInterpretStage({
        requestId,
        event: {
          stage: "interpret-complete",
          status: "complete",
          elapsedMs: 15,
        },
      }),
    );
  });
});
