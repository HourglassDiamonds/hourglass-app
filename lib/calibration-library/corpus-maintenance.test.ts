import assert from "node:assert/strict";
import { test } from "node:test";
import { computeCorpusSafetySnapshot } from "./corpus-metrics";
import {
  applyQuarantineBatch,
  evaluateQuarantineDecision,
  quarantineCalibrationRecord,
} from "./corpus-quarantine";
import { applyRehydrateBatch } from "./corpus-rehydrate";
import {
  applyCorpusSaveGuardrails,
  detectManualCoreOverrideWithoutExtraction,
} from "./corpus-save-guardrails";
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
      lab: "GCAL",
      reportNumber: "LG1",
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
    ...overrides,
  };
}

test("quarantine RUNTIME-DUP-TEST without deleting", () => {
  const e = entry({
    metadata: {
      lab: "GCAL",
      reportNumber: "RUNTIME-DUP-TEST-123",
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
    },
  });
  const d = evaluateQuarantineDecision(e);
  assert.equal(d.shouldQuarantine, true);
  const q = quarantineCalibrationRecord(e, "runtime_dup_test_artifact");
  assert.equal(q.corpusStatus, "quarantined");
  assert.equal(q.excludedFromCalibrationStats, true);
  assert.equal(q.calibrationEligible, false);
});

test("quarantine incomplete core proportions", () => {
  const e = entry({ fields: emptyReportFields({ shape: "Round Brilliant" }) });
  const d = evaluateQuarantineDecision(e);
  assert.equal(d.shouldQuarantine, true);
  assert.equal(d.reason, "incomplete_core_proportions");
});

test("save guardrails flag manual core override without blocking shape", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "57",
    depthPercent: "61",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
  });
  const extracted = emptyReportFields({ shape: "Round Brilliant" });
  const e = entry({
    fields,
    extractedFieldsRaw: extracted,
    valueProvenance: { pavilionAngle: "manual-user" },
  });
  assert.equal(detectManualCoreOverrideWithoutExtraction(e), true);
  const g = applyCorpusSaveGuardrails(e);
  assert.equal(g.excludedFromCalibrationStats, true);
  assert.ok(g.corpusReviewFlags?.includes("manual_core_override"));
});

test("batch quarantine improves active-corpus safe percent", () => {
  const junk = entry({
    id: "junk",
    metadata: {
      lab: "GCAL",
      reportNumber: "RUNTIME-DUP-TEST-1",
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
    },
  });
  const good = entry({
    id: "good",
    metadata: {
      lab: "GCAL",
      reportNumber: "LG353466126",
      reportSource: "pdf-upload",
      stoneType: "lab-grown",
    },
    fields: emptyReportFields({
      shape: "Round Brilliant",
      tablePercent: "58",
      depthPercent: "61.1",
      crownAngle: "34.5",
      pavilionAngle: "40.8",
    }),
    parserType: "gcal-8x",
    textMethod: "ocr",
  });
  const before = computeCorpusSafetySnapshot([junk, good]);
  const { entries } = applyQuarantineBatch([junk, good]);
  const after = computeCorpusSafetySnapshot(entries);
  assert.equal(after.quarantinedRecords, 1);
  assert.ok(after.calibrationSafeActiveCorpusPercent >= before.calibrationSafeActiveCorpusPercent);
});

test("rehydrate preserves extractedFieldsRaw", () => {
  const raw = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "56",
    depthPercent: "63.1",
    crownAngle: "36.5",
    pavilionAngle: "40.8",
  });
  const e = entry({
    metadata: {
      lab: "GIA",
      reportNumber: "2527039693",
      reportSource: "pdf-upload",
      stoneType: "natural",
    },
    fields: raw,
    extractedFieldsRaw: { ...raw },
    confidence: Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [
        k,
        raw[k]?.trim() ? ("low" as const) : ("missing" as const),
      ]),
    ) as CalibrationWorkbookEntry["confidence"],
    textMethod: "ocr",
    parserType: "gia-modern",
    parserMetadata: {
      extractionMeta: {
        usedImageOCR: true,
        pdfTextLayerLength: 0,
        fallbackStage: "image-region-ocr",
        giaFacsimileGirdleEvidence: {
          faceted: true,
          percent: "3.5%",
          phraseRecovered: false,
        },
      },
    },
  });
  const { entries } = applyRehydrateBatch([e]);
  assert.equal(entries[0]!.extractedFieldsRaw.pavilionAngle, "40.8");
  assert.equal(entries[0]!.fields.pavilionAngle, "40.8");
});
