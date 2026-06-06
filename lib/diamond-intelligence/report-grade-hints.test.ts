import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clarityRecommendationCeiling,
  clarityRiskFloor,
  claritySeverity,
  parseReportGradeHints,
} from "./report-grade-hints";

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

  it("flags fancy color context", () => {
    const hints = parseReportGradeHints(
      "Natural Colored Diamond\nFancy Vivid Yellow",
    );
    assert.equal(hints.fancyColor, true);
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
