import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretBrainDump } from "./brain-dump";

describe("Brain Dump interpretation", () => {
  it("proposes structure without persisting", () => {
    const proposal = interpretBrainDump(
      "Travis still needs a follow up on the chicken ring CAD and also remind me about Dad's birthday.",
    );
    assert.equal(proposal.persist, false);
    assert.equal(proposal.personContext, "Travis");
    assert.ok(proposal.action);
    assert.ok(proposal.personalItem);
    assert.ok(proposal.note);
  });

  it("still finds Travis when the dump starts with Need", () => {
    const proposal = interpretBrainDump("Need to follow up with Travis on CAD.");
    assert.equal(proposal.personContext, "Travis");
    assert.equal(proposal.persist, false);
  });
});
