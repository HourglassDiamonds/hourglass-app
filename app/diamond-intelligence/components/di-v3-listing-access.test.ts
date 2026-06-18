import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { V3_LISTING_INACCESSIBLE } from "./consumer-display-labels";

const dashboardPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "LightPerformanceDashboard.tsx",
);

describe("DiV3 listing access fallback", () => {
  it("exports dedicated listing-access copy", () => {
    assert.equal(
      V3_LISTING_INACCESSIBLE.headline,
      "We Couldn't Access This Listing",
    );
    assert.match(
      V3_LISTING_INACCESSIBLE.bodyParagraphs.join(" "),
      /Concierge/,
    );
  });

  it("renders listing inaccessible card instead of unable-to-verify", () => {
    const source = readFileSync(dashboardPath, "utf8");
    assert.match(source, /resultState === "LISTING_INACCESSIBLE"/);
    assert.match(source, /DiV3ListingInaccessible/);
    assert.doesNotMatch(
      source,
      /listing_inaccessible[\s\S]*DiV3UnableToVerify/,
    );
  });
});
