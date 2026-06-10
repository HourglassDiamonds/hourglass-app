import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clarityRecommendationCeiling,
  clarityRiskFloor,
  claritySeverity,
  parseReportGradeHints,
  traceColorExtraction,
  traceClarityExtraction,
} from "./report-grade-hints";
import { GIA2527039693_FACSIMILE_PDF_TEXT } from "@/lib/calibration-library/fixtures/gia2527039693";

describe("parseReportGradeHints", () => {
  it("parses clarity from GIA-style report text", () => {
    const hints = parseReportGradeHints(
      "GIA Report\nClarity Grade\nI2\nColor Grade\nG\n",
    );
    assert.equal(hints.clarity, "I2");
    assert.equal(hints.color, "G");
  });

  it("parses IGI-style clarity grade I2", () => {
    const hints = parseReportGradeHints(
      "IGI Report 700528875\nColor Grade G\nClarity Grade I2\nCut Grade Very Good\n",
    );
    assert.equal(hints.clarity, "I2");
    assert.equal(hints.color, "G");
  });

  it("parses GIA color range on following line", () => {
    const hints = parseReportGradeHints(
      "GIA Report\nColor Grade\nO to P Range\nClarity Grade\nSI2\n",
    );
    assert.equal(hints.clarity, "SI2");
    assert.match(hints.color ?? "", /O to P Range/i);
  });

  it("flags fancy color context", () => {
    const hints = parseReportGradeHints(
      "Natural Colored Diamond\nFancy Vivid Yellow",
    );
    assert.equal(hints.fancyColor, true);
    assert.equal(hints.color, undefined);
  });

  it("rejects Y from Very Good cut-grade OCR noise", () => {
    const trace = traceColorExtraction(
      "GRADING RESULTS\nUL Grade cece. VEry Good\nInscription(s): GIA 6482285473",
    );
    assert.equal(trace.selected, undefined);
    assert.ok(
      trace.rejected.some((r) => r.reason.includes("cut/finish noise")) ||
        !trace.candidates.some((c) => c.value === "Y"),
    );
  });

  it("parses GIA facsimile dot-leader single color grade", () => {
    const hints = parseReportGradeHints(
      "Color Grade   ..........................................................................   D\nClarity Grade   ................................................................... VVS2",
    );
    assert.equal(hints.color, "D");
    assert.equal(hints.clarity, "VVS2");
  });

  it("parses GIA facsimile dot-leader clarity with spaced token (I 1)", () => {
    const hints = parseReportGradeHints(
      "Clarity Grade   ........................................ I 1\nColor Grade F",
    );
    assert.equal(hints.clarity, "I1");
  });

  it("does not pick clarity from grading scale listing alone", () => {
    const hints = parseReportGradeHints(
      "CLARITY GRADING SCALE\nFL IF VVS1 VVS2 VS1 VS2 SI1 SI2 I1 I2 I3",
    );
    assert.equal(hints.clarity, undefined);
    const trace = traceClarityExtraction(
      "CLARITY GRADING SCALE\nFL IF VVS1 VVS2 VS1 VS2 SI1 SI2 I1 I2 I3",
    );
    assert.equal(trace.selected, undefined);
  });

  it("prefers explicit Clarity Grade field over grading scale text", () => {
    const hints = parseReportGradeHints(
      `${GIA2527039693_FACSIMILE_PDF_TEXT}\nCLARITY GRADING SCALE\nFL IF VVS1 VVS2 VS1 VS2 SI1 SI2 I1 I2 I3`,
    );
    assert.equal(hints.clarity, "VVS2");
    assert.equal(hints.color, "D");
  });
});

describe("claritySeverity", () => {
  it("ranks I2 above SI", () => {
    assert.ok(claritySeverity("I2") > claritySeverity("SI1"));
  });
});

describe("clarityRiskFloor", () => {
  it("I2 and I3 floor at High", () => {
    assert.equal(clarityRiskFloor("I2"), "High");
    assert.equal(clarityRiskFloor("I3"), "High");
  });

  it("I1 floors at Elevated", () => {
    assert.equal(clarityRiskFloor("I1"), "Elevated");
  });
});

describe("clarityRecommendationCeiling", () => {
  it("caps I1, I2, and I3 at Not Recommended", () => {
    assert.equal(clarityRecommendationCeiling("I3"), "Not Recommended");
    assert.equal(clarityRecommendationCeiling("I2"), "Not Recommended");
    assert.equal(clarityRecommendationCeiling("I1"), "Not Recommended");
  });
});
