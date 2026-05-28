import assert from "node:assert/strict";
import { test } from "node:test";
import { assessCalibrationSafety } from "./calibration-safety";
import {
  buildLockedAnchorExtractionAudits,
} from "./extraction-field-audit";
import {
  buildFieldProvenanceFromExtraction,
  mergeValueProvenanceOnSave,
} from "./extraction-provenance";
import { extractFieldsFromReportText } from "./extract-from-text";
import { GIA2527039693_PDF_TEXT_LAYER } from "./fixtures/gia2527039693";
import { emptyReportFields } from "./fields";
import type { CalibrationWorkbookEntry } from "./types";
import { REPORT_FIELD_KEYS } from "./types";

test("anchor audits reach full completeness on locked fixtures", () => {
  const audits = buildLockedAnchorExtractionAudits();
  assert.equal(audits.length, 4);
  for (const a of audits) {
    assert.equal(
      a.completenessPercent,
      100,
      `${a.scenarioId} should be 100% complete`,
    );
  }
});

test("manual override blocks calibration eligibility", () => {
  const fields = emptyReportFields({
    shape: "Round Brilliant",
    tablePercent: "57",
    depthPercent: "61",
    crownAngle: "34.5",
    pavilionAngle: "40.8",
  });
  const entry: CalibrationWorkbookEntry = {
    id: "test",
    savedAt: new Date().toISOString(),
    metadata: {
      lab: "GIA",
      reportNumber: "TEST-1",
      reportSource: "manual",
      stoneType: "natural",
    },
    fields,
    fieldsNormalized: fields,
    confidence: Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [k, "high"]),
    ) as CalibrationWorkbookEntry["confidence"],
    extractedFieldsRaw: fields,
    extractedConfidence: Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [k, "high"]),
    ) as CalibrationWorkbookEntry["extractedConfidence"],
    warnings: [],
    missingFields: [],
    roundBrilliantScore: null,
    recordVersion: 1,
    schemaVersion: 1,
    valueProvenance: { tablePercent: "manual-user" },
  };
  const safety = assessCalibrationSafety(entry);
  assert.equal(safety.calibrationEligible, false);
  assert.ok(safety.reviewFlags.includes("manual_override_present"));
});

test("field provenance classifies GIA PDF text layer", () => {
  const result = extractFieldsFromReportText(GIA2527039693_PDF_TEXT_LAYER, {
    lab: "GIA",
    reportNumber: "2527039693",
    textMethod: "pdf-text",
  });
  const provenance = buildFieldProvenanceFromExtraction(
    result,
    GIA2527039693_PDF_TEXT_LAYER,
  );
  assert.equal(provenance.pavilionAngle?.extractionClass, "EXACT_TEXT");
  assert.equal(provenance.girdle?.extractionClass, "EXACT_TEXT");
});

test("mergeValueProvenance preserves extraction when unchanged", () => {
  const fields = emptyReportFields({ tablePercent: "57" });
  const merged = mergeValueProvenanceOnSave({
    approvedFields: fields,
    extractedFields: fields,
  });
  assert.equal(merged.tablePercent, "extracted");
});
