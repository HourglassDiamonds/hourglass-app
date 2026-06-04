import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claritySeverity,
  parseReportGradeHints,
} from "./report-grade-hints";

describe("parseReportGradeHints", () => {
  it("parses clarity from report text", () => {
    const hints = parseReportGradeHints(
      "GIA Report\nClarity Grade\nI2\nColor Grade\nG\n",
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
