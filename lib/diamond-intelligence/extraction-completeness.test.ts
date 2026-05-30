import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CalibrationReportFields,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { REPORT_FIELD_KEYS } from "@/lib/calibration-library/types";
import { assessExtractionCompleteness } from "./extraction-completeness";

function fields(
  overrides: Partial<Record<ReportFieldKey, string>>,
): CalibrationReportFields {
  const base = Object.fromEntries(
    REPORT_FIELD_KEYS.map((k) => [k, ""]),
  ) as CalibrationReportFields;
  return { ...base, ...overrides };
}

const IGI_FULL = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.50 - 6.53 x 4.01",
  tablePercent: "59",
  depthPercent: "61.7",
  crownAngle: "33.2",
  pavilionAngle: "41.7",
  girdle: "Medium to Slightly Thick (Faceted)",
  culet: "Pointed",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
  cutGrade: "Excellent",
});

const GIA_LGDR_CLIENT_LIKE = fields({
  shape: "Round",
  carat: "1.52",
  measurements: "7.40 - 7.44 x 4.62",
  polish: "Excellent",
  symmetry: "Excellent",
  fluorescence: "None",
  girdle: "Medium to Slightly Thick (Faceted)",
  culet: "None",
});

const GCAL_PARTIAL = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.40 - 6.44 x 3.95",
  girdle: "Thin, Faceted",
  culet: "None",
  polish: "Excellent",
});

const GCAL_TABLE_DEPTH_ONLY = fields({
  shape: "Round",
  carat: "1.00",
  measurements: "6.40 - 6.44 x 3.95",
  tablePercent: "57",
  depthPercent: "60.6",
});

describe("assessExtractionCompleteness", () => {
  it("IGI full anchor → FULL_EXTRACTION, scoreEligible", () => {
    const c = assessExtractionCompleteness({ fields: IGI_FULL });
    assert.equal(c.extractionState, "FULL_EXTRACTION");
    assert.equal(c.coreFieldCount, 4);
    assert.equal(c.scoreEligible, true);
    assert.equal(c.graphEligible, true);
    assert.equal(c.traitEligible, true);
  });

  it("GIA 2496027047-like client payload → REPORT_ONLY, not scoreEligible", () => {
    const c = assessExtractionCompleteness({ fields: GIA_LGDR_CLIENT_LIKE });
    assert.equal(c.extractionState, "REPORT_ONLY");
    assert.equal(c.coreFieldCount, 0);
    assert.equal(c.scoreEligible, false);
    assert.equal(c.hasOnlyReportMetadata, true);
  });

  it("GCAL identity + girdle/culet only → REPORT_ONLY, not scoreEligible", () => {
    const c = assessExtractionCompleteness({ fields: GCAL_PARTIAL });
    assert.equal(c.extractionState, "REPORT_ONLY");
    assert.equal(c.scoreEligible, false);
  });

  it("table + depth only → PARTIAL_EXTRACTION, not scoreEligible", () => {
    const c = assessExtractionCompleteness({ fields: GCAL_TABLE_DEPTH_ONLY });
    assert.equal(c.extractionState, "PARTIAL_EXTRACTION");
    assert.equal(c.coreFieldCount, 2);
    assert.equal(c.scoreEligible, false);
    assert.equal(c.guidedCompletionEligible, true);
  });

  it("render failure → EXTRACTION_ERROR", () => {
    const c = assessExtractionCompleteness({
      fields: GIA_LGDR_CLIENT_LIKE,
      renderAudit: {
        rendererUsed: "production-napi-root",
        pageCount: 1,
        renderSuccess: false,
        renderTimingMs: 100,
        imageDimensions: null,
        pngBytes: null,
        ocrReadiness: "failed",
        ocrProbeChars: null,
        ocrProbeMs: null,
        failureReason: "paintChar",
        failureStack: null,
      },
    });
    assert.equal(c.extractionState, "EXTRACTION_ERROR");
    assert.equal(c.scoreEligible, false);
  });
});
