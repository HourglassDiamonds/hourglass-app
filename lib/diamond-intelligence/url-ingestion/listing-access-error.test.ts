import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isListingAccessBlockedMessage,
  resolveUrlIngestUploadErrorKind,
} from "./listing-access-error";

describe("isListingAccessBlockedMessage", () => {
  it("detects listing_inaccessible status", () => {
    assert.equal(
      isListingAccessBlockedMessage("listing_inaccessible", "anything"),
      true,
    );
  });

  it("detects HTTP 403 in error text", () => {
    assert.equal(
      isListingAccessBlockedMessage(undefined, "Listing returned HTTP 403."),
      true,
    );
  });

  it("does not classify interpret failures", () => {
    assert.equal(
      isListingAccessBlockedMessage(undefined, "Parser could not read report"),
      false,
    );
  });
});

describe("resolveUrlIngestUploadErrorKind", () => {
  it("maps blocked listing access to listing_inaccessible", () => {
    assert.equal(
      resolveUrlIngestUploadErrorKind(
        "listing_inaccessible",
        "Listing returned HTTP 403.",
      ),
      "listing_inaccessible",
    );
  });

  it("maps other ingest failures to interpret_failure", () => {
    assert.equal(
      resolveUrlIngestUploadErrorKind("invalid_url", "Invalid URL"),
      "interpret_failure",
    );
  });
});
