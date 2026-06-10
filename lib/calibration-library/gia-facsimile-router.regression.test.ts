import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFieldsFromReportText } from "./extract-from-text";
import { shouldRunGcalImageRegionOcr } from "./parsers/gcal/gcal-image-ocr";
import { detectReportFamily } from "./parsers/router";
import { emptyReportFields } from "./fields";
import { classifyClientInterpretation } from "../diamond-intelligence/client-interpretation-pipeline";
import { parseReportGradeHints } from "../diamond-intelligence/report-grade-hints";
import { needsPartialGradeReview } from "@/app/diamond-intelligence/components/v3-presentation";

const GIA_6545889783_FACSIMILE = `GIA Report Number   6545889783
Shape and Cutting Style   Round Brilliant
Carat Weight   1.00 carat
Color Grade   ........................................   F
Clarity Grade   ................................................................... VVS1
Cut Grade   Fair
Polish   Excellent
Symmetry   Good
Fluorescence   None
Measurements   6.45 - 6.48 x 4.02 mm
Table   54%
Depth   66.2%
Crown Angle   40.0°
Pavilion Angle   39.4°
Star Length   50%
Lower Half   75%
GIA NATURAL DIAMOND GRADING REPORT
Verify this report at GIA.edu`;

describe("GIA facsimile router regression", () => {
  it("does not force GCAL 8X on image-only hint when text is empty", () => {
    const family = detectReportFamily("", { gcalImageOnlyPdf: true });
    assert.notEqual(family.parserType, "gcal-8x");
    assert.notEqual(family.lab, "GCAL");
  });

  it("routes 6545889783 facsimile text to GIA even with gcalImageOnlyPdf hint", () => {
    const family = detectReportFamily(GIA_6545889783_FACSIMILE, {
      gcalImageOnlyPdf: true,
    });
    assert.equal(family.lab, "GIA");
    assert.match(family.parserType ?? "", /^gia-/);
  });

  it("does not run GCAL region OCR when combined text is GIA facsimile", () => {
    assert.equal(
      shouldRunGcalImageRegionOcr(emptyReportFields(), {
        parserType: "gcal-8x",
        lab: "GCAL",
        gcalImageOnlyPdf: true,
        combinedText: GIA_6545889783_FACSIMILE,
      }),
      false,
    );
  });

  it("6545889783 text extraction is useful and yields grade hints F + VVS1", () => {
    const extracted = extractFieldsFromReportText(GIA_6545889783_FACSIMILE, {
      textMethod: "pdf-text",
      gcalImageOnlyPdf: true,
    });

    assert.equal(extracted.metadata.lab, "GIA");
    assert.equal(extracted.metadata.reportNumber, "6545889783");
    assert.equal(extracted.fields.carat.trim(), "1.00");
    assert.equal(extracted.fields.tablePercent.trim(), "54");
    assert.equal(extracted.fields.depthPercent.trim(), "66.2");
    assert.equal(extracted.fields.cutGrade.trim(), "Fair");

    const decision = classifyClientInterpretation({
      fields: extracted.fields,
      confidence: extracted.confidence,
      metadata: {
        lab: extracted.metadata.lab,
        reportNumber: extracted.metadata.reportNumber,
      },
    });
    assert.notEqual(decision.tier, "failure");
    assert.equal(decision.useful, true);

    const hints = parseReportGradeHints(
      extracted.reportGradeHintText ?? GIA_6545889783_FACSIMILE,
    );
    assert.equal(hints.color, "F");
    assert.equal(hints.clarity, "VVS1");
    assert.equal(
      needsPartialGradeReview({ gradeHints: hints, canShowScore: true }),
      false,
    );
  });
});
