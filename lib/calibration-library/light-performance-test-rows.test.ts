import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyReportFields } from "./fields";
import {
  assignLpTestStatus,
  buildLpTestRow,
  isLpTestScoreReady,
  listLpTestRequiredMissing,
} from "./light-performance-test-rows";
import type { CalibrationWorkbookEntry } from "./types";

function mockEntry(
  overrides: Partial<CalibrationWorkbookEntry> = {},
): CalibrationWorkbookEntry {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "57",
    depthPercent: "61",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
  });
  return {
    id: "test-id",
    savedAt: new Date().toISOString(),
    metadata: {
      lab: "GCAL",
      reportNumber: "TEST-001",
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
    },
    fields,
    fieldsNormalized: fields,
    confidence: Object.fromEntries(
      Object.keys(fields).map((k) => [k, fields[k as keyof typeof fields] ? "high" : "missing"]),
    ) as CalibrationWorkbookEntry["confidence"],
    extractedFieldsRaw: fields,
    extractedConfidence: {} as CalibrationWorkbookEntry["extractedConfidence"],
    warnings: [],
    missingFields: [],
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

test("isLpTestScoreReady requires core proportion fields and round shape", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "57",
    depthPercent: "61",
    crownAngle: "34",
    pavilionAngle: "40.8",
  });
  assert.equal(isLpTestScoreReady(fields), true);
  assert.ok(listLpTestRequiredMissing(emptyReportFields()).includes("shape"));
});

test("assignLpTestStatus prioritizes MISSING over UNSCORED", () => {
  assert.equal(
    assignLpTestStatus({
      requiredMissing: ["tablePercent"],
      recalculated: {
        eligible: false,
        overall: 0,
        band: "outlier",
        dimensions: [],
        summary: "",
        disclaimers: [],
        weightingNote: "",
        ineligibleReason: "Shape was not extracted from the report.",
      },
      scoreMismatch: false,
      warnings: [],
      hasRuntimeWarning: false,
    }),
    "MISSING",
  );
});

test("buildLpTestRow detects score mismatch", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "57",
    depthPercent: "61",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
    polish: "Excellent",
    symmetry: "Excellent",
    girdle: "Medium",
    culet: "None",
    fluorescence: "None",
  });
  const entry = mockEntry({
    fields,
    fieldsNormalized: fields,
    roundBrilliantScore: {
      eligible: true,
      overall: 1,
      band: "outlier",
      dimensions: [],
      summary: "",
      disclaimers: [],
      weightingNote: "",
    },
  });
  const row = buildLpTestRow(entry);
  assert.equal(row.scoreMismatch, true);
  assert.equal(row.status, "MISMATCH");
});
