import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { V3_UNABLE_TO_VERIFY } from "./consumer-display-labels";

const componentPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "DiV3UnableToVerify.tsx",
);

describe("DiV3UnableToVerify failure state", () => {
  it("exports shared unable-to-verify headline constant", () => {
    assert.equal(V3_UNABLE_TO_VERIFY.headline, "Unable to Verify Report");
  });

  it("renders the shared headline in the failure component", () => {
    const source = readFileSync(componentPath, "utf8");
    assert.match(source, /V3_UNABLE_TO_VERIFY\.headline/);
    assert.match(source, /Upload Another Report/);
    assert.match(source, /Request Justin/);
  });
});
