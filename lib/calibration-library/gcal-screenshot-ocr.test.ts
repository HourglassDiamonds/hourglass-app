import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  GCAL353466126_EXPECTED,
  GCAL353466126_LIVE_OCR_SOUP,
  GCAL353466126_REPORT_NUMBER,
  GCAL353466126_SCREENSHOT_OCR,
} from "./fixtures/gcal353466126";
import {
  repairGcalScreenshotOcrText,
  shouldRepairGcalScreenshotOcrText,
} from "./parsers/gcal/gcal-screenshot-ocr";

describe("GCAL screenshot OCR normalization", () => {
  it("repairs collapsed screenshot measurements and diagram numerics", () => {
    const { text, repairsApplied } = repairGcalScreenshotOcrText(
      "Measurements 798-801x488 mm Table 58 Depth 611 Crown 345 Pavilion 108",
    );
    assert.match(text, /7\.98\s*-\s*8\.01\s*x\s*4\.88\s*mm/i);
    assert.match(text, /61\.1%/);
    assert.match(text, /34\.5°/);
    assert.ok(
      repairsApplied.some((r) => r.includes("798-801x488")),
      "expected measurement repair",
    );
    assert.ok(
      repairsApplied.some((r) => r.includes("611")),
      "expected depth repair",
    );
    assert.ok(
      repairsApplied.some((r) => r.includes("345")),
      "expected crown repair",
    );
    assert.equal(
      repairsApplied.some((r) => r.includes("108")),
      false,
      "pavilion 108 must not repair without 408 evidence",
    );
  });

  it("repairs pavilion 108 only when 408 context is present", () => {
    const { text, repairsApplied } = repairGcalScreenshotOcrText(
      "Table 58 Depth 611 Crown 345 Pavilion 108 408 Star 48 Lower 77",
    );
    assert.match(text, /40\.8°/);
    assert.ok(
      repairsApplied.some((r) => r.includes("108") || r.includes("408")),
    );
  });

  it("does not apply screenshot repair on PDF upload path", () => {
    assert.equal(
      shouldRepairGcalScreenshotOcrText(GCAL353466126_LIVE_OCR_SOUP, {
        reportSource: "pdf-upload",
        textMethod: "pdf-text",
        lab: "GCAL",
        pdfTextLayerLength: 500,
      }),
      false,
    );
  });

  it("extracts LG353466126 fields from screenshot OCR fixture", () => {
    const result = extractFieldsFromReportText(GCAL353466126_SCREENSHOT_OCR, {
      lab: "GCAL",
      reportSource: "screenshot-upload",
      textMethod: "ocr",
      reportNumber: GCAL353466126_REPORT_NUMBER,
      pdfTextLayerLength: 0,
    });
    const e = GCAL353466126_EXPECTED;
    assert.equal(result.parserType, e.parserType);
    assert.equal(result.fields.shape, e.shape);
    assert.equal(result.fields.carat, e.carat);
    assert.match(result.fields.measurements, /7\.98.*8\.01.*4\.88.*mm/i);
    assert.equal(result.fields.tablePercent, e.tablePercent);
    assert.equal(result.fields.depthPercent, e.depthPercent);
    assert.equal(result.fields.crownAngle, e.crownAngle);
    assert.equal(result.fields.starLengthPercent, e.starLengthPercent);
    assert.equal(result.fields.lowerHalfPercent, e.lowerHalfPercent);
    assert.equal(result.fields.polish, e.polish);
    assert.equal(result.fields.symmetry, e.symmetry);
    assert.equal(result.fields.cutGrade, e.cutGrade);
    assert.equal(result.fields.fluorescence, e.fluorescence);
    assert.equal(result.fields.girdle, e.girdle);
    assert.equal(result.fields.culet, e.culet);
    assert.equal(result.fields.pavilionAngle, e.pavilionAngle);
  });

  it("leaves pavilion angle missing when 108 has no 408 evidence", () => {
    const collapsed = `
GCAL 8X
GCAL LG353466126 RB 191
Table 58 Depth 611 Crown 345 Pavilion Angle 108
`;
    const result = extractFieldsFromReportText(collapsed, {
      lab: "GCAL",
      reportSource: "screenshot-upload",
      textMethod: "ocr",
      reportNumber: GCAL353466126_REPORT_NUMBER,
    });
    assert.equal(result.fields.pavilionAngle, "");
  });
});
