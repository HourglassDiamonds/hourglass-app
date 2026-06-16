import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("interpret route archive persistence", () => {
  it("awaits archive persistence before returning the HTTP response", () => {
    const source = readFileSync(
      "app/api/diamond-intelligence/interpret/route.ts",
      "utf8",
    );
    assert.match(source, /async function respond\(/);
    assert.match(source, /await archiveDiamondIntelligenceSubmission\(archiveCtx\)/);
    assert.doesNotMatch(
      source,
      /void persistDiamondIntelligenceArchive/,
    );
  });
});
