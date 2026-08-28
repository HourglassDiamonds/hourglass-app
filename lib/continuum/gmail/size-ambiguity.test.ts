import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerSizeLanguageIsAmbiguous } from "./size-ambiguity";

describe("finger-size ambiguity guard", () => {
  it("keeps an explicit ring size as clean evidence", () => {
    assert.equal(fingerSizeLanguageIsAmbiguous("Ring size 6.5", "6.5"), false);
    assert.equal(
      fingerSizeLanguageIsAmbiguous("Confirming finger size is 6.5.", "6.5"),
      false,
    );
  });

  it("treats hedged size phrases as ambiguous", () => {
    assert.equal(fingerSizeLanguageIsAmbiguous("ring size 6 or 7", "6"), true);
    assert.equal(fingerSizeLanguageIsAmbiguous("ring size 6 or 7", "7"), true);
    assert.equal(
      fingerSizeLanguageIsAmbiguous("between 6 and 7 for the band", "6"),
      true,
    );
    assert.equal(fingerSizeLanguageIsAmbiguous("maybe 6.5", "6.5"), true);
    assert.equal(
      fingerSizeLanguageIsAmbiguous("approximately ring size 6.5", "6.5"),
      true,
    );
    assert.equal(fingerSizeLanguageIsAmbiguous("around 6.5", "6.5"), true);
    assert.equal(fingerSizeLanguageIsAmbiguous("6.5-ish", "6.5"), true);
    assert.equal(
      fingerSizeLanguageIsAmbiguous("not sure if ring size 6.5", "6.5"),
      true,
    );
  });

  it("does not treat 6.5 as a match for a hedged size 6", () => {
    assert.equal(fingerSizeLanguageIsAmbiguous("Ring size 6.5", "6"), false);
  });
});
