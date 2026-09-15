import { getRequestClientIp } from "@/lib/security/client-ip";
import { isExecutiveDashboardAuthRateLimitDisabled } from "./env";

/**
 * Bounded login abuse defense — best-effort in-memory on serverless.
 * Minor first-layer only; not a substitute for Vercel WAF / Deployment Protection.
 */
export const EXEC_AUTH_RATE_LIMIT_MAX = 5;
export const EXEC_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const EXEC_AUTH_FAILURE_DELAY_MS = 300;

type Bucket = { failures: number[]; };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 2_000;

function prune(failures: number[], now: number): number[] {
  const cutoff = now - EXEC_AUTH_RATE_LIMIT_WINDOW_MS;
  return failures.filter((t) => t >= cutoff);
}

const AUTH_CLIENT_IP_HEADER_NAMES = [
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-real-ip",
] as const;

/**
 * Founder-auth rate-limit identity. Delegates to the shared hardened
 * `getRequestClientIp` parser — do not reimplement forwarding-header trust.
 */
export function getExecutiveDashboardAuthClientIp(
  headersList: Headers | { get(name: string): string | null },
): string {
  return getRequestClientIp(requestFromAuthHeaders(headersList));
}

function requestFromAuthHeaders(
  headersList: Headers | { get(name: string): string | null },
): Request {
  const headers = new Headers();
  for (const name of AUTH_CLIENT_IP_HEADER_NAMES) {
    const value = headersList.get(name);
    if (value) headers.set(name, value);
  }
  return new Request("https://hourglass.local/executive-dashboard/auth", {
    headers,
  });
}

export type ExecAuthRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkExecutiveDashboardLoginRateLimit(
  ip: string,
  now = Date.now(),
): ExecAuthRateLimitResult {
  if (isExecutiveDashboardAuthRateLimitDisabled()) {
    return { allowed: true };
  }

  const key = ip || "unknown";
  const bucket = buckets.get(key) ?? { failures: [] };
  bucket.failures = prune(bucket.failures, now);

  if (bucket.failures.length >= EXEC_AUTH_RATE_LIMIT_MAX) {
    const oldest = bucket.failures[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + EXEC_AUTH_RATE_LIMIT_WINDOW_MS - now) / 1000),
      ),
    };
  }

  buckets.set(key, bucket);
  return { allowed: true };
}

export function recordExecutiveDashboardLoginFailure(
  ip: string,
  now = Date.now(),
): void {
  if (isExecutiveDashboardAuthRateLimitDisabled()) return;

  const key = ip || "unknown";
  const bucket = buckets.get(key) ?? { failures: [] };
  bucket.failures = prune(bucket.failures, now);
  bucket.failures.push(now);

  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  buckets.set(key, bucket);
}

export function clearExecutiveDashboardLoginFailures(ip: string): void {
  buckets.delete(ip || "unknown");
}

export function resetExecutiveDashboardLoginRateLimits(): void {
  buckets.clear();
}

export async function delayExecutiveDashboardAuthFailure(
  ms = EXEC_AUTH_FAILURE_DELAY_MS,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
