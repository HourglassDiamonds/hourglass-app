import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCurrentClientTurnText,
  isCurrentFounderOwnedObligationText,
  isGenericFallbackObligationText,
  isRelationshipPromiseText,
} from "./obligation-currentness";

describe("Today obligation currentness", () => {
  it("rejects generic recap fallback and relationship promises", () => {
    assert.equal(isGenericFallbackObligationText("Send the recap / next step."), true);
    assert.equal(isGenericFallbackObligationText("Send the recap and next step."), true);
    assert.equal(isRelationshipPromiseText("I'll keep you posted as we get a little closer so I can give an exact."), true);
    assert.equal(
      isCurrentFounderOwnedObligationText("Send the recap / next step."),
      false,
    );
    assert.equal(
      isCurrentFounderOwnedObligationText(
        "I'll keep you posted as we get a little closer so I can give an exact.",
      ),
      false,
    );
    assert.equal(
      isCurrentFounderOwnedObligationText("walk-ins this month / follow up with you"),
      false,
    );
    assert.equal(
      isCurrentClientTurnText("walk-ins this month / follow up with you"),
      false,
    );
  });

  it("keeps current inbound asks and immediate founder commitments", () => {
    assert.equal(
      isCurrentFounderOwnedObligationText("Can you follow up with me about walk-ins this month?"),
      true,
    );
    assert.equal(
      isCurrentFounderOwnedObligationText("Can you send chain options and pricing?"),
      true,
    );
    assert.equal(
      isCurrentFounderOwnedObligationText("I'll get a video of the chain options and check pricing."),
      true,
    );
    assert.equal(
      isCurrentFounderOwnedObligationText("Send chain options and pricing."),
      true,
    );
    assert.equal(isCurrentClientTurnText("yellow gold marquise"), true);
    assert.equal(isCurrentClientTurnText("Let's go with that design"), true);
    assert.equal(isCurrentClientTurnText("Aurora U"), false);
  });
});
