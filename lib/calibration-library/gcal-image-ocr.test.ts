import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "./fields";
import { needsGcalImageRegionOcrFallback, shouldRunGcalImageRegionOcr } from "./gcal-image-ocr";

describe("GCAL image-region OCR fallback gate", () => {
  it("triggers for gcal-8x when proportion fields are missing", () => {
    const fields = emptyReportFields();
    fields.shape = "Round Brilliant";
    fields.tablePercent = "58";
    assert.equal(
      needsGcalImageRegionOcrFallback(fields, { parserType: "gcal-8x" }),
      true,
    );
  });

  it("triggers for GCAL lab when finish grades are missing", () => {
    const fields = emptyReportFields();
    fields.depthPercent = "61.1";
    fields.crownAngle = "34.5";
    fields.pavilionAngle = "40.8";
    assert.equal(
      needsGcalImageRegionOcrFallback(fields, { lab: "GCAL" }),
      true,
    );
  });

  it("does not trigger when all target fields are present", () => {
    const fields = emptyReportFields();
    fields.depthPercent = "61.1";
    fields.crownAngle = "34.5";
    fields.pavilionAngle = "40.8";
    fields.girdle = "Medium, Faceted";
    fields.polish = "Excellent";
    fields.symmetry = "Excellent";
    fields.cutGrade = "Excellent";
    assert.equal(
      needsGcalImageRegionOcrFallback(fields, { parserType: "gcal-8x" }),
      false,
    );
  });

  it("always runs for image-only GCAL PDFs even when some fields exist", () => {
    const fields = emptyReportFields();
    fields.depthPercent = "61.1";
    fields.crownAngle = "34.5";
    fields.pavilionAngle = "40.8";
    fields.girdle = "Medium, Faceted";
    fields.polish = "Excellent";
    fields.symmetry = "Excellent";
    fields.cutGrade = "Excellent";
    assert.equal(
      shouldRunGcalImageRegionOcr(fields, {
        parserType: "gcal-8x",
        gcalImageOnlyPdf: true,
      }),
      true,
    );
  });

  it("does not trigger for non-GCAL labs", () => {
    const fields = emptyReportFields();
    assert.equal(
      needsGcalImageRegionOcrFallback(fields, { lab: "GIA" }),
      false,
    );
  });

  it("runs for gcal-8x image uploads when proportion fields are missing", () => {
    const fields = emptyReportFields();
    fields.shape = "Round Brilliant";
    assert.equal(
      shouldRunGcalImageRegionOcr(fields, {
        parserType: "gcal-8x",
        lab: "GCAL",
        combinedText: "GCAL 8X LG360196394",
      }),
      true,
    );
  });
});
