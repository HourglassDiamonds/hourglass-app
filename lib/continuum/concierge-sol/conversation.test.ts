import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { queryLooksLikeFollowUp, resolveConversationSlots } from "./conversation";

describe("Concierge conversation slots", () => {
  it("keeps Travis in short-term context for follow-ups", () => {
    const first = resolveConversationSlots({ query: "What is going on with Travis?" });
    assert.equal(first.personName, "Travis");
    const follow = resolveConversationSlots({
      query: "What size do we have?",
      history: [
        { role: "founder", text: "What is going on with Travis?" },
        { role: "concierge", text: "Travis has the chicken ring in progress." },
      ],
    });
    assert.equal(follow.personName, "Travis");
    assert.equal(queryLooksLikeFollowUp("What size do we have?"), true);
    assert.equal(queryLooksLikeFollowUp("Where did the 11 come from?"), true);
  });
});
