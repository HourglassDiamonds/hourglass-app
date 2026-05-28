import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessSuspiciousProportionCombinations,
  validateClientManualField,
} from "./manual-field-validation";

describe("validateClientManualField", () => {
  it("normalizes percent and degree symbols", () => {
    const r = validateClientManualField("tablePercent", "58 %");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.normalized, "58");
  });

  it("rejects out-of-range table percent", () => {
    const r = validateClientManualField("tablePercent", "90");
    assert.equal(r.ok, false);
  });

  it("accepts controlled girdle options", () => {
    const r = validateClientManualField("girdle", "medium");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.normalized, "Medium");
  });

  it("warns on suspicious table/depth pairs", () => {
    const warnings = assessSuspiciousProportionCombinations({
      tablePercent: "70",
      depthPercent: "54",
    });
    assert.ok(warnings.length > 0);
    assert.doesNotMatch(warnings[0]!, /parser|OCR/i);
  });
});
