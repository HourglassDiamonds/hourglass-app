import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AbuseRateLimitStore,
  AbuseRateLimitConsumeResult,
} from "./abuse-rate-limit-store";

type RpcRow = {
  allowed: boolean;
  retry_after_seconds: number | string;
  hit_count: number | string;
};

function asPositiveInt(value: number | string, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

export function createSupabaseAbuseRateLimitStore(
  admin: SupabaseClient,
): AbuseRateLimitStore {
  return {
    async consume(input): Promise<AbuseRateLimitConsumeResult> {
      const { data, error } = await admin.rpc("consume_abuse_rate_limit", {
        p_bucket_key: input.bucketKey,
        p_window_start_epoch_ms: input.windowStartEpochMs,
        p_window_ms: input.windowMs,
        p_limit: input.limit,
        p_now_epoch_ms: input.nowEpochMs,
      });

      if (error) {
        throw new Error("rate-limit-rpc-failed");
      }

      const row = Array.isArray(data) ? (data[0] as RpcRow | undefined) : (data as RpcRow | null);
      if (!row) {
        throw new Error("rate-limit-rpc-empty");
      }

      const allowed = row.allowed === true;
      return {
        allowed,
        retryAfterSeconds: Math.max(1, asPositiveInt(row.retry_after_seconds, 30)),
        hitCount: asPositiveInt(row.hit_count, 0),
      };
    },
  };
}
