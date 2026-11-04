import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GmailHttpError,
  classifyGmailForbiddenErrorBody,
  createLiveGmailApi,
  isRetryableGmailError,
} from "./adapter";

describe("Gmail forbidden diagnostics", () => {
  it("maps only allowlisted structured Google reasons", () => {
    const cases = [
      ["insufficientPermissions", "insufficient_permissions"],
      ["ACCESS_TOKEN_SCOPE_INSUFFICIENT", "insufficient_permissions"],
      ["domainPolicy", "domain_policy"],
      ["dailyLimitExceeded", "quota_exceeded"],
      ["quotaExceeded", "quota_exceeded"],
      ["rateLimitExceeded", "rate_limited"],
      ["userRateLimitExceeded", "rate_limited"],
    ] as const;

    for (const [reason, expected] of cases) {
      assert.equal(
        classifyGmailForbiddenErrorBody(
          JSON.stringify({ error: { errors: [{ reason }] } }),
        ),
        expected,
      );
    }
  });

  it("fails closed for malformed and unknown reasons", () => {
    assert.equal(
      classifyGmailForbiddenErrorBody("not-json"),
      "unknown_forbidden",
    );
    assert.equal(
      classifyGmailForbiddenErrorBody(
        JSON.stringify({
          error: {
            message: "private diagnostic text",
            errors: [{ reason: "newGoogleReason", privateId: "secret-id" }],
          },
        }),
      ),
      "unknown_forbidden",
    );
    assert.equal(
      isRetryableGmailError(
        new GmailHttpError(403, "http", undefined, "rate_limited"),
      ),
      true,
    );
  });

  it("retains only a safe category on a live 403 error", async () => {
    const originalFetch = globalThis.fetch;
    const privateMarker = "PRIVATE_GOOGLE_ERROR_BODY";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: privateMarker,
            details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }],
          },
        }),
        { status: 403 },
      );

    try {
      await assert.rejects(
        () => createLiveGmailApi("private-access-token").getThread("thread"),
        (error: unknown) => {
          assert.ok(error instanceof GmailHttpError);
          assert.equal(error.status, 403);
          assert.equal(error.forbiddenCategory, "insufficient_permissions");
          assert.equal(isRetryableGmailError(error), false);
          assert.doesNotMatch(error.message, new RegExp(privateMarker));
          assert.doesNotMatch(JSON.stringify(error), /PRIVATE|access-token|thread/);
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
