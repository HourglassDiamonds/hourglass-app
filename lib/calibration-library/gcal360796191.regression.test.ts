import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import { detectReportFamily } from "./parsers/router";
import {
  diagnoseGcalSarineProportionExtraction,
  extractGcalSarine4csGradingFields,
  extractGcalSarineProportionIslands,
  hasSarineColumnListSignature,
  looksLikeGcalSarine4csReportText,
  mapSarineColumnListGrading,
  probeSarineFinishFromTextLayer,
} from "./gcal-sarine-4cs";
import {
  GCAL360796191_DIAGRAM_OCR,
  GCAL360796191_DIAGRAM_OCR_LIVE_GARBLED,
  GCAL360796191_FINISH_OCR,
  GCAL360796191_EXPECTED,
  GCAL360796191_REPORT_NUMBER,
  GCAL360796191_TEXT_LAYER,
  GCAL360796191_TEXT_LAYER_INLINE,
} from "./fixtures/gcal360796191";
import { GCAL353466126_OCR_MULTILINE } from "./fixtures/gcal353466126";

function assertGcalSarineExpected(
  fields: ReturnType<typeof extractFieldsFromReportText>["fields"],
  gcalInternal: ReturnType<typeof extractFieldsFromReportText>["gcalInternal"],
  parserType: string | undefined,
) {
  const e = GCAL360796191_EXPECTED;
  assert.equal(parserType, e.parserType);
  assert.equal(fields.shape, e.shape);
  assert.equal(fields.carat, e.carat);
  assert.equal(fields.measurements, e.measurements);
  assert.equal(fields.fluorescence, e.fluorescence);
  assert.equal(fields.girdle, e.girdle);
  assert.equal(fields.culet, e.culet);
  assert.equal(fields.tablePercent, e.tablePercent);
  assert.equal(fields.depthPercent, e.depthPercent);
  assert.equal(fields.crownAngle, e.crownAngle);
  assert.equal(fields.pavilionAngle, e.pavilionAngle);
  assert.equal(fields.starLengthPercent, e.starLengthPercent);
  assert.equal(fields.lowerHalfPercent, e.lowerHalfPercent);
  assert.equal(gcalInternal?.crownHeightPercent, e.crownHeightPercent);
  assert.equal(gcalInternal?.pavilionDepthPercent, e.pavilionDepthPercent);
  assert.equal(gcalInternal?.girdleThicknessPercent, e.girdleThicknessPercent);
  assert.equal(gcalInternal?.culetSizeMm, e.culetSizeMm);
}

describe("GCAL Sarine 4Cs LG360796191", () => {
  it("routes to gcal-sarine-4cs with column-list signature", () => {
    assert.equal(hasSarineColumnListSignature(GCAL360796191_TEXT_LAYER), true);
    const family = detectReportFamily(GCAL360796191_TEXT_LAYER, { lab: "GCAL" });
    assert.equal(family.parserType, "gcal-sarine-4cs");
  });

  it("detects Sarine layout markers", () => {
    assert.equal(looksLikeGcalSarine4csReportText(GCAL360796191_TEXT_LAYER), true);
    assert.equal(looksLikeGcalSarine4csReportText(GCAL353466126_OCR_MULTILINE), false);
  });

  it("maps grading by column-list order (labels then values)", () => {
    const values = [
      "GCAL LG360796191",
      "Lab Grown Diamond",
      "Round Brilliant",
      "6.43 - 6.46 x 3.94 mm",
      "GCAL LG360796191",
      "None",
      "Medium to Sl. Thick, Faceted",
      "None",
      "LAB GROWN DIAMOND",
      "HPHT",
    ];
    const grading = mapSarineColumnListGrading(values);
    const e = GCAL360796191_EXPECTED;
    assert.equal(grading.reportNumber, e.reportNumber);
    assert.equal(grading.shape, e.shape);
    assert.equal(grading.measurements, e.measurements);
    assert.equal(grading.fluorescence, e.fluorescence);
    assert.equal(grading.girdle, e.girdle);
    assert.equal(grading.culet, e.culet);
    assert.notEqual(grading.shape, "Measurements");
    assert.notEqual(grading.girdle, "Culet");
    assert.notEqual(grading.culet, "Inscription");
    assert.notEqual(grading.fluorescence, "Girdle");
  });

  it("extracts grading fields from column-list text layer + header carat", () => {
    const grading = extractGcalSarine4csGradingFields(GCAL360796191_TEXT_LAYER);
    const e = GCAL360796191_EXPECTED;
    assert.equal(grading.reportNumber, e.reportNumber);
    assert.equal(grading.shape, e.shape);
    assert.equal(grading.carat, e.carat);
    assert.equal(grading.measurements, e.measurements);
    assert.equal(grading.fluorescence, e.fluorescence);
    assert.equal(grading.girdle, e.girdle);
    assert.equal(grading.culet, e.culet);
  });

  it("extracts grading fields from inline label/value text layer", () => {
    const grading = extractGcalSarine4csGradingFields(
      GCAL360796191_TEXT_LAYER_INLINE,
    );
    const e = GCAL360796191_EXPECTED;
    assert.equal(grading.shape, e.shape);
    assert.equal(grading.measurements, e.measurements);
    assert.equal(grading.fluorescence, e.fluorescence);
    assert.equal(grading.girdle, e.girdle);
    assert.equal(grading.culet, e.culet);
  });

  it("diagnoses proportion assignment from collapsed diagram OCR fixture", () => {
    const diag = diagnoseGcalSarineProportionExtraction(GCAL360796191_DIAGRAM_OCR);
    const e = GCAL360796191_EXPECTED;
    assert.equal(diag.assignedProportionFields.tablePercent, e.tablePercent);
    assert.equal(diag.assignedProportionFields.depthPercent, e.depthPercent);
    assert.ok(diag.numericCandidates.percents.length > 0);
    assert.ok(diag.repairedOcrTextPreview.length > 0);
  });

  it("finish grades are absent from Sarine text-layer fixture", () => {
    const finish = probeSarineFinishFromTextLayer(GCAL360796191_TEXT_LAYER);
    assert.equal(finish.foundInTextLayer, false);
  });

  it("extracts proportion islands from collapsed diagram OCR", () => {
    const islands = extractGcalSarineProportionIslands(GCAL360796191_DIAGRAM_OCR);
    const e = GCAL360796191_EXPECTED;
    assert.equal(islands.tablePercent, e.tablePercent);
    assert.equal(islands.depthPercent, e.depthPercent);
    assert.equal(islands.crownAngle, e.crownAngle);
    assert.equal(islands.pavilionAngle, e.pavilionAngle);
    assert.equal(islands.starLengthPercent, e.starLengthPercent);
    assert.equal(islands.lowerHalfPercent, e.lowerHalfPercent);
    assert.equal(islands.crownHeightPercent, e.crownHeightPercent);
    assert.equal(islands.pavilionDepthPercent, e.pavilionDepthPercent);
    assert.equal(islands.girdleThicknessPercent, e.girdleThicknessPercent);
    assert.equal(islands.culetSizeMm, e.culetSizeMm);
  });

  it("repairs live garbled lower-half OCR (1 7 7) to 77%", () => {
    const islands = extractGcalSarineProportionIslands(
      GCAL360796191_DIAGRAM_OCR_LIVE_GARBLED,
    );
    const e = GCAL360796191_EXPECTED;
    assert.equal(islands.tablePercent, e.tablePercent);
    assert.equal(islands.depthPercent, e.depthPercent);
    assert.equal(islands.crownAngle, e.crownAngle);
    assert.equal(islands.pavilionAngle, e.pavilionAngle);
    assert.equal(islands.lowerHalfPercent, e.lowerHalfPercent);
  });

  it("parses full Sarine report text + diagram OCR", () => {
    const text = `${GCAL360796191_TEXT_LAYER}\n${GCAL360796191_DIAGRAM_OCR}`;
    const result = extractFieldsFromReportText(text, {
      lab: "GCAL",
      textMethod: "pdf-text",
      reportNumber: GCAL360796191_REPORT_NUMBER,
    });
    assertGcalSarineExpected(
      result.fields,
      result.gcalInternal,
      result.parserType,
    );
  });

  it("parses finish grades from Sarine finish-panel OCR text", () => {
    const text = `${GCAL360796191_TEXT_LAYER}\n${GCAL360796191_DIAGRAM_OCR}\n${GCAL360796191_FINISH_OCR}`;
    const result = extractFieldsFromReportText(text, {
      lab: "GCAL",
      textMethod: "pdf-text",
      reportNumber: GCAL360796191_REPORT_NUMBER,
    });
    assert.equal(result.fields.polish, "Excellent");
    assert.equal(result.fields.symmetry, "Excellent");
    assert.equal(result.fields.cutGrade, "Excellent");
  });
});
