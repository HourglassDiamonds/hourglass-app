import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  GIA2527039693_EXPECTED,
  GIA2527039693_FACSIMILE_PDF_TEXT,
  GIA2527039693_FACSIMILE_PLUS_OCR,
  GIA2527039693_INLINE_DIAGRAM,
  GIA2527039693_OCR_MULTILINE,
  GIA2527039693_OCR_TEXT,
  GIA2527039693_OCR_GIRDLE_SPLIT,
  GIA2527039693_OCR_PAVILION_40_8H,
  GIA2527039693_OCR_PAVILION_40BH,
  GIA2527039693_OCR_PAVILION_4O8H,
  GIA2527039693_OCR_PAVILION_DEPTH_BEFORE_ANGLE,
  GIA2527039693_PDF_TEXT_LAYER,
  GIA2527039693_WRONG_PROPORTIONS_HEADER,
} from "./fixtures/gia2527039693";
import {
  extractGiaGirdleFromFacsimileGradingResultsFragment,
  extractGiaProportionBlock,
  fixGiaOcrDegreeNumerals,
  giaProportionValuesPresent,
  needsGiaProportionOcrSupplement,
} from "./gia-proportions";
import { REPORT_FIELD_KEYS } from "./types";

function assertGia2527039693(result: ReturnType<typeof extractFieldsFromReportText>) {
  const { fields, giaInternal, metadata } = result;
  const e = GIA2527039693_EXPECTED;

  assert.equal(metadata.lab, "GIA");
  assert.equal(metadata.reportNumber, e.reportNumber);
  assert.equal(fields.shape, e.shape);
  assert.equal(fields.carat, e.carat);
  assert.match(fields.measurements.toLowerCase(), /7\.84.*7\.88.*4\.96.*mm/);
  assert.equal(fields.tablePercent, e.tablePercent);
  assert.equal(fields.depthPercent, e.depthPercent);
  assert.equal(fields.crownAngle, e.crownAngle);
  assert.equal(fields.pavilionAngle, e.pavilionAngle);
  assert.equal(fields.lowerHalfPercent, e.lowerHalfPercent);
  assert.equal(fields.starLengthPercent, e.starLengthPercent);
  assert.equal(fields.girdle, e.girdle);
  assert.equal(fields.culet, e.culet);
  assert.equal(fields.polish, e.polish);
  assert.equal(fields.symmetry, e.symmetry);
  assert.equal(fields.fluorescence, e.fluorescence);
  assert.equal(fields.cutGrade, e.cutGrade);
  assert.equal(giaInternal?.crownHeightPercent, e.crownHeightPercent);
  assert.equal(giaInternal?.pavilionDepthPercent, e.pavilionDepthPercent);

  for (const key of REPORT_FIELD_KEYS) {
    assert.equal(
      typeof fields[key],
      "string",
      `fields.${key} must be a string in extraction payload`,
    );
  }
}

describe("GIA 2527039693 regression", () => {
  it("parses multiline GIA proportion diagram stack", () => {
    assertGia2527039693(
      extractFieldsFromReportText(GIA2527039693_OCR_MULTILINE, {
        textMethod: "ocr",
      }),
    );
  });

  it("parses PDF text layer with label/value on separate lines", () => {
    assertGia2527039693(
      extractFieldsFromReportText(GIA2527039693_PDF_TEXT_LAYER, {
        textMethod: "pdf-text",
        reportNumber: "2527039693",
      }),
    );
  });

  it("parses inline GIA diagram and finish grades", () => {
    assertGia2527039693(
      extractFieldsFromReportText(GIA2527039693_INLINE_DIAGRAM, {
        textMethod: "pdf-text",
      }),
    );
  });

  it("parses facsimile dot-leader grading table without diagram text", () => {
    assert.equal(giaProportionValuesPresent(GIA2527039693_FACSIMILE_PDF_TEXT), false);
    assert.equal(
      needsGiaProportionOcrSupplement(GIA2527039693_FACSIMILE_PDF_TEXT),
      true,
    );

    const result = extractFieldsFromReportText(GIA2527039693_FACSIMILE_PDF_TEXT, {
      textMethod: "pdf-text",
      reportNumber: "2527039693",
    });
    const { fields } = result;
    const e = GIA2527039693_EXPECTED;

    assert.equal(fields.shape, e.shape);
    assert.equal(fields.carat, e.carat);
    assert.match(fields.measurements.toLowerCase(), /7\.84.*7\.88.*4\.96.*mm/);
    assert.equal(fields.polish, e.polish);
    assert.equal(fields.symmetry, e.symmetry);
    assert.equal(fields.fluorescence, e.fluorescence);
    assert.equal(fields.cutGrade, e.cutGrade);
    assert.equal(fields.tablePercent, "");
    assert.equal(fields.crownAngle, "");
  });

  it("parses facsimile grading table plus OCR proportion lines", () => {
    assertGia2527039693(
      extractFieldsFromReportText(GIA2527039693_FACSIMILE_PLUS_OCR, {
        textMethod: "ocr",
        reportNumber: "2527039693",
      }),
    );
  });

  it("parses live-style GIA OCR text with scattered diagram proportions", () => {
    assertGia2527039693(
      extractFieldsFromReportText(GIA2527039693_OCR_TEXT, {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      }),
    );
  });

  function assertGia2527039693DiagramFields(
    result: ReturnType<typeof extractFieldsFromReportText>,
  ) {
    const e = GIA2527039693_EXPECTED;
    assert.notEqual(result.fields.pavilionAngle, "43");
    assert.equal(result.fields.pavilionAngle, e.pavilionAngle);
    assert.equal(result.giaInternal?.pavilionDepthPercent, e.pavilionDepthPercent);
    assert.equal(result.fields.girdle, e.girdle);
    assert.equal(result.fields.tablePercent, e.tablePercent);
    assert.equal(result.fields.depthPercent, e.depthPercent);
    assert.equal(result.fields.crownAngle, e.crownAngle);
    assert.equal(result.fields.lowerHalfPercent, e.lowerHalfPercent);
    assert.equal(result.fields.starLengthPercent, e.starLengthPercent);
    assert.equal(result.fields.culet, e.culet);
  }

  it("parses OCR pavilion angle 4O.8 H corruption", () => {
    assertGia2527039693DiagramFields(
      extractFieldsFromReportText(GIA2527039693_OCR_PAVILION_4O8H, {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      }),
    );
  });

  it("parses OCR pavilion angle 40,8 H corruption", () => {
    assertGia2527039693DiagramFields(
      extractFieldsFromReportText(GIA2527039693_OCR_PAVILION_40_8H, {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      }),
    );
  });

  it("parses OCR pavilion angle 40.B H corruption", () => {
    assertGia2527039693DiagramFields(
      extractFieldsFromReportText(GIA2527039693_OCR_PAVILION_40BH, {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      }),
    );
  });

  it("stitches split multiline girdle OCR with faceted on separate line", () => {
    assertGia2527039693DiagramFields(
      extractFieldsFromReportText(GIA2527039693_OCR_GIRDLE_SPLIT, {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      }),
    );
  });

  it("does not assign pavilion depth % to pavilionAngle when depth precedes angle in OCR", () => {
    const result = extractFieldsFromReportText(
      GIA2527039693_OCR_PAVILION_DEPTH_BEFORE_ANGLE,
      {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      },
    );
    assertGia2527039693DiagramFields(result);
  });

  it("selects diagram block over report-header PROPORTIONS shell", () => {
    const block = extractGiaProportionBlock(GIA2527039693_WRONG_PROPORTIONS_HEADER);
    assert.match(block, /Crown\s+Angle/i);
    assert.match(block, /36\.5/);
    assert.doesNotMatch(block, /CLARITY\s+CHARACTERISTICS/i);
    assert.doesNotMatch(block, /GIA\s+NATURAL\s+DIAMOND\s+GRADING\s+REPORT/i);

    assertGia2527039693(
      extractFieldsFromReportText(GIA2527039693_WRONG_PROPORTIONS_HEADER, {
        textMethod: "ocr",
        reportNumber: "2527039693",
        lab: "GIA",
      }),
    );
  });

  it("parses pavilion from depth-then-angle OCR order (40.8 =)", () => {
    const text = fixGiaOcrDegreeNumerals("43.0% 40.8 = 6 FLAWLESS");
    const result = extractFieldsFromReportText(text, {
      textMethod: "ocr",
      reportNumber: "2527039693",
      lab: "GIA",
    });
    assert.equal(result.fields.pavilionAngle, "40.8");
  });

  it("parses girdle from facsimile GRADING RESULTS (faceted) + next-line 3.5%", () => {
    const text = `GRADING RESULTS (faceted) 43.0% z FLAWLESS
3.5% = H .`;
    const girdle = extractGiaGirdleFromFacsimileGradingResultsFragment(text);
    assert.equal(girdle, null);
    const withThickness = `GRADING RESULTS
Medium - Slightly Thick (Faceted)
3.5%`;
    assert.equal(
      extractGiaGirdleFromFacsimileGradingResultsFragment(withThickness),
      "Medium - Slightly Thick (Faceted) 3.5%",
    );
  });
});
