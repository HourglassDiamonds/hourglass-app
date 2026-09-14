import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeSpecFactCopy, provenanceLabelOf } from "./provenance";

describe("Concierge provenance copy", () => {
  it("keeps canonical finger size distinct from an unverified 11", () => {
    assert.equal(
      provenanceLabelOf({
        canonicalValue: "12.5",
        proposedValue: "11",
        sourceProvenance: "UNKNOWN",
      }),
      "conflicting",
    );
    const copy = composeSpecFactCopy({
      fieldName: "finger_size",
      label: "finger size",
      canonicalValue: "12.5",
      proposedValue: "11",
      conflict: true,
      provenance: "conflicting",
      sourceVerified: false,
      sourceHref: null,
      matchedText: "finger size 11",
    });
    assert.match(copy, /Canonical finger size is 12\.5/);
    assert.match(copy, /pending proposal for 11/);
    assert.match(copy, /could not be verified/);
    assert.match(copy, /No canonical change has been approved/);
    assert.doesNotMatch(copy, /\b11\b.*\b12\.5\b.*approved/);
  });
});
