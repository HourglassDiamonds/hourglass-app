import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectReportFamily } from "./parsers/router";
import { hasSarineColumnListSignature } from "./gcal-sarine-4cs";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  GCAL353466126_EXPECTED,
  GCAL353466126_LIVE_OCR_SOUP,
  GCAL353466126_MARKETING_TRAP,
  GCAL353466126_OCR_MULTILINE,
  GCAL353466126_REPORT_NUMBER,
} from "./fixtures/gcal353466126";

function assertGcal353466126(
  result: ReturnType<typeof extractFieldsFromReportText>,
) {
  const { fields, gcalInternal, metadata, parserType, parserConfidence } =
    result;
  const e = GCAL353466126_EXPECTED;

  assert.equal(metadata.lab, "GCAL");
  assert.equal(metadata.reportNumber, e.reportNumber);
  assert.equal(parserType, e.parserType);
  assert.equal(parserConfidence, e.parserConfidence);

  assert.equal(fields.shape, e.shape);
  assert.equal(fields.carat, e.carat);
  assert.match(fields.measurements, /7\.98.*8\.01.*4\.88.*mm/i);
  assert.equal(fields.fluorescence, e.fluorescence);
  assert.equal(fields.tablePercent, e.tablePercent);
  assert.equal(fields.depthPercent, e.depthPercent);
  assert.equal(fields.crownAngle, e.crownAngle);
  assert.equal(fields.pavilionAngle, e.pavilionAngle);
  assert.equal(fields.starLengthPercent, e.starLengthPercent);
  assert.equal(fields.lowerHalfPercent, e.lowerHalfPercent);
  assert.equal(fields.girdle, e.girdle);
  assert.equal(fields.polish, e.polish);
  assert.equal(fields.symmetry, e.symmetry);
  assert.equal(fields.cutGrade, e.cutGrade);
  assert.equal(fields.culet, e.culet);

  assert.equal(gcalInternal?.crownHeightPercent, e.crownHeightPercent);
  assert.equal(gcalInternal?.pavilionDepthPercent, e.pavilionDepthPercent);
  assert.equal(gcalInternal?.girdleThicknessPercent, e.girdleThicknessPercent);
  assert.equal(gcalInternal?.culetSizeMm, e.culetSizeMm);

  assert.doesNotMatch(fields.shape, /grade/i);
  assert.doesNotMatch(fields.polish, /fingerprint/i);
  assert.doesNotMatch(fields.symmetry, /inscription/i);
  assert.doesNotMatch(fields.cutGrade, /certification|assuran/i);
}

describe("GCAL 8X LG353466126 regression", () => {
  it("routes to gcal-8x (not Sarine) for multiline and live OCR layouts", () => {
    for (const text of [
      GCAL353466126_OCR_MULTILINE,
      GCAL353466126_LIVE_OCR_SOUP,
      GCAL353466126_MARKETING_TRAP,
    ]) {
      const family = detectReportFamily(text, { lab: "GCAL" });
      assert.equal(family.parserType, "gcal-8x", `expected gcal-8x for ${text.slice(0, 40)}`);
      assert.equal(hasSarineColumnListSignature(text), false);
    }
  });

  it("parses structured multiline OCR via grading and proportion islands", () => {
    assertGcal353466126(
      extractFieldsFromReportText(GCAL353466126_OCR_MULTILINE, {
        textMethod: "ocr",
        reportNumber: GCAL353466126_REPORT_NUMBER,
        lab: "GCAL",
      }),
    );
  });

  it("parses live flattened OCR soup via islands", () => {
    assertGcal353466126(
      extractFieldsFromReportText(GCAL353466126_LIVE_OCR_SOUP, {
        textMethod: "ocr",
        reportNumber: GCAL353466126_REPORT_NUMBER,
        lab: "GCAL",
      }),
    );
  });

  it("rejects marketing copy traps after diagram", () => {
    assertGcal353466126(
      extractFieldsFromReportText(GCAL353466126_MARKETING_TRAP, {
        textMethod: "ocr",
        lab: "GCAL",
        reportNumber: GCAL353466126_REPORT_NUMBER,
      }),
    );
  });
});
