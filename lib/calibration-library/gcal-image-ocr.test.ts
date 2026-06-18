import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportFields } from "./fields";
import {
  GCAL_8X_IMAGE_ONLY_PROBE_CROP,
  needsGcalImageRegionOcrFallback,
  shouldRunGcalImageRegionOcr,
} from "./gcal-image-ocr";
import { looksLikeGcal8xCertificateProbeText, looksLikeGcal8xReportText } from "./parsers/gcal/gcal-layout-detector";
import { detectReportFamily } from "./parsers/router";

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

describe("GCAL 8X image-only PDF certificate probe", () => {
  const PROBE_OCR =
    "diamonds achieve EXCELLENT grades in all EIGHT Ultimate Diamond Cut Grade\nGCAL LG353306143 RB 3.24 EVVS2";

  it("matches certificate header probe text", () => {
    assert.equal(looksLikeGcal8xCertificateProbeText(PROBE_OCR), true);
    assert.equal(looksLikeGcal8xCertificateProbeText(""), false);
    assert.equal(looksLikeGcal8xCertificateProbeText("GIA Report Number 6233708773"), false);
  });

  it("requires 8X layout markers for image-only probe gate", () => {
    assert.equal(
      looksLikeGcal8xCertificateProbeText("GCAL LG360796191") &&
        looksLikeGcal8xReportText("GCAL LG360796191"),
      false,
    );
  });

  it("routes gcal-8x on image-only hint with probe text only", () => {
    const family = detectReportFamily(PROBE_OCR, { gcalImageOnlyPdf: true });
    assert.equal(family.lab, "GCAL");
    assert.equal(family.parserType, "gcal-8x");
  });

  it("does not route gcal-8x on empty text even with image-only hint", () => {
    const family = detectReportFamily("", { gcalImageOnlyPdf: true });
    assert.notEqual(family.parserType, "gcal-8x");
    assert.notEqual(family.lab, "GCAL");
  });

  it("exports HEADER_TINY probe crop coordinates", () => {
    assert.equal(GCAL_8X_IMAGE_ONLY_PROBE_CROP.left, 0.45);
    assert.equal(GCAL_8X_IMAGE_ONLY_PROBE_CROP.top, 0.08);
  });
});
