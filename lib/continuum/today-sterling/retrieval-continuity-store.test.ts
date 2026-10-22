import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemorySterlingThreadVerificationStore } from "./retrieval-continuity-store";
import type { SterlingThreadVerificationMetadata } from "./retrieval-continuity";

function row(overrides: Partial<SterlingThreadVerificationMetadata> = {}): SterlingThreadVerificationMetadata {
  return {
    threadKeyDigest: "a".repeat(64),
    indexedFingerprint: "b".repeat(64),
    verifiedAt: "2026-10-22T12:00:00.000Z",
    expiresAt: "2026-10-22T12:15:00.000Z",
    latestIndexedMessageAt: "2026-10-22T11:59:00.000Z",
    indexedMessageCount: 4,
    outcome: "complete_live",
    revision: 1,
    ...overrides,
  };
}

describe("Sterling verification continuity store", () => {
  it("makes exact writes idempotent", async () => {
    const store = new InMemorySterlingThreadVerificationStore();
    assert.equal(await store.save(row(), null), "stored");
    assert.equal(await store.save(row(), null), "stored");
    const loaded = await store.load([row().threadKeyDigest]);
    assert.equal(loaded.available, true);
    assert.equal(loaded.rows[0]?.revision, 1);
  });

  it("prevents two stale concurrent writers from both advancing a row", async () => {
    const store = new InMemorySterlingThreadVerificationStore([row()]);
    const first = row({ indexedFingerprint: "c".repeat(64), verifiedAt: "2026-10-22T12:01:00.000Z",
      expiresAt: "2026-10-22T12:16:00.000Z" });
    const second = row({ indexedFingerprint: "d".repeat(64), verifiedAt: "2026-10-22T12:02:00.000Z",
      expiresAt: "2026-10-22T12:17:00.000Z" });
    const results = await Promise.all([store.save(first, 1), store.save(second, 1)]);
    assert.deepEqual(results.sort(), ["conflict", "stored"]);
    const loaded = await store.load([row().threadKeyDigest]);
    assert.equal(loaded.rows[0]?.revision, 2);
  });

  it("fails closed when persistence is unavailable", async () => {
    const store = new InMemorySterlingThreadVerificationStore([row()]);
    store.available = false;
    assert.deepEqual(await store.load([row().threadKeyDigest]), { available: false, rows: [] });
    assert.equal(await store.save(row(), 1), "unavailable");
  });
});
