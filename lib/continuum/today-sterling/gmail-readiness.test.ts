import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasSuccessfulGmailIngestionAfterAuthorization } from "./gmail-readiness";

describe("Gmail post-authorization readiness", () => {
  const authorizedAt = "2026-11-04T15:00:00.000Z";

  it("rejects an old completed checkpoint even when it is otherwise fresh", () => {
    assert.equal(
      hasSuccessfulGmailIngestionAfterAuthorization(authorizedAt, [
        { status: "completed", errorCode: null, updatedAt: "2026-11-04T14:59:59.999Z" },
      ]),
      false,
    );
  });

  it("rejects post-authorization running and failed checkpoints", () => {
    assert.equal(
      hasSuccessfulGmailIngestionAfterAuthorization(authorizedAt, [
        { status: "running", errorCode: null, updatedAt: "2026-11-04T15:01:00.000Z" },
        { status: "completed", errorCode: "provider-failed", updatedAt: "2026-11-04T15:02:00.000Z" },
      ]),
      false,
    );
  });

  it("accepts only a successful checkpoint created after authorization", () => {
    assert.equal(
      hasSuccessfulGmailIngestionAfterAuthorization(authorizedAt, [
        { status: "completed", errorCode: null, updatedAt: "2026-11-04T15:00:00.001Z" },
      ]),
      true,
    );
  });

  it("fails closed without a valid authorization timestamp", () => {
    assert.equal(
      hasSuccessfulGmailIngestionAfterAuthorization(null, [
        { status: "completed", errorCode: null, updatedAt: "2026-11-04T15:01:00.000Z" },
      ]),
      false,
    );
  });
});
