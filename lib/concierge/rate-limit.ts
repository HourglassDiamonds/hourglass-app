/**
 * Concierge form rate limits — per client IP.
 * In-memory best-effort on serverless (resets on cold starts).
 */

export const CONCIERGE_RATE_LIMIT_BURST_MAX = 3;
export const CONCIERGE_RATE_LIMIT_BURST_WINDOW_MS = 60_000;
export const CONCIERGE_RATE_LIMIT_HOURLY = 8;
export const CONCIERGE_RATE_LIMIT_DAILY = 20;

export const CONCIERGE_RATE_LIMIT_ERROR =
  "We couldn’t send your note just now. Please try again in a little while, or contact us directly.";

type RateLimitBucket = {
  timestamps: number[];
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 5_000;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** Bypass only outside production — never honor disable flag in production. */
function isRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.CONCIERGE_RATE_LIMIT_DISABLED === "1";
}

export function getConciergeClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 80);
  return "";
}

export type ConciergeRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function pruneTimestamps(timestamps: number[], now: number): number[] {
  const cutoff = now - ONE_DAY_MS;
  return timestamps.filter((t) => t >= cutoff);
}

function pruneBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    bucket.timestamps = pruneTimestamps(bucket.timestamps, now);
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
  // Hard cap — drop oldest-looking empty-prone keys if still over limit.
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

/**
 * When the client IP cannot be determined, fail open rather than forcing all
 * anonymous traffic through one shared strict bucket.
 */
export function checkConciergeRateLimit(
  ip: string,
  now = Date.now(),
): ConciergeRateLimitResult {
  if (isRateLimitDisabled()) {
    return { allowed: true };
  }

  const key = ip.trim();
  if (!key) {
    return { allowed: true };
  }

  pruneBuckets(now);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = pruneTimestamps(bucket.timestamps, now);

  const hourAgo = now - ONE_HOUR_MS;
  const burstAgo = now - CONCIERGE_RATE_LIMIT_BURST_WINDOW_MS;
  const inLastHour = bucket.timestamps.filter((t) => t >= hourAgo).length;
  const inLastDay = bucket.timestamps.length;
  const inBurst = bucket.timestamps.filter((t) => t >= burstAgo).length;

  if (inBurst >= CONCIERGE_RATE_LIMIT_BURST_MAX) {
    const oldestBurst = bucket.timestamps.find((t) => t >= burstAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (oldestBurst + CONCIERGE_RATE_LIMIT_BURST_WINDOW_MS - now) / 1000,
        ),
      ),
    };
  }

  if (inLastHour >= CONCIERGE_RATE_LIMIT_HOURLY) {
    const oldestHour = bucket.timestamps.find((t) => t >= hourAgo) ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldestHour + ONE_HOUR_MS - now) / 1000),
      ),
    };
  }

  if (inLastDay >= CONCIERGE_RATE_LIMIT_DAILY) {
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

/** In-memory submission-id dedupe — best-effort across warm instances. */
const recentSubmissionIds = new Map<string, number>();
const inFlightSubmissionIds = new Set<string>();
const SUBMISSION_ID_TTL_MS = 15 * 60 * 1000;
const MAX_SUBMISSION_IDS = 2_000;

function pruneSubmissionIds(now: number): void {
  for (const [key, seenAt] of recentSubmissionIds) {
    if (now - seenAt > SUBMISSION_ID_TTL_MS) {
      recentSubmissionIds.delete(key);
    }
  }
  if (recentSubmissionIds.size > MAX_SUBMISSION_IDS) {
    const overflow = recentSubmissionIds.size - MAX_SUBMISSION_IDS;
    let removed = 0;
    for (const key of recentSubmissionIds.keys()) {
      recentSubmissionIds.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

/**
 * Begin processing a submission id.
 * - `duplicate` if already completed or currently in flight
 * - `fresh` if this instance should proceed with HubSpot writes
 */
export function beginConciergeSubmission(
  submissionId: string,
  now = Date.now(),
): "fresh" | "duplicate" {
  const id = submissionId.trim().slice(0, 80);
  if (!id) return "fresh";

  pruneSubmissionIds(now);

  if (recentSubmissionIds.has(id) || inFlightSubmissionIds.has(id)) {
    return "duplicate";
  }

  inFlightSubmissionIds.add(id);
  return "fresh";
}

export function completeConciergeSubmission(
  submissionId: string,
  now = Date.now(),
): void {
  const id = submissionId.trim().slice(0, 80);
  if (!id) return;
  inFlightSubmissionIds.delete(id);
  recentSubmissionIds.set(id, now);
}

export function releaseConciergeSubmission(submissionId: string): void {
  const id = submissionId.trim().slice(0, 80);
  if (!id) return;
  inFlightSubmissionIds.delete(id);
}

/** Test helper — clears in-memory state. */
export function resetConciergeRateLimits(): void {
  buckets.clear();
  recentSubmissionIds.clear();
  inFlightSubmissionIds.clear();
}
