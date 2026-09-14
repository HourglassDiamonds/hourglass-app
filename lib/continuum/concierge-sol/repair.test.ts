import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteRepairFromContinuum, parseRepairQuoteIntent } from "./repair";

describe("Concierge deterministic repair quoting", () => {
  it("quotes 14KY laser sizing on a 2mm shank from 6 to 7", () => {
    const intent = parseRepairQuoteIntent({
      query: "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?",
    });
    assert.equal(intent.repairType, "sizing");
    assert.equal(intent.metal, "yellow");
    assert.equal(intent.karat, "14k");
    assert.equal(intent.shankMm, 2);
    assert.equal(intent.fromSize, 6);
    assert.equal(intent.toSize, 7);
    assert.equal(intent.direction, "larger");

    const result = quoteRepairFromContinuum({
      query: "How much does a 14KY sizing on a 2mm shank cost if we go from a 6 to a 7?",
    });
    assert.equal(result.ok, true);
    assert.equal(result.quoted, true);
    if (!result.quoted) return;
    assert.equal(result.method, "laser");
    assert.equal(result.amountLabel, "$135");
    assert.match(result.taskDescription, /Laser/i);
    assert.doesNotMatch(result.taskDescription, /Torch/i);
    assert.match(result.clientAnswer, /\$135/);
    assert.match(result.clientAnswer, /laser/i);
    assert.doesNotMatch(result.clientAnswer, /\$1,000/i);
  });

  it("does not invent a price when the sizes are the same", () => {
    const result = quoteRepairFromContinuum({
      query: "14KY sizing on a 2mm shank from 6 to 6",
    });
    assert.equal(result.quoted, false);
    if (result.quoted) return;
    assert.equal(result.reason, "same-size");
  });
});
