import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DiamondIntelligenceUploadError,
} from "./client-upload-error";
import { CLIENT_RATE_LIMIT_ERROR } from "./client-interpret-messages";

describe("rate_limited upload client error", () => {
  it("carries retry-after seconds for dedicated rate-limit UI", () => {
    const err = new DiamondIntelligenceUploadError(
      CLIENT_RATE_LIMIT_ERROR,
      "rate_limited",
      "rate_limited",
      38,
    );

    assert.equal(err.kind, "rate_limited");
    assert.equal(err.code, "rate_limited");
    assert.equal(err.retryAfterSeconds, 38);
  });
});
