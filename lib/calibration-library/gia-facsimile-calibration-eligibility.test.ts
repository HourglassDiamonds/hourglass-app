import assert from "node:assert/strict";
import { test } from "node:test";
import { assessCalibrationSafety } from "./calibration-safety";
import { emptyReportFields } from "./fields";
import {
  enrichGiaFacsimileExtractionPolicy,
  probeGiaFacsimileGirdleEvidence,
} from "./gia-facsimile-calibration-policy";
import { extractGiaGirdleFromFacsimileGradingResultsFragment } from "./gia-proportions";
import type { CalibrationWorkbookEntry, ExtractionResult } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

function giaFacsimileEntry(
  fields: ReturnType<typeof emptyReportFields>,
  overrides: Partial<CalibrationWorkbookEntry> = {},
): CalibrationWorkbookEntry {
  const confidence = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [
      k,
      fields[k]?.trim() ? "low" : "missing",
    ]),
  ) as CalibrationWorkbookEntry["confidence"];

  const fieldProvenance = Object.fromEntries(
    ["tablePercent", "depthPercent", "crownAngle", "pavilionAngle"].map((k) => [
      k,
      {
        extractionClass: "OCR_LOW_CONFIDENCE" as const,
        valueSource: "ocr" as const,
        extractionMethod: "diagram-ocr",
        legacyConfidence: "low" as const,
        presentInRawText: true,
      },
    ]),
  ) as CalibrationWorkbookEntry["fieldProvenance"];

  return {
    id: "gia-facsimile-test",
    savedAt: new Date().toISOString(),
    metadata: {
      lab: "GIA",
      reportNumber: "2527039693",
      reportSource: "pdf-upload",
      stoneType: "natural",
    },
    fields,
    fieldsNormalized: fields,
    confidence,
    extractedFieldsRaw: fields,
    extractedConfidence: confidence,
    parserType: "gia-modern",
    textMethod: "ocr",
    warnings: [],
    missingFields: [],
    parserMetadata: {
      parserType: "gia-modern",
      extractionMeta: {
        usedImageOCR: true,
        pdfTextLayerLength: 1200,
        fallbackStage: "image-region-ocr",
        giaFacsimileGirdleEvidence: {
          faceted: true,
          percent: "3.5%",
          phraseRecovered: false,
        },
      },
    },
    fieldProvenance,
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

const FACETED_ONLY_OCR = `GRADING RESULTS (faceted) 43.0% z FLAWLESS
3.5%
50% 56% 36.5° 16.5% 40.8° 43.0% 75% Depth 63.1%`;

test("GIA facsimile with full core proportions and missing girdle is calibration-eligible with review flag", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63.1",
    crownAngle: "36.5",
    pavilionAngle: "40.8",
  });
  const safety = assessCalibrationSafety(giaFacsimileEntry(fields));
  assert.equal(safety.calibrationEligible, true);
  assert.ok(safety.reviewFlags.includes("gia_girdle_phrase_unreadable"));
  assert.ok(!safety.reviewFlags.includes("not_calibration_eligible"));
});

test("missing pavilionAngle still blocks calibration eligibility", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63.1",
    crownAngle: "36.5",
  });
  const safety = assessCalibrationSafety(giaFacsimileEntry(fields));
  assert.equal(safety.calibrationEligible, false);
  assert.ok(safety.reviewFlags.includes("not_calibration_eligible"));
  assert.ok(safety.missingRequired.includes("pavilionAngle"));
});

test("missing crownAngle still blocks calibration eligibility", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63.1",
    pavilionAngle: "40.8",
  });
  const safety = assessCalibrationSafety(giaFacsimileEntry(fields));
  assert.equal(safety.calibrationEligible, false);
  assert.ok(safety.missingRequired.includes("crownAngle"));
});

test("missing shape still blocks calibration eligibility", () => {
  const fields = emptyReportFields({
    tablePercent: "56",
    depthPercent: "63.1",
    crownAngle: "36.5",
    pavilionAngle: "40.8",
  });
  const safety = assessCalibrationSafety(giaFacsimileEntry(fields));
  assert.equal(safety.calibrationEligible, false);
  assert.ok(safety.missingRequired.includes("shape"));
});

test("girdle is not fabricated from faceted and 3.5% OCR alone", () => {
  assert.equal(
    extractGiaGirdleFromFacsimileGradingResultsFragment(FACETED_ONLY_OCR),
    null,
  );
  const evidence = probeGiaFacsimileGirdleEvidence(FACETED_ONLY_OCR);
  assert.ok(evidence);
  assert.equal(evidence.faceted, true);
  assert.equal(evidence.percent, "3.5%");
  assert.equal(evidence.phraseRecovered, false);

  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63.1",
    crownAngle: "36.5",
    pavilionAngle: "40.8",
  });
  const result: ExtractionResult = {
    metadata: {
      lab: "GIA",
      reportNumber: "2527039693",
      reportSource: "pdf-upload",
      stoneType: "natural",
    },
    fields,
    confidence: Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [k, fields[k]?.trim() ? "low" : "missing"]),
    ) as ExtractionResult["confidence"],
    extractionMeta: {
      usedImageOCR: true,
      pdfTextLayerLength: 0,
      fallbackStage: "scoped-ocr",
    },
    rawTextSnippet: FACETED_ONLY_OCR,
    warnings: [],
    textMethod: "ocr",
    parserType: "gia-modern",
  };
  enrichGiaFacsimileExtractionPolicy(result, FACETED_ONLY_OCR);
  assert.equal(result.fields.girdle, "");
  assert.equal(result.extractionMeta?.giaFacsimileGirdleEvidence?.phraseRecovered, false);
});
