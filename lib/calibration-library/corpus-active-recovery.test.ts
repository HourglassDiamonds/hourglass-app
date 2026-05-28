import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildActiveUnsafeTriageRow,
  classifyRecoveryCandidate,
} from "./corpus-active-unsafe-triage";
import { isCalibrationSeedOrTestArtifact } from "./corpus-core";
import { deriveUnsafeBlockers } from "./corpus-unsafe-triage";
import { emptyReportFields } from "./fields";
import type { CalibrationWorkbookEntry } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

function entry(
  overrides: Partial<CalibrationWorkbookEntry> & {
    fields?: ReturnType<typeof emptyReportFields>;
  },
): CalibrationWorkbookEntry {
  const fields = overrides.fields ?? emptyReportFields();
  const confidence = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, fields[k]?.trim() ? "high" : "missing"]),
  ) as CalibrationWorkbookEntry["confidence"];
  return {
    id: overrides.id ?? "test-id",
    savedAt: new Date().toISOString(),
    metadata: {
      lab: "IGI",
      reportNumber: "LG773657228",
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
      ...(overrides.metadata ?? {}),
    },
    fields,
    fieldsNormalized: fields,
    confidence,
    extractedFieldsRaw: fields,
    extractedConfidence: confidence,
    warnings: [],
    missingFields: [],
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    sourceFilename: "LG773657228.pdf",
    ...overrides,
  };
}

test("seed variant detected as test artifact", () => {
  const e = entry({
    metadata: {
      lab: "IGI",
      reportNumber: "LG773657228-FACETE",
      reportSource: "screenshot-upload",
      stoneType: "lab-grown",
    },
  });
  assert.equal(isCalibrationSeedOrTestArtifact(e), true);
});

test("real upload LG773657228 missing shape → HIGH_RECOVERY", () => {
  const e = entry({
    fields: emptyReportFields({
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "33.7",
      pavilionAngle: "41.2",
    }),
  });
  const blockers = deriveUnsafeBlockers(e);
  const { classification } = classifyRecoveryCandidate(
    e,
    blockers,
    "EXCLUDE_FROM_CALIBRATION",
  );
  assert.equal(classification, "HIGH_RECOVERY_PROBABILITY");
});

test("active unsafe row only when not calibration-safe", () => {
  const safe = entry({
    fields: emptyReportFields({
      shape: "Round Brilliant",
      tablePercent: "57",
      depthPercent: "61.5",
      crownAngle: "33.7",
      pavilionAngle: "41.2",
    }),
    calibrationEligible: true,
  });
  assert.equal(buildActiveUnsafeTriageRow(safe), null);
});
