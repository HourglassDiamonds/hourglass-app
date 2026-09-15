/**
 * Preview-only durable founder-auth abuse limiting.
 *
 * Reuses consumeRateLimitWindows / hashed bucket keys. Production and every
 * non-isolated runtime keep the existing in-memory limiter and must never
 * invoke the SQL store in this pass.
 *
 * The RPC is increment-only (no peek, no clear). Preview therefore consumes
 * on the surrounding check so enforcement survives a fresh in-memory Map.
 * Success cannot refund a slot without a schema change.
 */

import {
  consumeRateLimitWindows,
  type AbuseRateLimitResult,
  type RateLimitWindow,
} from "@/lib/security/abuse-rate-limit";
import {
  createSupabaseAbuseRateLimitStore,
} from "@/lib/security/abuse-rate-limit-supabase";
import {
  failClosedAbuseRateLimitStore,
  getTestAbuseRateLimitStore,
  type AbuseRateLimitStore,
} from "@/lib/security/abuse-rate-limit-store";
import {
  missingProductionClientIpResult,
  resolveAbuseLimiterIdentity,
} from "@/lib/security/client-ip";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF,
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
  parseContinuumEnv,
  previewSupabaseProjectRef,
  productionSupabaseProjectRef,
  resolveContinuumIsolationState,
  supabaseProjectRefFromUrl,
} from "@/lib/continuum/runtime-env";

export const FOUNDER_AUTH_RATE_LIMIT_WINDOW_NAME = "15m" as const;

export const FOUNDER_AUTH_RATE_LIMIT_NAMESPACES = {
  password: "continuum:founder:password",
  passkeyIssue: "continuum:founder:passkey-issue",
  passkeyVerify: "continuum:founder:passkey-verify",
  pairingClaim: "continuum:founder:pairing-claim",
} as const;

export type FounderAuthRateLimitNamespace =
  (typeof FOUNDER_AUTH_RATE_LIMIT_NAMESPACES)[keyof typeof FOUNDER_AUTH_RATE_LIMIT_NAMESPACES];

/**
 * Durable founder-auth limiting is isolated Preview only:
 * CONTINUUM_ENV=preview, isolation preview-isolated, live URL is the
 * canonical Preview ref, and Production ref stays the canonical Production
 * identity so that project cannot ride this path.
 */
export function isDurableFounderAuthRateLimitEnabled(): boolean {
  if (parseContinuumEnv() !== "preview") return false;
  if (resolveContinuumIsolationState() !== "preview-isolated") return false;

  const currentRef = supabaseProjectRefFromUrl();
  const previewRef = previewSupabaseProjectRef();
  const productionRef = productionSupabaseProjectRef();

  if (currentRef !== CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF) return false;
  if (previewRef !== CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF) return false;
  if (productionRef !== CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (currentRef === CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF) return false;
  if (previewRef === productionRef) return false;
  return true;
}

/**
 * Preview founder-auth must not degrade to the process-local memory store.
 * Missing admin or isolation failure fail closed.
 */
function resolveDurableFounderAuthStore(): AbuseRateLimitStore {
  const override = getTestAbuseRateLimitStore();
  if (override) return override;

  // Unit tests must never invoke live Supabase. Inject a store instead.
  if (process.env.NODE_TEST_CONTEXT) {
    return failClosedAbuseRateLimitStore;
  }

  try {
    const admin = getSupabaseAdmin();
    if (admin) return createSupabaseAbuseRateLimitStore(admin);
  } catch {
    return failClosedAbuseRateLimitStore;
  }

  return failClosedAbuseRateLimitStore;
}

export async function consumeFounderAuthRateLimit(input: {
  namespace: FounderAuthRateLimitNamespace;
  ip: string;
  windows: RateLimitWindow[];
  now?: number;
  store?: AbuseRateLimitStore;
}): Promise<AbuseRateLimitResult> {
  if (!input.ip.trim()) {
    return missingProductionClientIpResult();
  }

  const identity = resolveAbuseLimiterIdentity(input.ip);
  if (identity === null) {
    return missingProductionClientIpResult();
  }

  return consumeRateLimitWindows({
    namespace: input.namespace,
    identity,
    windows: input.windows,
    now: input.now,
    store: input.store ?? resolveDurableFounderAuthStore(),
  });
}
