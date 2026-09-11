import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  GENERATED_FOUNDER_OPERATING_BRIEF_RULE,
  generatedOperatingMailHashesFrom,
  generatedOperatingMailHashesFromStored,
  isGeneratedFounderOperatingMail,
  withGeneratedFounderOperatingBriefRule,
} from "./generated-source";

describe("Generated operating-mail provenance", () => {
  it("hashes cadence senders without using subject text", () => {
    const hashes = generatedOperatingMailHashesFrom([
      "brief@hourglass.test",
      " brief@hourglass.test ",
      "intel@hourglass.test",
      "",
      null,
    ]);
    assert.deepEqual(hashes, [
      hashEmail("brief@hourglass.test"),
      hashEmail("intel@hourglass.test"),
    ]);
    assert.equal(
      isGeneratedFounderOperatingMail(hashes[0]!, hashes),
      true,
    );
    assert.equal(
      isGeneratedFounderOperatingMail(hashEmail("travis@client.test"), hashes),
      false,
    );
    assert.deepEqual(
      withGeneratedFounderOperatingBriefRule(["spec_conflict_review_required"], true),
      ["spec_conflict_review_required", GENERATED_FOUNDER_OPERATING_BRIEF_RULE],
    );
  });

  it("hashes RFC5322 from-headers by the address, not the display name", () => {
    const hashes = generatedOperatingMailHashesFrom([
      "Hourglass <brief@hourglass.test>",
      "brief@hourglass.test",
    ]);
    assert.deepEqual(hashes, [hashEmail("brief@hourglass.test")]);
  });

  it("accepts stored sender hashes without reversing them to addresses", () => {
    const cadence = hashEmail("cadence@hourglass.test")!;
    assert.deepEqual(generatedOperatingMailHashesFromStored(` ${cadence} `), [cadence]);
    assert.deepEqual(generatedOperatingMailHashesFromStored("not-a-hash"), []);
  });
});
