import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "./fields";
import { finalizeCalibrationExtractionResult } from "./finalize-calibration-extraction";
import {
  buildReviewGuidanceWarnings,
  ingestionStatusLine,
  textMethodReviewLabel,
} from "./review-guidance";
import type { ExtractionResult } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

function baseParsed(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  const confidence = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, "missing" as const]),
  ) as ExtractionResult["confidence"];
  return {
    metadata: {
      lab: "GCAL",
      reportNumber: "LG360796191",
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
    },
    fields: emptyReportFields({
      shape: "Round Brilliant",
      carat: "1.02",
    }),
    confidence,
    warnings: [
      "gcal-sarine-4cs: low extraction confidence — verify all fields manually before calibration.",
      "Not detected from report text — fill on review: Table %.",
    ],
    textMethod: "ocr",
    parserType: "gcal-sarine-4cs",
    parserConfidence: "low",
    rawTextSnippet: "",
    extractionMeta: {
      usedImageOCR: true,
      pdfTextLayerLength: 0,
      fallbackStage: "manual-review",
    },
    ...overrides,
  };
}

describe("review guidance", () => {
  it("labels text methods for reviewers", () => {
    assert.equal(textMethodReviewLabel("pdf-text"), "PDF text layer (selectable text)");
    assert.equal(textMethodReviewLabel("ocr"), "OCR (scanned pages or diagram regions)");
  });

  it("groups OCR notice and missing fields in finalizer warnings", () => {
    const finalized = finalizeCalibrationExtractionResult({
      parsed: baseParsed(),
      combinedText: "sample",
      usedImageOCR: true,
    });
    assert.ok(
      finalized.warnings.some((w) =>
        w.includes("Some values were read via OCR"),
      ),
    );
    assert.ok(
      finalized.warnings.some((w) =>
        w.startsWith("Not detected from report text — review manually:"),
      ),
    );
    assert.ok(
      finalized.warnings.some((w) => w.startsWith("Text source:")),
    );
    assert.ok(
      finalized.warnings.some((w) => w.startsWith("Calibration status:")),
    );
    assert.equal(
      finalized.warnings.some((w) => /fill on review/i.test(w)),
      false,
    );
  });

  it("describes review-only ingestion when not calibration eligible", () => {
    const line = ingestionStatusLine({
      calibrationEligible: false,
      excludedFromCalibrationStats: true,
      safety: {
        calibrationEligible: false,
        reviewFlags: ["not_calibration_eligible"],
        completenessPercent: 20,
        manualOverrideCount: 0,
        lowConfidenceFieldCount: 3,
        missingRequired: ["tablePercent"],
        reasons: [],
      },
    });
    assert.match(line, /review-only/i);
  });

  it("includes GCAL Sarine diagram notice when proportions are missing", () => {
    const finalized = finalizeCalibrationExtractionResult({
      parsed: baseParsed(),
      combinedText: "x",
      usedImageOCR: true,
    });
    assert.ok(
      buildReviewGuidanceWarnings(finalized).some((w) =>
        w.includes("GCAL Sarine: proportion fields"),
      ),
    );
  });
});
