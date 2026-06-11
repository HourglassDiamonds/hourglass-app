import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractFromStructuredData,
  normalizeListingExtraction,
} from "./structured-extractors";

describe("normalizeListingExtraction", () => {
  it("normalizes partial structured data into ListingExtraction", () => {
    const listing = normalizeListingExtraction({
      vendor: "blue-nile",
      url: "https://www.bluenile.com/diamond-details/abc",
      canonicalUrl: "https://www.bluenile.com/diamond-details/abc",
      listingId: "abc",
      partial: {
        shape: "Round",
        carat: 1.01,
        color: "G",
        clarity: "VS1",
        price: 5200,
        currency: "USD",
        extractionWarnings: [],
      },
    });

    assert.equal(listing.vendor, "blue-nile");
    assert.equal(listing.shape, "Round");
    assert.equal(listing.carat, 1.01);
    assert.equal(listing.extractionConfidence, "high");
    assert.ok(listing.extractedAt);
  });
});

describe("extractFromStructuredData", () => {
  it("extracts product data from json-ld", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "1.02 ct Round Diamond G VS1",
            "offers": { "@type": "Offer", "price": "4890", "priceCurrency": "USD" }
          }
        </script>
      </head><body></body></html>
    `;

    const partial = extractFromStructuredData(html);
    assert.equal(partial.price, 4890);
    assert.equal(partial.currency, "USD");
    assert.equal(partial.carat, 1.02);
  });
});
