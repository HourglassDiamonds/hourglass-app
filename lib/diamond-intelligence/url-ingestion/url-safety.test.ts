import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPdfOrReportUrl, validateListingUrl } from "./url-safety";

describe("validateListingUrl", () => {
  it("accepts public https retailer urls", () => {
    const result = validateListingUrl(
      "https://www.jamesallen.com/loose-diamonds/round/123",
    );
    assert.equal(result.ok, true);
  });

  it("rejects localhost and private networks", () => {
    assert.equal(validateListingUrl("http://localhost/diamond").ok, false);
    assert.equal(validateListingUrl("http://127.0.0.1/diamond").ok, false);
    assert.equal(validateListingUrl("http://192.168.1.10/diamond").ok, false);
  });

  it("rejects non-http protocols", () => {
    assert.equal(validateListingUrl("file:///tmp/report.pdf").ok, false);
    assert.equal(validateListingUrl("data:text/html,hello").ok, false);
  });

  it("rejects empty input", () => {
    assert.equal(validateListingUrl("   ").ok, false);
  });
});

describe("isPdfOrReportUrl", () => {
  it("detects pdf and certificate urls", () => {
    assert.equal(
      isPdfOrReportUrl("https://cdn.example.com/reports/123.pdf"),
      true,
    );
    assert.equal(
      isPdfOrReportUrl("https://cdn.example.com/certificate/123"),
      true,
    );
    assert.equal(isPdfOrReportUrl("https://cdn.example.com/image.jpg"), false);
  });
});
