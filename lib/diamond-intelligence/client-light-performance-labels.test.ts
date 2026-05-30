import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSUMER_TRAIT_UNCERTAIN_HELPER,
  getConsumerLightPerformanceDisplay,
} from "./client-light-performance-labels";

describe("getConsumerLightPerformanceDisplay", () => {
  it("maps strong brightness to consumer language", () => {
    const d = getConsumerLightPerformanceDisplay(
      { label: "Brightness", level: "Strong", fillPercent: 90 },
      "Strong",
    );
    assert.equal(d.label, "Expected to return light well in everyday viewing.");
    assert.equal(d.uncertain, false);
  });

  it("maps mixed fire to lighting-dependent copy", () => {
    const d = getConsumerLightPerformanceDisplay(
      { label: "Fire", level: "Balanced", fillPercent: 78 },
      "Mixed",
    );
    assert.equal(
      d.label,
      "Color flashes may be more noticeable under some lighting than others.",
    );
    assert.equal(d.uncertain, false);
  });

  it("uses scintillation uncertain copy for diagram internal labels", () => {
    const d = getConsumerLightPerformanceDisplay(
      { label: "Scintillation", level: "Needs review", fillPercent: 0 },
      "Diagram detail required",
    );
    assert.equal(
      d.label,
      "The report does not fully reveal this diamond's sparkle pattern. Optical imagery can provide a clearer picture.",
    );
    assert.equal(d.uncertain, true);
  });

  it("does not use internal jargon in consumer labels", () => {
    const traits = [
      "Brightness",
      "Fire",
      "Scintillation",
      "Contrast",
      "Leakage control",
    ] as const;
    for (const label of traits) {
      const d = getConsumerLightPerformanceDisplay(
        { label, level: "Strong", fillPercent: 92 },
        "Strong",
      );
      assert.doesNotMatch(d.label, /\bMixed\b|\bStrong\b|\bBalanced\b|Top %/i);
    }
  });

  it("uses reassuring uncertain helper copy", () => {
    assert.match(CONSUMER_TRAIT_UNCERTAIN_HELPER, /may still look beautiful/i);
    assert.match(CONSUMER_TRAIT_UNCERTAIN_HELPER, /helpful starting point/i);
    assert.doesNotMatch(CONSUMER_TRAIT_UNCERTAIN_HELPER, /performs poorly/i);
  });
});
