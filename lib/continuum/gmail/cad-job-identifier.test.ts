import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyCadIdentifierStrength,
  extractCadJobIdentifiers,
  hasBoundedIdentifierToken,
  isPlausibleCadJobIdentifier,
  isStrongStructuredCadIdentifier,
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

describe("CAD identifier strength", () => {
  it("classifies structured alphanumeric identifiers as strong", () => {
    for (const token of ["CBR2000037", "CAD-8821", "J-4491", "CAD-1", "J4491"]) {
      assert.equal(classifyCadIdentifierStrength(token), "strong_structured", token);
      assert.equal(isStrongStructuredCadIdentifier(token), true, token);
    }
    assert.deepEqual(extractCadJobIdentifiers("Please see CBR2000037."), ["CBR2000037"]);
    assert.deepEqual(extractCadJobIdentifiers("J-4491 is ready."), ["J-4491"]);
  });

  it("classifies short numeric CAD tokens as weak, not invalid", () => {
    for (const token of ["18", "141", "2024", "555"]) {
      assert.equal(isPlausibleCadJobIdentifier(token), true, token);
      assert.equal(classifyCadIdentifierStrength(token), "weak_numeric", token);
      assert.equal(isStrongStructuredCadIdentifier(token), false, token);
    }
    assert.deepEqual(extractCadJobIdentifiers("CAD 18"), ["18"]);
    assert.deepEqual(extractCadJobIdentifiers("CAD 141"), ["141"]);
    assert.deepEqual(extractCadJobIdentifiers("CAD 2024"), ["2024"]);
    assert.deepEqual(extractCadJobIdentifiers("CAD 555"), ["555"]);
  });

  it("does not treat CAD 141 as a bounded match inside unrelated invoice 141 text", () => {
    assert.equal(hasBoundedIdentifierToken("Invoice 141 reminder", "141"), true);
    assert.equal(hasBoundedIdentifierToken("Invoice 1410 reminder", "141"), false);
    assert.equal(isStrongStructuredCadIdentifier("141"), false);
  });
});
