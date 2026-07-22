import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET } from "@/app/api/cron/diamond-intelligence-submission-cleanup/route";

const ORIGINAL_ENV = { ...process.env };

describe("DI submission cleanup cron route auth", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects missing cron auth", async () => {
    process.env.CRON_SECRET = "test-di-cleanup-secret";
    const response = await GET(
      new Request(
        "https://example.com/api/cron/diamond-intelligence-submission-cleanup",
      ),
    );
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "Unauthorized");
  });

  it("rejects invalid cron auth", async () => {
    process.env.CRON_SECRET = "test-di-cleanup-secret";
    const response = await GET(
      new Request(
        "https://example.com/api/cron/diamond-intelligence-submission-cleanup",
        {
          headers: { authorization: "Bearer wrong-secret" },
        },
      ),
    );
    assert.equal(response.status, 401);
  });

  it("fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(
      new Request(
        "https://example.com/api/cron/diamond-intelligence-submission-cleanup",
        {
          headers: { authorization: "Bearer anything" },
        },
      ),
    );
    assert.equal(response.status, 401);
  });

  it("does not accept query-string secrets", async () => {
    process.env.CRON_SECRET = "test-di-cleanup-secret";
    const response = await GET(
      new Request(
        "https://example.com/api/cron/diamond-intelligence-submission-cleanup?secret=test-di-cleanup-secret",
      ),
    );
    assert.equal(response.status, 401);
  });
});
