import type { AbuseRateLimitStore } from "@/lib/security/abuse-rate-limit-store";
import {
  consumeFounderAuthRateLimit,
  FOUNDER_AUTH_RATE_LIMIT_NAMESPACES,
  FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
  isDurableFounderAuthRateLimitEnabled,
} from "../durable-auth-limit";
import { isExecutiveDashboardAuthRateLimitDisabled } from "../env";

/**
 * Passkey challenge/verify limiter — separate maps from password failures
 * so password brute force does not block Face ID/passkey.
 * Isolated Continuum Preview uses the durable hashed limiter instead.
 */
export const PASSKEY_CHALLENGE_ISSUE_MAX = 20;
export const PASSKEY_VERIFY_FAILURE_MAX = 10;
export const PASSKEY_PAIRING_CLAIM_MAX = 20;
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

async function consumePreviewPasskeyLimit(
  namespace:
    | typeof FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyIssue
    | typeof FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyVerify
    | typeof FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.pairingClaim,
  ip: string,
  limit: number,
  now: number,
  store?: AbuseRateLimitStore,
): Promise<boolean> {
  const result = await consumeFounderAuthRateLimit({
    namespace,
    ip,
    windows: [
      {
        name: FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME,
        limit,
        windowMs: PASSKEY_RATE_LIMIT_WINDOW_MS,
      },
    ],
    now,
    store,
  });
  return result.allowed;
}

export async function checkPasskeyChallengeIssueRateLimit(
  ip: string,
  now = Date.now(),
  store?: AbuseRateLimitStore,
): Promise<boolean> {
  if (isExecutiveDashboardAuthRateLimitDisabled()) return true;
  if (isDurableFounderAuthRateLimitEnabled()) {
    return consumePreviewPasskeyLimit(
      FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyIssue,
      ip,
      PASSKEY_CHALLENGE_ISSUE_MAX,
      now,
      store,
    );
  }
  return take(
    issueBuckets,
    ip,
    PASSKEY_CHALLENGE_ISSUE_MAX,
    now,
    true,
  );
}

export async function checkPasskeyVerifyRateLimit(
  ip: string,
  now = Date.now(),
  store?: AbuseRateLimitStore,
): Promise<boolean> {
  if (isExecutiveDashboardAuthRateLimitDisabled()) return true;
  if (isDurableFounderAuthRateLimitEnabled()) {
    return consumePreviewPasskeyLimit(
      FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.passkeyVerify,
      ip,
      PASSKEY_VERIFY_FAILURE_MAX,
      now,
      store,
    );
  }
  return take(verifyBuckets, ip, PASSKEY_VERIFY_FAILURE_MAX, now, false);
}

export async function recordPasskeyVerifyFailure(
  ip: string,
  now = Date.now(),
): Promise<void> {
  if (isExecutiveDashboardAuthRateLimitDisabled()) return;
  if (isDurableFounderAuthRateLimitEnabled()) return;
  take(verifyBuckets, ip, PASSKEY_VERIFY_FAILURE_MAX, now, true);
}

export async function clearPasskeyVerifyFailures(ip: string): Promise<void> {
  if (isDurableFounderAuthRateLimitEnabled()) return;
  verifyBuckets.delete(ip || "unknown");
}

/**
 * Preview-only durable limiter for public pairing claim. Production and
 * non-isolated runtimes stay unlimited — this path previously had no limiter.
 */
export async function checkPasskeyPairingClaimRateLimit(
  ip: string,
  now = Date.now(),
  store?: AbuseRateLimitStore,
): Promise<boolean> {
  if (isExecutiveDashboardAuthRateLimitDisabled()) return true;
  if (!isDurableFounderAuthRateLimitEnabled()) return true;
  return consumePreviewPasskeyLimit(
    FOUNDER_AUTH_RATE_LIMIT_NAMESPACES.pairingClaim,
    ip,
    PASSKEY_PAIRING_CLAIM_MAX,
    now,
    store,
  );
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
