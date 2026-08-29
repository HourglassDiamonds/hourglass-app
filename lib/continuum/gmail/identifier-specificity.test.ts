import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyIdentifierSpecificity,
  identifierRequiresTypedContext,
  isStrongStructuredIdentifier,
  MIN_STRONG_STRUCTURED_DIGIT_COUNT,
} from "./identifier-specificity";

describe("identifier specificity rule", () => {
  it("keeps high-entropy structured identifiers strong", () => {
    for (const token of ["CBR2000037", "CAD-8821", "J-4491", "AB-555", "J4491"]) {
      assert.equal(classifyIdentifierSpecificity(token), "strong_structured", token);
      assert.equal(isStrongStructuredIdentifier(token), true, token);
      assert.equal(identifierRequiresTypedContext(token), false, token);
    }
  });

  it("classifies pure numeric tokens as weak_numeric", () => {
    for (const token of ["18", "141", "555", "2024"]) {
      assert.equal(classifyIdentifierSpecificity(token), "weak_numeric", token);
      assert.equal(isStrongStructuredIdentifier(token), false, token);
      assert.equal(identifierRequiresTypedContext(token), true, token);
    }
  });

  it("classifies short structured tokens as weak_short_structured", () => {
    for (const token of ["CAD-1", "CAD-2", "J-1", "J-12", "A-1"]) {
      assert.equal(
        classifyIdentifierSpecificity(token),
        "weak_short_structured",
        token,
      );
      assert.equal(isStrongStructuredIdentifier(token), false, token);
      assert.equal(identifierRequiresTypedContext(token), true, token);
    }
  });

  it("does not treat punctuation or a short prefix as strength by itself", () => {
    assert.equal(MIN_STRONG_STRUCTURED_DIGIT_COUNT, 3);
    assert.equal(classifyIdentifierSpecificity("CAD-1"), "weak_short_structured");
    assert.equal(classifyIdentifierSpecificity("A-1"), "weak_short_structured");
    assert.equal(classifyIdentifierSpecificity("AB-555"), "strong_structured");
  });
});
