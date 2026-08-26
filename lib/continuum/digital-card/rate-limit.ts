/**
 * IP rate limits for public digital-card reads and identity-exchange posts.
 * Best-effort in-memory on serverless, same pattern as Concierge.
 */

export const DIGITAL_CARD_SHARE_BURST_MAX = 3;
export const DIGITAL_CARD_SHARE_BURST_WINDOW_MS = 60_000;
export const DIGITAL_CARD_SHARE_HOURLY = 8;
export const DIGITAL_CARD_SHARE_DAILY = 20;

export const DIGITAL_CARD_READ_BURST_MAX = 30;
export const DIGITAL_CARD_READ_BURST_WINDOW_MS = 60_000;

type Bucket = { timestamps: number[] };

const shareBuckets = new Map<string, Bucket>();
const readBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function isRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.DIGITAL_CARD_RATE_LIMIT_DISABLED === "1";
}

export function getDigitalCardClientIp(
  headersList: Headers | { get(name: string): string | null },
): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 80);
  return "";
}

export type DigitalCardRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function prune(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => t >= now - ONE_DAY_MS);
}

function cap(map: Map<string, Bucket>): void {
  if (map.size <= MAX_BUCKETS) return;
  const overflow = map.size - MAX_BUCKETS;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function checkLimit(
  map: Map<string, Bucket>,
  ip: string,
  now: number,
  burstMax: number,
  burstWindowMs: number,
  hourlyMax?: number,
  dailyMax?: number,
): DigitalCardRateLimitResult {
  if (isRateLimitDisabled()) return { allowed: true };
  const key = ip.trim();
  if (!key) return { allowed: true };

  cap(map);
  const bucket = map.get(key) ?? { timestamps: [] };
  bucket.timestamps = prune(bucket.timestamps, now);

  const burstAgo = now - burstWindowMs;
  const inBurst = bucket.timestamps.filter((t) => t >= burstAgo).length;
  if (inBurst >= burstMax) {
    const oldest = bucket.timestamps.find((t) => t >= burstAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + burstWindowMs - now) / 1000)),
    };
  }

  if (hourlyMax != null) {
    const hourAgo = now - ONE_HOUR_MS;
    const inHour = bucket.timestamps.filter((t) => t >= hourAgo).length;
    if (inHour >= hourlyMax) {
      const oldest = bucket.timestamps.find((t) => t >= hourAgo) ?? now;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + ONE_HOUR_MS - now) / 1000)),
      };
    }
  }

  if (dailyMax != null && bucket.timestamps.length >= dailyMax) {
    const oldest = bucket.timestamps[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + ONE_DAY_MS - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  map.set(key, bucket);
  return { allowed: true };
}

export function checkDigitalCardShareRateLimit(
  ip: string,
  now = Date.now(),
): DigitalCardRateLimitResult {
  return checkLimit(
    shareBuckets,
    ip,
    now,
    DIGITAL_CARD_SHARE_BURST_MAX,
    DIGITAL_CARD_SHARE_BURST_WINDOW_MS,
    DIGITAL_CARD_SHARE_HOURLY,
    DIGITAL_CARD_SHARE_DAILY,
  );
}

export function checkDigitalCardReadRateLimit(
  ip: string,
  now = Date.now(),
): DigitalCardRateLimitResult {
  return checkLimit(
    readBuckets,
    ip,
    now,
    DIGITAL_CARD_READ_BURST_MAX,
    DIGITAL_CARD_READ_BURST_WINDOW_MS,
  );
}

export function resetDigitalCardRateLimits(): void {
  shareBuckets.clear();
  readBuckets.clear();
}
