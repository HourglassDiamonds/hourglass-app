import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyVendorSupport,
  detectVendorFromUrl,
  extractListingId,
  normalizeDiamondListingUrl,
} from "./vendor-detection";

describe("detectVendorFromUrl", () => {
  it("detects tier 1 vendors", () => {
    assert.equal(
      detectVendorFromUrl("https://www.jamesallen.com/loose-diamonds/round/123"),
      "james-allen",
    );
    assert.equal(
      detectVendorFromUrl("https://www.bluenile.com/diamond-details/abc"),
      "blue-nile",
    );
    assert.equal(
      detectVendorFromUrl("https://www.rarecarat.com/diamond/12345"),
      "rare-carat",
    );
  });

  it("returns unknown for unsupported hosts", () => {
    assert.equal(detectVendorFromUrl("https://example.com/diamond/1"), "unknown");
  });
});

describe("normalizeDiamondListingUrl", () => {
  it("strips tracking params and preserves listing path", () => {
    const normalized = normalizeDiamondListingUrl(
      "https://www.brilliantearth.com/diamond/123?utm_source=google&ref=ad#details",
    );
    assert.equal(
      normalized,
      "https://www.brilliantearth.com/diamond/123",
    );
  });

  it("returns null for invalid urls", () => {
    assert.equal(normalizeDiamondListingUrl("not-a-url"), null);
    assert.equal(normalizeDiamondListingUrl("file:///tmp/x"), null);
  });
});

describe("classifyVendorSupport", () => {
  it("marks tier 1 and tier 2 as supported", () => {
    assert.deepEqual(classifyVendorSupport("https://www.ritani.com/diamonds/1"), {
      vendor: "ritani",
      tier: "tier1",
      supported: true,
    });
    assert.deepEqual(
      classifyVendorSupport("https://www.whiteflash.com/loose-diamonds/1"),
      {
        vendor: "whiteflash",
        tier: "tier2",
        supported: true,
      },
    );
  });

  it("marks unknown vendors as unsupported", () => {
    const result = classifyVendorSupport("https://shop.example.com/diamond/1");
    assert.equal(result.supported, false);
    assert.equal(result.tier, "unsupported");
  });

  it("marks tier 3 as unsupported in beta", () => {
    const result = classifyVendorSupport("https://www.vrai.com/diamonds/1");
    assert.equal(result.vendor, "vrai");
    assert.equal(result.supported, false);
  });
});

describe("extractListingId", () => {
  it("extracts listing id from vendor paths", () => {
    assert.equal(
      extractListingId(
        "https://www.jamesallen.com/loose-diamonds/round/987654",
        "james-allen",
      ),
      "987654",
    );
  });
});
