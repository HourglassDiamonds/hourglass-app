import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGmailIndexUpdatedAt,
  isGmailIndexStale,
} from "./index-freshness";

describe("Gmail index freshness", () => {
  it("treats a missing or old incremental checkpoint as stale", () => {
    const now = "2026-09-08T19:27:00.000Z";
    assert.equal(isGmailIndexStale(null, now), true);
    assert.equal(isGmailIndexStale("", now), true);
    assert.equal(isGmailIndexStale("2026-09-06T13:48:42.125Z", now), true);
    assert.equal(isGmailIndexStale("2026-09-08T18:00:00.000Z", now), false);
    assert.equal(
      isGmailIndexStale("2026-09-08T19:26:30.000Z", now, 60_000),
      false,
    );
    assert.equal(
      isGmailIndexStale("2026-09-08T19:25:00.000Z", now, 60_000),
      true,
    );
  });

  it("formats the last successful sync for the founder timezone", () => {
    assert.equal(formatGmailIndexUpdatedAt(null), null);
    assert.equal(formatGmailIndexUpdatedAt("not-a-date"), null);
    assert.equal(
      formatGmailIndexUpdatedAt("2026-09-06T13:48:42.125Z"),
      "Sep 6, 2026, 9:48 AM",
    );
  });
});
