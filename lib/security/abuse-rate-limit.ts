import { hashAbuseBucketKey } from "./abuse-key";
import {
  failClosedAbuseRateLimitStore,
  getMemoryAbuseRateLimitStore,
  getTestAbuseRateLimitStore,
  type AbuseRateLimitStore,
} from "./abuse-rate-limit-store";
import { createSupabaseAbuseRateLimitStore } from "./abuse-rate-limit-supabase";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export type RateLimitWindow = {
  name: string;
  limit: number;
  windowMs: number;
};

export type AbuseRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const STORE_FAILURE_RETRY_SECONDS = 30;

function isNodeTestRuntime(): boolean {
  return Boolean(process.env.NODE_TEST_CONTEXT);
}

function resolveAbuseRateLimitStore(): AbuseRateLimitStore {
  const override = getTestAbuseRateLimitStore();
  if (override) return override;

  if (isNodeTestRuntime()) {
    return getMemoryAbuseRateLimitStore();
  }

  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      return createSupabaseAbuseRateLimitStore(admin);
    }
  } catch {
    // Fall through to production fail-closed / local memory degrade.
  }

  if (process.env.VERCEL_ENV === "production") {
    return failClosedAbuseRateLimitStore;
  }

  return getMemoryAbuseRateLimitStore();
}

export async function consumeRateLimitWindows(input: {
  namespace: string;
  identity: string;
  windows: RateLimitWindow[];
  now?: number;
  store?: AbuseRateLimitStore;
}): Promise<AbuseRateLimitResult> {
  const now = input.now ?? Date.now();
  const store = input.store ?? resolveAbuseRateLimitStore();
  let deniedRetryAfter: number | null = null;

  for (const window of input.windows) {
    const windowStartEpochMs = Math.floor(now / window.windowMs) * window.windowMs;
    const bucketKey = hashAbuseBucketKey({
      namespace: input.namespace,
      windowName: window.name,
      identity: input.identity,
    });

    let result;
    try {
      result = await store.consume({
        bucketKey,
        windowStartEpochMs,
        windowMs: window.windowMs,
        limit: window.limit,
        nowEpochMs: now,
      });
    } catch {
      console.warn("[abuse-rate-limit] store failure");
      return {
        allowed: false,
        retryAfterSeconds: STORE_FAILURE_RETRY_SECONDS,
      };
    }

    if (!result.allowed && deniedRetryAfter === null) {
      deniedRetryAfter = Math.max(1, result.retryAfterSeconds);
    }
  }

  if (deniedRetryAfter !== null) {
    return { allowed: false, retryAfterSeconds: deniedRetryAfter };
  }

  return { allowed: true };
}
