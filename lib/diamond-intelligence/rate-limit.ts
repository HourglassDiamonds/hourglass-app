/** Diamond Intelligence upload rate limits — per client IP. */

export const DI_RATE_LIMIT_HOURLY = 10;
export const DI_RATE_LIMIT_DAILY = 25;
/** Short burst window before hourly/daily caps apply. */
export const DI_RATE_LIMIT_BURST_MAX = 3;
export const DI_RATE_LIMIT_BURST_WINDOW_MS = 60_000;

export const DI_RATE_LIMIT_ERROR =
  "Too many reports submitted. Please try again later.";

type RateLimitBucket = {
  timestamps: number[];
};

const buckets = new Map<string, RateLimitBucket>();

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** Bypass only outside production — never honor disable flag in production. */
function isRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.DI_RATE_LIMIT_DISABLED === "1";
}

export function getDiamondIntelligenceClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export type DiamondIntelligenceRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function pruneTimestamps(timestamps: number[], now: number): number[] {
  const cutoff = now - ONE_DAY_MS;
  return timestamps.filter((t) => t >= cutoff);
}

/** In-memory per-IP limiter — best-effort on serverless; resets on cold starts. */
export function checkDiamondIntelligenceRateLimit(
  ip: string,
  now = Date.now(),
): DiamondIntelligenceRateLimitResult {
  if (isRateLimitDisabled()) {
    return { allowed: true };
  }

  const key = ip || "unknown";
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = pruneTimestamps(bucket.timestamps, now);

  const hourAgo = now - ONE_HOUR_MS;
  const burstAgo = now - DI_RATE_LIMIT_BURST_WINDOW_MS;
  const inLastHour = bucket.timestamps.filter((t) => t >= hourAgo).length;
  const inLastDay = bucket.timestamps.length;
  const inBurst = bucket.timestamps.filter((t) => t >= burstAgo).length;

  if (inBurst >= DI_RATE_LIMIT_BURST_MAX) {
    const oldestBurst = bucket.timestamps.find((t) => t >= burstAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldestBurst + DI_RATE_LIMIT_BURST_WINDOW_MS - now) / 1000),
      ),
    };
  }

  if (inLastHour >= DI_RATE_LIMIT_HOURLY) {
    const oldestHour = bucket.timestamps.find((t) => t >= hourAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldestHour + ONE_HOUR_MS - now) / 1000),
      ),
    };
  }

  if (inLastDay >= DI_RATE_LIMIT_DAILY) {
    const oldestDay = bucket.timestamps[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldestDay + ONE_DAY_MS - now) / 1000),
      ),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true };
}

/** Test helper — clears in-memory state. */
export function resetDiamondIntelligenceRateLimits(): void {
  buckets.clear();
}
