import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessCalibrationInclusion,
  hasImpossibleOrExtremeProportions,
} from "./calibration-inclusion-policy";
import { assessCalibrationSafety } from "./calibration-safety";
import {
  buildCorpusUnsafeTriageReport,
  classifyUnsafeRecord,
} from "./corpus-unsafe-triage";
import { emptyReportFields } from "./fields";
import type { CalibrationWorkbookEntry } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

function baseEntry(
  fields: ReturnType<typeof emptyReportFields>,
  overrides: Partial<CalibrationWorkbookEntry> = {},
): CalibrationWorkbookEntry {
  const confidence = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, fields[k]?.trim() ? "high" : "missing"]),
  ) as CalibrationWorkbookEntry["confidence"];
  return {
    id: "triage-test",
    savedAt: new Date().toISOString(),
    metadata: {
      lab: "GIA",
      reportNumber: "TEST-TRIAGE",
      reportSource: "pdf-upload",
      stoneType: "natural",
    },
    fields,
    fieldsNormalized: fields,
    confidence,
    extractedFieldsRaw: fields,
    extractedConfidence: confidence,
    warnings: ["Some values were read via OCR"],
    missingFields: [],
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

test("unsafe triage groups missing pavilion", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63",
    crownAngle: "36.5",
  });
  const entry = baseEntry(fields, { parserType: "gia-modern", textMethod: "ocr" });
  const safety = assessCalibrationSafety(entry);
  assert.equal(safety.calibrationEligible, false);
  const report = buildCorpusUnsafeTriageReport([entry]);
  assert.equal(report.unsafeCount, 1);
  assert.ok(report.rows[0]!.blockers.includes("missing_pavilion"));
});

test("inclusion excludes incomplete core but allows operational record", () => {
  const fields = emptyReportFields({ shape: "Round Brilliant" });
  const entry = baseEntry(fields);
  const inclusion = assessCalibrationInclusion(entry);
  assert.equal(inclusion.includedInCalibrationStatistics, false);
  assert.equal(inclusion.operationalRecord, true);
  assert.ok(inclusion.denialReasons.includes("not_calibration_eligible"));
});

test("impossible geometry detected", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "999",
    depthPercent: "61",
    crownAngle: "34",
    pavilionAngle: "40.8",
  });
  assert.equal(hasImpossibleOrExtremeProportions(fields), true);
});

test("classify single missing pavilion on strong record as fixable gap", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63.1",
    crownAngle: "36.5",
    lowerHalfPercent: "75",
    starLengthPercent: "50",
    carat: "1.9",
    measurements: "7.84 - 7.88 x 4.96 mm",
    polish: "Excellent",
    symmetry: "Excellent",
    fluorescence: "None",
    girdle: "Medium, Faceted",
    culet: "None",
  });
  const entry = baseEntry(fields, { parserType: "gia-modern" });
  const blockers = [
    "missing_pavilion",
    "incomplete_proportion_set",
    "missing_key_angles",
    "not_calibration_eligible",
  ] as const;
  const { classification } = classifyUnsafeRecord(entry, [...blockers]);
  assert.equal(classification, "FIXABLE_PARSER_GAP");
});
