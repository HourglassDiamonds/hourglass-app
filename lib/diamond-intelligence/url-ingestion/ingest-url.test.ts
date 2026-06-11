import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveUrlIngestionStatus } from "./ingest-url";

describe("resolveUrlIngestionStatus", () => {
  it("returns partial listing status", () => {
    assert.equal(
      resolveUrlIngestionStatus({
        ok: true,
        status: "listing_found_no_report",
        listing: {} as never,
        message: "no report",
      }),
      "listing_found_no_report",
    );
  });

  it("returns unsupported vendor status", () => {
    assert.equal(
      resolveUrlIngestionStatus({
        ok: false,
        status: "unsupported_vendor",
        error: "unsupported",
      }),
      "unsupported_vendor",
    );
  });
});
