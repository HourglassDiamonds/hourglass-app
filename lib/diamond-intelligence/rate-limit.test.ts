import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  checkDiamondIntelligenceRateLimit,
  DI_RATE_LIMIT_BURST_MAX,
  DI_RATE_LIMIT_DAILY,
  DI_RATE_LIMIT_HOURLY,
  resetDiamondIntelligenceRateLimits,
} from "./rate-limit";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("checkDiamondIntelligenceRateLimit", () => {
  beforeEach(() => {
    resetDiamondIntelligenceRateLimits();
    process.env.DI_RATE_LIMIT_DISABLED = "0";
  });

  it("allows requests under burst, hourly, and daily caps", () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
      const result = checkDiamondIntelligenceRateLimit("1.2.3.4", now + i);
      assert.equal(result.allowed, true);
    }
  });

  it("blocks burst traffic beyond the short window allowance", () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
      assert.equal(
        checkDiamondIntelligenceRateLimit("10.0.0.1", now + i).allowed,
        true,
      );
    }
    const blocked = checkDiamondIntelligenceRateLimit(
      "10.0.0.1",
      now + DI_RATE_LIMIT_BURST_MAX,
    );
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterSeconds >= 1);
    }
  });

  it("blocks hourly traffic after the hourly cap", () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_HOURLY; i += 1) {
      checkDiamondIntelligenceRateLimit("10.0.0.2", now + i * 120_000);
    }
    const blocked = checkDiamondIntelligenceRateLimit(
      "10.0.0.2",
      now + DI_RATE_LIMIT_HOURLY * 120_000,
    );
    assert.equal(blocked.allowed, false);
  });

  it("blocks daily traffic after the daily cap", () => {
    let t = Date.now();
    let count = 0;
    while (count < DI_RATE_LIMIT_DAILY) {
      const result = checkDiamondIntelligenceRateLimit("10.0.0.3", t);
      assert.equal(result.allowed, true, `request ${count + 1}`);
      count += 1;
      t += 70_000;
      if (count % DI_RATE_LIMIT_HOURLY === 0) {
        t += 3_600_000;
      }
    }
    const blocked = checkDiamondIntelligenceRateLimit("10.0.0.3", t);
    assert.equal(blocked.allowed, false);
  });

  it("tracks limits independently per IP", () => {
    const now = Date.now();
    for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
      checkDiamondIntelligenceRateLimit("10.0.0.4", now + i);
    }
    assert.equal(
      checkDiamondIntelligenceRateLimit("10.0.0.5", now).allowed,
      true,
    );
  });

  it("ignores DI_RATE_LIMIT_DISABLED=1 when NODE_ENV is production", () => {
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        DI_RATE_LIMIT_DISABLED: "1",
      },
      () => {
        resetDiamondIntelligenceRateLimits();
        const now = Date.now();
        for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
          assert.equal(
            checkDiamondIntelligenceRateLimit("10.0.0.6", now + i).allowed,
            true,
          );
        }
        assert.equal(
          checkDiamondIntelligenceRateLimit(
            "10.0.0.6",
            now + DI_RATE_LIMIT_BURST_MAX,
          ).allowed,
          false,
        );
      },
    );
  });

  it("ignores DI_RATE_LIMIT_DISABLED=1 when VERCEL_ENV is production", () => {
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        DI_RATE_LIMIT_DISABLED: "1",
      },
      () => {
        resetDiamondIntelligenceRateLimits();
        const now = Date.now();
        for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX; i += 1) {
          assert.equal(
            checkDiamondIntelligenceRateLimit("10.0.0.7", now + i).allowed,
            true,
          );
        }
        assert.equal(
          checkDiamondIntelligenceRateLimit(
            "10.0.0.7",
            now + DI_RATE_LIMIT_BURST_MAX,
          ).allowed,
          false,
        );
      },
    );
  });

  it("honors DI_RATE_LIMIT_DISABLED=1 outside production", () => {
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        DI_RATE_LIMIT_DISABLED: "1",
      },
      () => {
        resetDiamondIntelligenceRateLimits();
        const now = Date.now();
        for (let i = 0; i < DI_RATE_LIMIT_BURST_MAX + 5; i += 1) {
          assert.equal(
            checkDiamondIntelligenceRateLimit("10.0.0.8", now + i).allowed,
            true,
          );
        }
      },
    );
  });
});
