import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  LG773657228_EXPECTED,
  LG773657228_OCR_DUPLICATE_TABLE_PCT,
  LG773657228_OCR_GIRDLE_LEAK,
  LG773657228_OCR_INLINE_NO_STAR_PCT,
  LG773657228_OCR_MULTILINE,
  LG773657228_OCR_TRUNCATED_FACETED,
  LG773657228_PDF_TEXT_ORDER,
  LG773657228_GRADING_EXPECTED,
  LG773657228_WITH_HEADER,
} from "./fixtures/lg773657228";
import { REPORT_FIELD_KEYS } from "./types";

function assertLg773657228(result: ReturnType<typeof extractFieldsFromReportText>) {
  const { fields, igiInternal, metadata } = result;
  const e = LG773657228_EXPECTED;

  assert.equal(metadata.reportNumber, e.reportNumber);
  assert.equal(metadata.lab, "IGI");
  assert.equal(fields.tablePercent, e.tablePercent);
  assert.equal(fields.crownAngle, e.crownAngle);
  assert.equal(fields.pavilionAngle, e.pavilionAngle);
  assert.equal(fields.starLengthPercent, e.starLengthPercent);
  assert.equal(fields.lowerHalfPercent, e.lowerHalfPercent);
  assert.equal(fields.depthPercent, e.depthPercent);
  assert.equal(fields.culet, e.culet);
  assert.equal(fields.girdle, e.girdle);
  assert.equal(igiInternal?.pavilionDepthPercent, e.pavilionDepthPercent);

  if (e.measurements && fields.measurements.trim()) {
    assert.match(fields.measurements.toLowerCase(), /8\.01.*8\.05.*4\.84.*mm/);
  }
}

describe("IGI LG773657228 regression", () => {
  it("parses multiline OCR proportion stack", () => {
    assertLg773657228(
      extractFieldsFromReportText(LG773657228_OCR_MULTILINE, {
        textMethod: "ocr",
      }),
    );
  });

  it("parses inline diagram with labeled star and leaky girdle line", () => {
    assertLg773657228(
      extractFieldsFromReportText(LG773657228_OCR_INLINE_NO_STAR_PCT, {
        textMethod: "ocr",
      }),
    );
  });

  it("trims girdle when OCR merges star length onto same line", () => {
    assertLg773657228(
      extractFieldsFromReportText(LG773657228_OCR_GIRDLE_LEAK, {
        textMethod: "ocr",
      }),
    );
  });

  it("does not map duplicate table % into star length", () => {
    const r = extractFieldsFromReportText(LG773657228_OCR_DUPLICATE_TABLE_PCT, {
      textMethod: "ocr",
    });
    assert.equal(r.fields.tablePercent, "59");
    assert.equal(r.fields.starLengthPercent, "14");
    assert.equal(r.fields.lowerHalfPercent, "");
    assert.equal(r.igiInternal?.pavilionDepthPercent, "43");
  });

  it("parses PDF text-layer order with star length after culet", () => {
    assertLg773657228(
      extractFieldsFromReportText(LG773657228_PDF_TEXT_ORDER, {
        textMethod: "pdf-text",
      }),
    );
  });

  it("extracts grading fields from PDF text with header block", () => {
    const r = extractFieldsFromReportText(LG773657228_WITH_HEADER, {
      lab: "IGI",
      textMethod: "pdf-text",
      reportNumber: LG773657228_EXPECTED.reportNumber,
    });
    const g = LG773657228_GRADING_EXPECTED;
    assert.equal(r.fields.shape, g.shape);
    assert.equal(r.fields.carat, g.carat);
    assert.equal(r.fields.polish, g.polish);
    assert.equal(r.fields.symmetry, g.symmetry);
    assert.equal(r.fields.fluorescence, g.fluorescence);
    assert.equal(r.fields.girdle, LG773657228_EXPECTED.girdle);
  });

  it("extracts polish and symmetry from proportion-only OCR fixtures", () => {
    const r = extractFieldsFromReportText(LG773657228_OCR_MULTILINE, {
      textMethod: "ocr",
      lab: "IGI",
    });
    assert.equal(r.fields.polish, "Excellent");
    assert.equal(r.fields.symmetry, "Excellent");
    assert.equal(r.fields.shape, "");
    assert.equal(r.fields.carat, "");
  });

  it("normalizes truncated (Facete girdle OCR to (Faceted)", () => {
    const r = extractFieldsFromReportText(LG773657228_OCR_TRUNCATED_FACETED, {
      textMethod: "ocr",
    });
    assert.equal(r.fields.girdle, LG773657228_EXPECTED.girdle);
    assert.equal(r.fields.starLengthPercent, "14");
  });
});
