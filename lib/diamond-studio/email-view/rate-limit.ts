/**
 * IP rate limits for Email This View — same conservative pattern as Concierge.
 * Separate buckets so anonymous Studio mail does not consume Concierge budget.
 */

export const STUDIO_EMAIL_RATE_LIMIT_BURST_MAX = 3;
export const STUDIO_EMAIL_RATE_LIMIT_BURST_WINDOW_MS = 60_000;
export const STUDIO_EMAIL_RATE_LIMIT_HOURLY = 8;
export const STUDIO_EMAIL_RATE_LIMIT_DAILY = 20;

export const STUDIO_EMAIL_RATE_LIMIT_ERROR =
  "We couldn’t send that just now. Please try again in a little while.";

type RateLimitBucket = {
  timestamps: number[];
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 5_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function isRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.STUDIO_EMAIL_RATE_LIMIT_DISABLED === "1";
}

export function getStudioEmailClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 80);
  return "";
}

export type StudioEmailRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function pruneTimestamps(timestamps: number[], now: number): number[] {
  const cutoff = now - ONE_DAY_MS;
  return timestamps.filter((t) => t >= cutoff);
}

function pruneBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    bucket.timestamps = pruneTimestamps(bucket.timestamps, now);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

export function checkStudioEmailRateLimit(
  ip: string,
  now = Date.now(),
): StudioEmailRateLimitResult {
  if (isRateLimitDisabled()) return { allowed: true };

  const key = ip.trim();
  if (!key) return { allowed: true };

  pruneBuckets(now);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = pruneTimestamps(bucket.timestamps, now);

  const hourAgo = now - ONE_HOUR_MS;
  const burstAgo = now - STUDIO_EMAIL_RATE_LIMIT_BURST_WINDOW_MS;
  const inLastHour = bucket.timestamps.filter((t) => t >= hourAgo).length;
  const inLastDay = bucket.timestamps.length;
  const inBurst = bucket.timestamps.filter((t) => t >= burstAgo).length;

  if (inBurst >= STUDIO_EMAIL_RATE_LIMIT_BURST_MAX) {
    const oldestBurst = bucket.timestamps.find((t) => t >= burstAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (oldestBurst + STUDIO_EMAIL_RATE_LIMIT_BURST_WINDOW_MS - now) / 1000,
        ),
      ),
    };
  }

  if (inLastHour >= STUDIO_EMAIL_RATE_LIMIT_HOURLY) {
    const oldestHour = bucket.timestamps.find((t) => t >= hourAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldestHour + ONE_HOUR_MS - now) / 1000),
      ),
    };
  }

  if (inLastDay >= STUDIO_EMAIL_RATE_LIMIT_DAILY) {
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

export function resetStudioEmailRateLimits(): void {
  buckets.clear();
}
