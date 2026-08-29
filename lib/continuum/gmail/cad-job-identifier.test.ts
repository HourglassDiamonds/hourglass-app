import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  candidateHasTypedCadIdentifier,
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

  it("rejects URL, cid, query, hash, and hex fragments as CAD identifiers", () => {
    const vendorCad = `Please find the following for Cad: CBR2000037
Cad presentation
Click here for video rendering:
https://example.test/render/DB865C70`;
    assert.deepEqual(extractCadJobIdentifiers(vendorCad), ["CBR2000037"]);
    assert.equal(extractCadJobIdentifiers(vendorCad).includes("DB865C70"), false);
    assert.deepEqual(
      extractCadJobIdentifiers("CAD presentation"),
      [],
    );
    assert.deepEqual(
      extractCadJobIdentifiers("https://example.test/render/DB865C70"),
      [],
    );
    assert.deepEqual(
      extractCadJobIdentifiers("https://example.test/view?id=DB865C70&ref=FACE12AB"),
      [],
    );
    assert.deepEqual(
      extractCadJobIdentifiers("https://example.test/view#DB865C70"),
      [],
    );
    assert.deepEqual(
      extractCadJobIdentifiers("cid:image001.jpg@01D8.DB865C70"),
      [],
    );
    assert.deepEqual(
      extractCadJobIdentifiers("tracking 9f8e7d6c5b4a3210 for this shipment"),
      [],
    );
    assert.deepEqual(
      extractCadJobIdentifiers("uuid 550e8400-e29b-41d4-a716-446655440000"),
      [],
    );
    assert.deepEqual(extractCadJobIdentifiers("Please see CAD-8821."), ["CAD-8821"]);
    assert.deepEqual(extractCadJobIdentifiers("job number J-4491"), ["J-4491"]);
    assert.deepEqual(extractCadJobIdentifiers("Please see CBR2000037."), ["CBR2000037"]);
  });
});

describe("CAD identifier strength", () => {
  it("classifies structured alphanumeric identifiers as strong", () => {
    for (const token of ["CBR2000037", "CAD-8821", "J-4491", "J4491"]) {
      assert.equal(classifyCadIdentifierStrength(token), "strong_structured", token);
      assert.equal(isStrongStructuredCadIdentifier(token), true, token);
    }
    assert.deepEqual(extractCadJobIdentifiers("Please see CBR2000037."), ["CBR2000037"]);
    assert.deepEqual(extractCadJobIdentifiers("J-4491 is ready."), ["J-4491"]);
  });

  it("classifies short structured CAD/job tokens as weak, not invalid", () => {
    for (const token of ["CAD-1", "CAD-2", "J-1", "J-12", "A-1"]) {
      assert.equal(isPlausibleCadJobIdentifier(token), true, token);
      assert.equal(
        classifyCadIdentifierStrength(token),
        "weak_short_structured",
        token,
      );
      assert.equal(isStrongStructuredCadIdentifier(token), false, token);
    }
    assert.deepEqual(extractCadJobIdentifiers("CAD-1 for this band"), ["CAD-1"]);
    assert.deepEqual(extractCadJobIdentifiers("CAD A-1"), ["A-1"]);
    assert.deepEqual(extractCadJobIdentifiers("job J-12"), ["J-12"]);
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

  it("does not treat CAD 141 as a typed CAD match inside unrelated invoice 141 text", () => {
    assert.equal(hasBoundedIdentifierToken("Invoice 141 reminder", "141"), true);
    assert.equal(hasBoundedIdentifierToken("Invoice 1410 reminder", "141"), false);
    assert.equal(isStrongStructuredCadIdentifier("141"), false);
    assert.equal(candidateHasTypedCadIdentifier("Invoice 141 reminder", "141"), false);
  });

  it("does not let prefix-stripped A-1 match apartment notices", () => {
    assert.deepEqual(extractCadJobIdentifiers("CAD A-1"), ["A-1"]);
    assert.equal(classifyCadIdentifierStrength("A-1"), "weak_short_structured");
    assert.equal(candidateHasTypedCadIdentifier("Apartment A-1 notice", "A-1"), false);
    assert.equal(candidateHasTypedCadIdentifier("CAD A-1 revision", "A-1"), true);
  });

  it("keeps exact bounded identity for strong CAD/job tokens", () => {
    assert.equal(hasBoundedIdentifierToken("CBR2000037 follow-up", "CBR2000037"), true);
    assert.equal(hasBoundedIdentifierToken("CBR20000370 follow-up", "CBR2000037"), false);
    assert.equal(hasBoundedIdentifierToken("CAD-88210 follow-up", "CAD-8821"), false);
    assert.equal(hasBoundedIdentifierToken("J-44910 ready", "J-4491"), false);
  });
});
