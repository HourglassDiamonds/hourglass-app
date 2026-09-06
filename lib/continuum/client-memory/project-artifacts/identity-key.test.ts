import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWriterIdentityKey } from "./supabase-writer";
import { artifactSourceIdentityKey } from "./storage";

describe("Project Artifact writer identity keys", () => {
  it("accepts long Gmail attachment ids that include underscores", () => {
    const attachmentId = `ANGjdJ8_${"Ab1_".repeat(106)}`.slice(0, 426);
    assert.ok(attachmentId.includes("_"));
    assert.equal(attachmentId.length, 426);
    const prefix = `gm1|19c4f8a2b1e90d3f|${attachmentId}`;
    const parsed = parseWriterIdentityKey(
      artifactSourceIdentityKey(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "gmail",
        prefix,
      ),
    );
    assert.ok(parsed);
    assert.equal(parsed?.sourceSystem, "gmail");
    assert.equal(parsed?.sourceRefPrefix, prefix);
    assert.equal(parseWriterIdentityKey("not-a-key"), null);
  });
});
