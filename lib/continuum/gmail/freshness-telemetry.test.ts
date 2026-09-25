import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GMAIL_FRESHNESS_RUN_EVENT,
  GMAIL_FRESHNESS_RUN_FIELDS,
  classifyGmailFreshnessRun,
  emitGmailFreshnessRun,
} from "./freshness-telemetry";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function capture(run: () => void): Record<string, unknown> {
  let parsed: Record<string, unknown> | null = null;
  const original = console.info;
  console.info = (message?: unknown) => {
    if (typeof message === "string" && message.includes(GMAIL_FRESHNESS_RUN_EVENT)) {
      parsed = JSON.parse(message) as Record<string, unknown>;
    }
  };
  try {
    run();
  } finally {
    console.info = original;
  }
  assert.ok(parsed);
  return parsed;
}

describe("Gmail freshness cron telemetry", () => {
  it("records a completed run without an error category", () => {
    const event = classifyGmailFreshnessRun({
      safeErrorCode: null,
      durationMs: 40,
      indexedThisCycle: 2,
      sourceEventsChanged: true,
      morePagesRemain: false,
      completed: true,
    });
    assert.equal(event.outcome, "success");
    assert.equal(event.stage, "complete");
    assert.equal(event.errorCategory, null);
    assert.equal(event.messagesIndexedCount, 2);
    assert.equal(event.watermarkChanged, true);
    assert.equal(event.catchupSucceeded, true);
    const logged = capture(() => emitGmailFreshnessRun(event));
    assert.deepEqual(Object.keys(logged), [...GMAIL_FRESHNESS_RUN_FIELDS]);
    assert.equal(JSON.stringify(logged).includes("client@example.com"), false);
  });

  it("maps token refresh failure without copying a token", () => {
    const event = classifyGmailFreshnessRun({
      safeErrorCode: "token-refresh-failed",
      durationMs: 12,
    });
    assert.equal(event.outcome, "failed");
    assert.equal(event.stage, "token_refresh");
    assert.equal(event.errorCategory, "token_refresh_failed");
    const logged = capture(() => emitGmailFreshnessRun({
      ...event,
      messagesObservedCount: 3,
    }));
    assert.equal(logged.messagesObservedCount, null);
    assert.equal(JSON.stringify(logged).includes("ya29."), false);
  });

  it("maps an overlapping run to skipped concurrency", () => {
    const event = classifyGmailFreshnessRun({
      safeErrorCode: "gmail-sync-already-running",
      durationMs: 5,
      morePagesRemain: true,
      completed: false,
    });
    assert.equal(event.outcome, "skipped");
    assert.equal(event.stage, "gmail_fetch");
    assert.equal(event.errorCategory, "concurrency");
    assert.equal(event.catchupNeeded, true);
    assert.equal(event.catchupSucceeded, false);
  });

  it("maps candidate storage failure to a supabase read", () => {
    const event = classifyGmailFreshnessRun({
      safeErrorCode: "candidate-store-unavailable",
      durationMs: 8,
    });
    assert.equal(event.stage, "index_write");
    assert.equal(event.errorCategory, "supabase_read");
  });

  it("names refresh sub-stages without provider text", () => {
    const cases = [
      ["gmail-not-connected", "connection", "connection_missing"],
      ["decrypt-failed", "connection", "token_decrypt_failed"],
      ["refresh-token-rotated", "token_refresh", "refresh_token_rotated"],
      ["invalid_grant", "token_refresh", "provider_invalid_grant"],
    ] as const;
    for (const [code, stage, category] of cases) {
      const event = classifyGmailFreshnessRun({ safeErrorCode: code, durationMs: 4 });
      assert.equal(event.stage, stage);
      assert.equal(event.refreshFailureCategory, category);
    }
    const provider = classifyGmailFreshnessRun({
      safeErrorCode: "token-refresh-failed",
      durationMs: 9,
      refreshFailureCategory: "provider_invalid_client",
      refreshRequestAttempted: true,
      refreshRequestSucceeded: false,
      refreshedAccessTokenPresent: false,
    });
    assert.equal(provider.stage, "token_refresh");
    assert.equal(provider.errorCategory, "token_refresh_failed");
    assert.equal(provider.refreshFailureCategory, "provider_invalid_client");
    assert.equal(provider.tokenDecryptSucceeded, true);
    const logged = capture(() => emitGmailFreshnessRun({
      ...provider,
      refreshFailureCategory: "provider_invalid_grant",
    }));
    const text = JSON.stringify(logged);
    assert.equal(text.includes("Token has been expired"), false);
    assert.equal(text.includes("ya29."), false);
    assert.equal(logged.refreshFailureCategory, "provider_invalid_grant");
  });

  it("records a successful refresh without a failure category", () => {
    const event = classifyGmailFreshnessRun({
      safeErrorCode: null,
      durationMs: 20,
      completed: true,
      refreshRequestAttempted: true,
      refreshRequestSucceeded: true,
      refreshedAccessTokenPresent: true,
      refreshFailureCategory: "provider_invalid_grant",
    });
    assert.equal(event.outcome, "success");
    assert.equal(event.refreshFailureCategory, null);
    assert.equal(event.refreshRequestSucceeded, true);
    assert.equal(event.refreshedAccessTokenPresent, true);
  });

  it("keeps cron status behavior and does not log mailbox fields", () => {
    const route = readFileSync(
      join(ROOT, "app/api/cron/continuum-gmail-freshness/route.ts"),
      "utf8",
    );
    assert.match(route, /ok \? 200 : 500/);
    assert.match(route, /gmail-sync-already-running/);
    assert.match(route, /error: "freshness_failed"/);
    assert.match(route, /emitGmailFreshnessRun/);
    assert.doesNotMatch(route, /subject|snippet|threadId|messageId|mailboxEmailHash/);
    const responseBody = route.slice(route.indexOf("return json("), route.indexOf("ok ? 200"));
    assert.doesNotMatch(responseBody, /refreshFailureCategory|accessToken|refreshToken/);
    const oauth = readFileSync(join(ROOT, "lib/continuum/gmail/oauth.ts"), "utf8");
    const run = readFileSync(join(ROOT, "lib/continuum/gmail/freshness-run.ts"), "utf8");
    assert.doesNotMatch(oauth, /CONTINUUM_CALENDAR/);
    assert.doesNotMatch(run, /CONTINUUM_CALENDAR/);
  });
});
