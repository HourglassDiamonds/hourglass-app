/** Diamond Intelligence upload rate limits — durable across serverless instances. */

import { consumeRateLimitWindows } from "@/lib/security/abuse-rate-limit";
import {
  getRequestClientIp,
  missingProductionClientIpResult,
  resolveAbuseLimiterIdentity,
} from "@/lib/security/client-ip";
import {
  resetMemoryAbuseRateLimitStore,
  setAbuseRateLimitStoreForTests,
  type AbuseRateLimitStore,
} from "@/lib/security/abuse-rate-limit-store";

export const DI_RATE_LIMIT_HOURLY = 10;
export const DI_RATE_LIMIT_DAILY = 25;
/** Short burst window before hourly/daily caps apply. */
export const DI_RATE_LIMIT_BURST_MAX = 3;
export const DI_RATE_LIMIT_BURST_WINDOW_MS = 60_000;

export const DI_RATE_LIMIT_ERROR =
  "Too many reports submitted. Please try again later.";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const DI_RATE_LIMIT_WINDOWS = [
  {
    name: "burst",
    limit: DI_RATE_LIMIT_BURST_MAX,
    windowMs: DI_RATE_LIMIT_BURST_WINDOW_MS,
  },
  { name: "hourly", limit: DI_RATE_LIMIT_HOURLY, windowMs: ONE_HOUR_MS },
  { name: "daily", limit: DI_RATE_LIMIT_DAILY, windowMs: ONE_DAY_MS },
] as const;

/** Bypass only outside production — never honor disable flag in production. */
function isRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.DI_RATE_LIMIT_DISABLED === "1";
}

export function getDiamondIntelligenceClientIp(request: Request): string {
  return getRequestClientIp(request);
}

export type DiamondIntelligenceRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function checkDiamondIntelligenceRateLimit(
  ip: string,
  now = Date.now(),
  store?: AbuseRateLimitStore,
): Promise<DiamondIntelligenceRateLimitResult> {
  if (isRateLimitDisabled()) {
    return { allowed: true };
  }

  const identity = resolveAbuseLimiterIdentity(ip);
  if (identity === null) {
    return missingProductionClientIpResult();
  }
  return consumeRateLimitWindows({
    namespace: "diamond-intelligence",
    identity,
    windows: [...DI_RATE_LIMIT_WINDOWS],
    now,
    store,
  });
}

/** Test helper — clears in-memory state. */
export function resetDiamondIntelligenceRateLimits(): void {
  resetMemoryAbuseRateLimitStore();
  setAbuseRateLimitStoreForTests(null);
}
