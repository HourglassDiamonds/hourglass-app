import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractCadJobIdentifiers,
  isPlausibleCadJobIdentifier,
} from "./cad-job-identifier";

describe("CAD / job identifier quality", () => {
  it("rejects process words that follow CAD", () => {
    for (const word of [
      "presentation",
      "design",
      "render",
      "revision",
      "update",
      "approval",
    ]) {
      assert.equal(isPlausibleCadJobIdentifier(word), false, word);
      assert.deepEqual(extractCadJobIdentifiers(`CAD ${word}`), []);
      assert.deepEqual(extractCadJobIdentifiers(`CAD ${word} attached`), []);
    }
  });

  it("accepts realistic alphanumeric and numeric job codes", () => {
    assert.equal(isPlausibleCadJobIdentifier("CAD-8821"), true);
    assert.equal(isPlausibleCadJobIdentifier("CAD-1"), true);
    assert.equal(isPlausibleCadJobIdentifier("141"), true);
    assert.equal(isPlausibleCadJobIdentifier("J4491"), true);
    assert.deepEqual(extractCadJobIdentifiers("Please see CAD-8821."), ["CAD-8821"]);
    assert.deepEqual(extractCadJobIdentifiers("CAD 141 / order 140."), ["141"]);
    assert.deepEqual(extractCadJobIdentifiers("job number J-4491"), ["J-4491"]);
    assert.deepEqual(extractCadJobIdentifiers("CAD-1 for this band"), ["CAD-1"]);
  });

  it("does not treat alphabetic-only tokens as identifiers", () => {
    assert.equal(isPlausibleCadJobIdentifier("presentation"), false);
    assert.equal(isPlausibleCadJobIdentifier("Hourglass"), false);
    assert.deepEqual(extractCadJobIdentifiers("good job everyone"), []);
  });
});
