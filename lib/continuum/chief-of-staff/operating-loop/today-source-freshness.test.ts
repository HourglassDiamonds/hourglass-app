import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { todaySourceFreshnessLabel } from "./today-refresh";

describe("Today source freshness presentation", () => {
  it("quietly reports checking, current age, and degraded email freshness", () => {
    assert.equal(todaySourceFreshnessLabel({ health: "checking", lastCheckedAt: null, nowMs: 45_000 }), "Checking for updates…");
    assert.equal(todaySourceFreshnessLabel({ health: "current", lastCheckedAt: 0, nowMs: 45_000 }), "Updated 45s ago");
    assert.equal(todaySourceFreshnessLabel({ health: "delayed", lastCheckedAt: 0, nowMs: 45_000 }), "Email source delayed");
  });
});
