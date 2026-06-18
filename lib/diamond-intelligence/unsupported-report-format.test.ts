import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GCAL353466126_OCR_MULTILINE } from "@/lib/calibration-library/fixtures/gcal353466126";
import { GCAL_SARINE_LG340946327_OCR_TEXT } from "@/lib/calibration-library/fixtures/gcal-sarine-lg340946327";
import {
  assessClientReportFormatSupport,
  looksLikeGcalStandardReportText,
} from "./unsupported-report-format";
import { resolveArchiveStatus } from "./submission-archive";

const STANDARD_GCAL_LG352146193 = `
Gem Certification & Assurance Lab
Certificate No. LG352146193
Diamond Grading Analysis
Lab Grown Diamond
Shape Round Brilliant
Physical Symmetry Excellent
Optical Brilliance Excellent
Optical Symmetry Very Good
Depth % 59.5%
Table % 59%
Crown Angle 33.0°
Pavilion Angle 40.4°
`;

const GIA_SNIPPET = `
GIA
Gemological Institute of America
GIA Report 1234567890
Round Brilliant
Table 57%
Depth 61.5%
Crown Angle 34.5°
Pavilion Angle 40.8°
`;

describe("unsupported-report-format", () => {
  it("flags standard GCAL Diamond Grading Analysis as unsupported", () => {
    assert.equal(looksLikeGcalStandardReportText(STANDARD_GCAL_LG352146193), true);
    const result = assessClientReportFormatSupport(STANDARD_GCAL_LG352146193);
    assert.equal(result.status, "unsupported");
    if (result.status === "unsupported") {
      assert.equal(result.match.family, "gcal-standard");
    }
  });

  it("flags GCAL BY SARINE as unsupported", () => {
    const result = assessClientReportFormatSupport(GCAL_SARINE_LG340946327_OCR_TEXT);
    assert.equal(result.status, "unsupported");
    if (result.status === "unsupported") {
      assert.equal(result.match.family, "gcal-sarine-4cs");
    }
  });

  it("allows GCAL 8X fixture as supported", () => {
    const result = assessClientReportFormatSupport(GCAL353466126_OCR_MULTILINE);
    assert.equal(result.status, "supported");
  });

  it("allows explicit GIA report as supported", () => {
    const result = assessClientReportFormatSupport(GIA_SNIPPET);
    assert.equal(result.status, "supported");
  });

  it("flags HRD as unsupported", () => {
    const result = assessClientReportFormatSupport(
      "HRD Antwerp Diamond Report 12345 Round Brilliant",
    );
    assert.equal(result.status, "unsupported");
    if (result.status === "unsupported") {
      assert.equal(result.match.family, "hrd");
    }
  });

  it("flags EGL as unsupported", () => {
    const result = assessClientReportFormatSupport(
      "EGL European Gemological Laboratory report",
    );
    assert.equal(result.status, "unsupported");
  });

  it("defers GCAL certificate probe text to the full pipeline (8X image-only)", () => {
    const result = assessClientReportFormatSupport("GCAL LG353306143");
    assert.equal(result.status, "unknown");
  });

  it("returns unknown for empty text", () => {
    assert.equal(assessClientReportFormatSupport("").status, "unknown");
  });

  it("maps archive status to unsupported_report_format", () => {
    const status = resolveArchiveStatus({
      httpStatus: 422,
      earlyFailure: {
        reason: "unsupported_report_format",
        message: "unsupported",
        unsupportedFormatFamily: "gcal-standard",
      },
    });
    assert.equal(status, "unsupported_report_format");
  });
});
