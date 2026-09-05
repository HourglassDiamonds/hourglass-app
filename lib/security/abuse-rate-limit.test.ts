import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeRateLimitWindows,
} from "./abuse-rate-limit";
import {
  createMemoryAbuseRateLimitStore,
  failClosedAbuseRateLimitStore,
} from "./abuse-rate-limit-store";
import { createSupabaseAbuseRateLimitStore } from "./abuse-rate-limit-supabase";
import { hashAbuseBucketKey } from "./abuse-key";

describe("durable abuse rate limit primitive", () => {
  it("isolates separate keys", async () => {
    const store = createMemoryAbuseRateLimitStore();
    const windows = [{ name: "burst", limit: 1, windowMs: 60_000 }];
    const now = Date.now();
    assert.equal(
      (
        await consumeRateLimitWindows({
          namespace: "test",
          identity: "a",
          windows,
          now,
          store,
        })
      ).allowed,
      true,
    );
    assert.equal(
      (
        await consumeRateLimitWindows({
          namespace: "test",
          identity: "a",
          windows,
          now,
          store,
        })
      ).allowed,
      false,
    );
    assert.equal(
      (
        await consumeRateLimitWindows({
          namespace: "test",
          identity: "b",
          windows,
          now,
          store,
        })
      ).allowed,
      true,
    );
  });

  it("hashes identities so raw IPs are not stored", () => {
    const ip = "198.51.100.20";
    const key = hashAbuseBucketKey({
      namespace: "test",
      windowName: "burst",
      identity: ip,
    });
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key.includes(ip), false);
  });

  it("maps a supabase RPC success row", async () => {
    const store = createSupabaseAbuseRateLimitStore({
      rpc: async () => ({
        data: [{ allowed: true, retry_after_seconds: 0, hit_count: 1 }],
        error: null,
      }),
    } as never);
    const result = await store.consume({
      bucketKey: "a".repeat(64),
      windowStartEpochMs: 0,
      windowMs: 60_000,
      limit: 3,
      nowEpochMs: 1,
    });
    assert.equal(result.allowed, true);
    assert.equal(result.hitCount, 1);
  });

  it("throws on supabase RPC failure so callers fail closed", async () => {
    const store = createSupabaseAbuseRateLimitStore({
      rpc: async () => ({
        data: null,
        error: { message: "function missing" },
      }),
    } as never);
    await assert.rejects(() =>
      store.consume({
        bucketKey: "a".repeat(64),
        windowStartEpochMs: 0,
        windowMs: 60_000,
        limit: 3,
        nowEpochMs: 1,
      }),
    );
  });

  it("uses fail-closed store as deny-all", async () => {
    const result = await failClosedAbuseRateLimitStore.consume({
      bucketKey: "a".repeat(64),
      windowStartEpochMs: 0,
      windowMs: 60_000,
      limit: 10,
      nowEpochMs: 1,
    });
    assert.equal(result.allowed, false);
  });

  it("reuses one row per stable key across window instances so retention stays bounded", async () => {
    const store = createMemoryAbuseRateLimitStore();
    const windows = [{ name: "burst", limit: 2, windowMs: 60_000 }];
    const t0 = 1_700_000_000_000;

    assert.equal(
      (
        await consumeRateLimitWindows({
          namespace: "retention",
          identity: "203.0.113.90",
          windows,
          now: t0,
          store,
        })
      ).allowed,
      true,
    );
    assert.equal(
      (
        await consumeRateLimitWindows({
          namespace: "retention",
          identity: "203.0.113.90",
          windows,
          now: t0 + 1,
          store,
        })
      ).allowed,
      true,
    );
    assert.equal(
      (
        await consumeRateLimitWindows({
          namespace: "retention",
          identity: "203.0.113.90",
          windows,
          now: t0 + 2,
          store,
        })
      ).allowed,
      false,
    );

    const nextWindow = await consumeRateLimitWindows({
      namespace: "retention",
      identity: "203.0.113.90",
      windows,
      now: t0 + 60_000,
      store,
    });
    assert.equal(nextWindow.allowed, true);
    assert.equal(store.debugLiveRowCount?.(), 1);
    assert.equal(store.debugBucketKeys?.().length, 1);

    await consumeRateLimitWindows({
      namespace: "retention",
      identity: "198.51.100.2",
      windows,
      now: t0,
      store,
    });
    assert.equal(store.debugLiveRowCount?.(), 2);

    await consumeRateLimitWindows({
      namespace: "retention",
      identity: "198.51.100.2",
      windows,
      now: t0 + 120_000,
      store,
    });
    assert.equal(
      store.debugLiveRowCount?.(),
      1,
      "expired other-identity rows are swept; current key is reused not duplicated",
    );
  });
});
