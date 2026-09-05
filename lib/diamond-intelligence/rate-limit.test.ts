import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  checkDiamondIntelligenceRateLimit,
  DI_RATE_LIMIT_BURST_MAX,
  DI_RATE_LIMIT_DAILY,
  DI_RATE_LIMIT_HOURLY,
  resetDiamondIntelligenceRateLimits,
} from "./rate-limit";
import {
  createMemoryAbuseRateLimitStore,
  failClosedAbuseRateLimitStore,
  setAbuseRateLimitStoreForTests,
} from "@/lib/security/abuse-rate-limit-store";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => Promise<void> | void,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

describe("checkDiamondIntelligenceRateLimit", () => {
  beforeEach(() => {
    resetDiamondIntelligenceRateLimits();
    process.env.DI_RATE_LIMIT_DISABLED = "0";
  });

  afterEach(() => {
    setAbuseRateLimitStoreForTests(null);
    resetDiamondIntelligenceRateLimits();
  });

  it("allows requests under burst, hourly, and daily caps", async () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
      const result = await checkDiamondIntelligenceRateLimit("1.2.3.4", now + i);
      assert.equal(result.allowed, true);
    }
  });

  it("blocks burst traffic beyond the short window allowance", async () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
      assert.equal(
        (await checkDiamondIntelligenceRateLimit("10.0.0.1", now + i)).allowed,
        true,
      );
    }
    const blocked = await checkDiamondIntelligenceRateLimit(
      "10.0.0.1",
      now + DI_RATE_LIMIT_BURST_MAX,
    );
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterSeconds >= 1);
    }
  });

  it("blocks hourly traffic after the hourly cap", async () => {
    const hourMs = 60 * 60 * 1000;
    const now = Math.floor(Date.now() / hourMs) * hourMs;
    for (let i = 0; i < DI_RATE_LIMIT_HOURLY; i += 1) {
      await checkDiamondIntelligenceRateLimit("10.0.0.2", now + i * 120_000);
    }
    const blocked = await checkDiamondIntelligenceRateLimit(
      "10.0.0.2",
      now + DI_RATE_LIMIT_HOURLY * 120_000,
    );
    assert.equal(blocked.allowed, false);
  });

  it("blocks daily traffic after the daily cap", async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    let t = Math.floor(Date.now() / dayMs) * dayMs;
    let count = 0;
    while (count < DI_RATE_LIMIT_DAILY) {
      const result = await checkDiamondIntelligenceRateLimit("10.0.0.3", t);
      assert.equal(result.allowed, true, `request ${count + 1}`);
      count += 1;
      t += 70_000;
      if (count % DI_RATE_LIMIT_HOURLY === 0) {
        t += 3_600_000;
      }
    }
    const blocked = await checkDiamondIntelligenceRateLimit("10.0.0.3", t);
    assert.equal(blocked.allowed, false);
  });

  it("tracks limits independently per IP", async () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
      await checkDiamondIntelligenceRateLimit("10.0.0.4", now + i);
    }
    assert.equal(
      (await checkDiamondIntelligenceRateLimit("10.0.0.5", now)).allowed,
      true,
    );
  });

  it("does not let concurrent requests trivially bypass the burst cap", async () => {
    const now = Date.now();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        checkDiamondIntelligenceRateLimit("203.0.113.9", now),
      ),
    );
    const allowed = results.filter((result) => result.allowed).length;
    assert.equal(allowed, DI_RATE_LIMIT_BURST_MAX);
  });

  it("ignores DI_RATE_LIMIT_DISABLED=1 when NODE_ENV is production", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        DI_RATE_LIMIT_DISABLED: "1",
      },
      async () => {
        resetDiamondIntelligenceRateLimits();
        const now = Date.now();
        for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
          assert.equal(
            (await checkDiamondIntelligenceRateLimit("10.0.0.6", now + i))
              .allowed,
            true,
          );
        }
        assert.equal(
          (
            await checkDiamondIntelligenceRateLimit(
              "10.0.0.6",
              now + DI_RATE_LIMIT_BURST_MAX,
            )
          ).allowed,
          false,
        );
      },
    );
  });

  it("ignores DI_RATE_LIMIT_DISABLED=1 when VERCEL_ENV is production", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        DI_RATE_LIMIT_DISABLED: "1",
      },
      async () => {
        resetDiamondIntelligenceRateLimits();
        const now = Date.now();
        for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
          assert.equal(
            (await checkDiamondIntelligenceRateLimit("10.0.0.7", now + i))
              .allowed,
            true,
          );
        }
        assert.equal(
          (
            await checkDiamondIntelligenceRateLimit(
              "10.0.0.7",
              now + DI_RATE_LIMIT_BURST_MAX,
            )
          ).allowed,
          false,
        );
      },
    );
  });

  it("honors DI_RATE_LIMIT_DISABLED=1 outside production", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        DI_RATE_LIMIT_DISABLED: "1",
      },
      async () => {
        resetDiamondIntelligenceRateLimits();
        const now = Date.now();
        for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX + 5; i += 1) {
          assert.equal(
            (await checkDiamondIntelligenceRateLimit("10.0.0.8", now + i))
              .allowed,
            true,
          );
        }
      },
    );
  });

  it("fails closed when the durable store throws", async () => {
    setAbuseRateLimitStoreForTests({
      async consume() {
        throw new Error("store-unavailable");
      },
    });
    const result = await checkDiamondIntelligenceRateLimit("10.0.0.9");
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.ok(result.retryAfterSeconds >= 1);
    }
  });

  it("fails closed when limiter storage is explicitly fail-closed", async () => {
    setAbuseRateLimitStoreForTests(failClosedAbuseRateLimitStore);
    const result = await checkDiamondIntelligenceRateLimit("10.0.0.10");
    assert.equal(result.allowed, false);
  });

  it("fails closed when Vercel production has no client identity", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      },
      async () => {
        resetDiamondIntelligenceRateLimits();
        const store = createMemoryAbuseRateLimitStore();
        const result = await checkDiamondIntelligenceRateLimit("", Date.now(), store);
        assert.equal(result.allowed, false);
        assert.equal(store.debugLiveRowCount?.() ?? 0, 0);
      },
    );
  });

  it("does not persist raw IP addresses in limiter keys", async () => {
    const store = createMemoryAbuseRateLimitStore();
    const ip = "203.0.113.44";
    await checkDiamondIntelligenceRateLimit(ip, Date.now(), store);
    const keys = store.debugBucketKeys?.() ?? [];
    assert.ok(keys.length >= 1);
    for (const key of keys) {
      assert.match(key, /^[a-f0-9]{64}$/);
      assert.equal(key.includes(ip), false);
    }
  });
});
