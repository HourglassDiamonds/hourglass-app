import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildListingPageFetchHeaders } from "./fetch-listing-page";
import { listPartialListingDetails } from "./listing-display";
import type { ListingExtraction } from "./types";

describe("buildListingPageFetchHeaders", () => {
  it("uses browser-like accept and user-agent", () => {
    const headers = buildListingPageFetchHeaders(
      "https://www.rarecarat.com/diamond/147275937",
    );
    assert.match(headers.Accept ?? "", /text\/html/);
    assert.match(headers["User-Agent"] ?? "", /Chrome/);
    assert.equal(headers["Accept-Language"], "en-US,en;q=0.9");
  });

  it("sets referer to listing origin", () => {
    const headers = buildListingPageFetchHeaders(
      "https://www.rarecarat.com/diamond/147275937",
    );
    assert.equal(headers.Referer, "https://www.rarecarat.com/");
  });

  it("sets referer for non-rare-carat retailers", () => {
    const headers = buildListingPageFetchHeaders(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(headers.Referer, "https://www.jamesallen.com/");
  });
});

describe("listPartialListingDetails", () => {
  it("lists high-confidence listing fields", () => {
    const listing = {
      vendor: "rare-carat",
      extractionConfidence: "high",
      carat: 2.06,
      color: "I",
      clarity: "VS1",
      shape: "Round",
      lab: "IGI",
    } as ListingExtraction;

    const details = listPartialListingDetails(listing);
    assert.deepEqual(
      details.map((d) => d.label),
      ["Carat", "Color", "Clarity", "Shape", "Lab", "Retailer"],
    );
    assert.equal(details.find((d) => d.label === "Lab")?.value, "IGI");
  });

  it("returns empty for low-confidence listings", () => {
    const listing = {
      vendor: "rare-carat",
      extractionConfidence: "low",
      carat: 2.06,
    } as ListingExtraction;
    assert.deepEqual(listPartialListingDetails(listing), []);
  });
});
