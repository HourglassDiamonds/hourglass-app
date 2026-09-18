import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractInboundObligation } from "./inbound-obligation";

const NATE_INBOUND = [
  "1. estimated cost comparison:",
  "- actual pearls",
  "- platinum beadwork",
  "2. chain options:",
  "- pictures/videos",
  "- pricing",
  "3. he likes adjustable length with jump ring",
].join("\n");

describe("Today inbound obligation copy", () => {
  it("names Nate's pearl vs platinum and chain asks", () => {
    const obligation = extractInboundObligation(NATE_INBOUND, "Nate Pearl");
    assert.ok(obligation);
    assert.equal(
      obligation?.headline,
      "Price pearl vs platinum beadwork and send chain options.",
    );
    assert.match(
      obligation?.explanation ?? "",
      /cost difference between pearl and platinum beadwork/i,
    );
    assert.match(obligation?.explanation ?? "", /photos\/video and pricing for chain/i);
    assert.doesNotMatch(obligation?.headline ?? "", /recap/i);
  });

  it("returns null when no concrete ask can be extracted", () => {
    assert.equal(
      extractInboundObligation("Thanks, that all sounds good.", "Nate Pearl"),
      null,
    );
  });
});
