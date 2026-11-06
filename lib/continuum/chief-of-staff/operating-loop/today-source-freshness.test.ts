import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { durableTodayGmailSourceHealth, todaySnapshotFreshnessLabel, todaySourceHealthAfterCycle, todaySourceFreshnessLabel } from "./today-refresh";

describe("Today source freshness presentation", () => {
  it("uses the durable checkpoint instead of a transient foreground request failure", () => {
    assert.equal(durableTodayGmailSourceHealth({ lastSuccessfulSyncAt: "2026-10-05T12:00:00.000Z", nowIso: "2026-10-05T12:02:59.000Z" }), "current");
    assert.equal(durableTodayGmailSourceHealth({ lastSuccessfulSyncAt: "2026-10-05T12:00:00.000Z", nowIso: "2026-10-05T12:03:00.000Z" }), "delayed");
  });

  it("reports persisted snapshot age while source checks continue", () => {
    assert.equal(todaySnapshotFreshnessLabel({ composedAt: "2026-11-06T15:00:00.000Z", nowMs: Date.parse("2026-11-06T15:12:00.000Z") }), "Today snapshot updated 12m ago");
    assert.equal(todaySnapshotFreshnessLabel({ composedAt: null, nowMs: 0 }), null);
  });

  it("quietly reports checking, current age, and degraded email freshness", () => {
    assert.equal(todaySourceFreshnessLabel({ health: "checking", lastCheckedAt: null, nowMs: 45_000 }), "Checking for updates…");
    assert.equal(todaySourceFreshnessLabel({ health: "current", lastCheckedAt: 0, nowMs: 45_000 }), "Updated 45s ago");
    assert.equal(todaySourceFreshnessLabel({ health: "delayed", lastCheckedAt: 0, nowMs: 45_000 }), "Email source delayed");
  });

  it("does not turn a transient foreground/checkpoint read failure into a false delay", () => {
    assert.equal(todaySourceHealthAfterCycle({ requestFulfilled: false, durableSourceHealth: null, safeErrorCode: "gmail-sync-failed" }), "checking");
    assert.equal(todaySourceHealthAfterCycle({ requestFulfilled: true, durableSourceHealth: "checking", safeErrorCode: "gmail-sync-failed" }), "checking");
    assert.equal(todaySourceHealthAfterCycle({ requestFulfilled: true, durableSourceHealth: "delayed", safeErrorCode: null }), "delayed");
  });
});
