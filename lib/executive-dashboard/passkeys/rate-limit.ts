import { isExecutiveDashboardAuthRateLimitDisabled } from "../env";

/**
 * Passkey challenge/verify limiter — separate maps from password failures
 * so password brute force does not block Face ID/passkey.
 */
export const PASSKEY_CHALLENGE_ISSUE_MAX = 20;
export const PASSKEY_VERIFY_FAILURE_MAX = 10;
export const PASSKEY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PASSKEY_FAILURE_DELAY_MS = 300;

type Bucket = { events: number[] };

const issueBuckets = new Map<string, Bucket>();
const verifyBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 2_000;

function prune(events: number[], now: number): number[] {
  const cutoff = now - PASSKEY_RATE_LIMIT_WINDOW_MS;
  return events.filter((t) => t >= cutoff);
}

function take(
  buckets: Map<string, Bucket>,
  ip: string,
  max: number,
  now: number,
  record: boolean,
): boolean {
  if (isExecutiveDashboardAuthRateLimitDisabled()) return true;
  const key = ip || "unknown";
  const bucket = buckets.get(key) ?? { events: [] };
  bucket.events = prune(bucket.events, now);
  if (bucket.events.length >= max) {
    buckets.set(key, bucket);
    return false;
  }
  if (record) bucket.events.push(now);
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }
  buckets.set(key, bucket);
  return true;
}

export function checkPasskeyChallengeIssueRateLimit(
  ip: string,
  now = Date.now(),
): boolean {
  return take(
    issueBuckets,
    ip,
    PASSKEY_CHALLENGE_ISSUE_MAX,
    now,
    true,
  );
}

export function checkPasskeyVerifyRateLimit(
  ip: string,
  now = Date.now(),
): boolean {
  return take(verifyBuckets, ip, PASSKEY_VERIFY_FAILURE_MAX, now, false);
}

export function recordPasskeyVerifyFailure(
  ip: string,
  now = Date.now(),
): void {
  take(verifyBuckets, ip, PASSKEY_VERIFY_FAILURE_MAX, now, true);
}

export function clearPasskeyVerifyFailures(ip: string): void {
  verifyBuckets.delete(ip || "unknown");
}

export function resetPasskeyRateLimits(): void {
  issueBuckets.clear();
  verifyBuckets.clear();
}

export async function delayPasskeyFailure(
  ms = PASSKEY_FAILURE_DELAY_MS,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
