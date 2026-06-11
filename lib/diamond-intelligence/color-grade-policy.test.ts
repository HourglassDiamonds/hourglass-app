import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  colorPreferenceImpact,
  colorPreferenceProfileLabel,
  isLowColorGrade,
  isWarmMarketColor,
  suppressesBroadPercentileForColor,
  warmColorPreferenceContextCopy,
  worstColorLetterIndex,
} from "./color-grade-policy";
import { colorRecommendationCeiling } from "./report-grade-hints";

describe("color-grade-policy", () => {
  it("maps preference impact bands", () => {
    assert.equal(colorPreferenceImpact("F"), "None");
    assert.equal(colorPreferenceImpact("I"), "None");
    assert.equal(colorPreferenceImpact("J"), "Slight");
    assert.equal(colorPreferenceImpact("K"), "Slight");
    assert.equal(colorPreferenceImpact("L"), "Slight");
    assert.equal(colorPreferenceImpact("M"), "Moderate");
    assert.equal(colorPreferenceImpact("O to P Range"), "Significant");
  });

  it("uses preference profile labels, not penalty language", () => {
    assert.equal(colorPreferenceProfileLabel("None"), null);
    assert.equal(colorPreferenceProfileLabel("Slight"), "Color Profile");
    assert.equal(colorPreferenceProfileLabel("Moderate"), "Warm Color Profile");
    assert.equal(
      colorPreferenceProfileLabel("Significant"),
      "Distinctly Warm Color Profile",
    );
  });

  it("treats K as slight preference impact without hard cap", () => {
    assert.equal(colorPreferenceImpact("K"), "Slight");
    assert.equal(suppressesBroadPercentileForColor("K"), false);
    assert.equal(colorRecommendationCeiling("K"), null);
  });

  it("suppresses broad percentile from L onward", () => {
    assert.equal(worstColorLetterIndex("O to P Range"), 12);
    assert.equal(suppressesBroadPercentileForColor("O to P Range"), true);
    assert.equal(isLowColorGrade("L"), true);
    assert.equal(isWarmMarketColor("L"), false);
    assert.equal(isWarmMarketColor("O to P Range"), true);
  });

  it("does not apply internal recommendation ceiling from color alone", () => {
    assert.equal(colorRecommendationCeiling("F"), null);
    assert.equal(colorRecommendationCeiling("O to P Range"), null);
  });

  it("provides warm color preference context copy for moderate+ colors", () => {
    assert.equal(warmColorPreferenceContextCopy("K"), null);
    assert.match(
      warmColorPreferenceContextCopy("O to P Range") ?? "",
      /warmer color profile/i,
    );
    assert.doesNotMatch(
      warmColorPreferenceContextCopy("O to P Range") ?? "",
      /penalty|deduction|concern/i,
    );
  });
});
