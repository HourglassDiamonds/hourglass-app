import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClarityReviewGuidance } from "./clarity-review-guidance";
import { consumerTitleForArchetype } from "./visual-personality";

describe("buildClarityReviewGuidance", () => {
  it("SI2 gets inspection-required copy", () => {
    const g = buildClarityReviewGuidance({ clarity: "SI2" });
    assert.equal(g?.title, "Inspection Required");
    assert.match(g?.body ?? "", /eye-clean/i);
    assert.match(g?.body ?? "", /Justin should inspect video/i);
  });

  it("I2 gets Hourglass clarity standards advisory", () => {
    const g = buildClarityReviewGuidance({ clarity: "I2" });
    assert.equal(g?.tone, "strong");
    assert.equal(g?.title, "Outside Hourglass Clarity Standards");
    assert.match(g?.body ?? "", /outside the quality range/i);
    assert.match(g?.body ?? "", /not a dispute of the laboratory grade/i);
  });

  it("VS1 returns null", () => {
    assert.equal(buildClarityReviewGuidance({ clarity: "VS1" }), null);
  });
});

describe("consumerTitleForArchetype", () => {
  it("maps technical labels to plain language", () => {
    assert.equal(
      consumerTitleForArchetype("Compact Architecture"),
      "Appears Slightly Smaller Than Expected",
    );
    assert.equal(
      consumerTitleForArchetype("Spread Forward"),
      "Looks Larger for Its Weight",
    );
  });
});
