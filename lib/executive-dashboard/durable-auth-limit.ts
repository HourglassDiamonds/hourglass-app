/**
 * Preview-only durable founder-auth abuse limiting.
 *
 * Reuses consumeRateLimitWindows / checkRateLimitWindows / clearRateLimitWindows
 * and hashed bucket keys. Production and every non-isolated runtime keep the
 * existing in-memory limiter and must never invoke the SQL store in this pass.
 *
 * Password and passkey verify are failure-only: peek on check, consume on
 * failure, clear on success. Challenge issue and pairing claim remain
 * consume-per-request.
 */

import {
  checkRateLimitWindows,
  clearRateLimitWindows,
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

function resolveFounderAuthIdentity(ip: string): string | null {
  if (!ip.trim()) return null;
  return resolveAbuseLimiterIdentity(ip);
}

type FounderAuthLimitInput = {
  namespace: FounderAuthRateLimitNamespace;
  ip: string;
  windows: RateLimitWindow[];
  now?: number;
  store?: AbuseRateLimitStore;
};

export async function consumeFounderAuthRateLimit(
  input: FounderAuthLimitInput,
): Promise<AbuseRateLimitResult> {
  const identity = resolveFounderAuthIdentity(input.ip);
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

export async function checkFounderAuthRateLimit(
  input: FounderAuthLimitInput,
): Promise<AbuseRateLimitResult> {
  const identity = resolveFounderAuthIdentity(input.ip);
  if (identity === null) {
    return missingProductionClientIpResult();
  }

  return checkRateLimitWindows({
    namespace: input.namespace,
    identity,
    windows: input.windows,
    now: input.now,
    store: input.store ?? resolveDurableFounderAuthStore(),
  });
}

export async function clearFounderAuthRateLimit(
  input: FounderAuthLimitInput,
): Promise<void> {
  const identity = resolveFounderAuthIdentity(input.ip);
  if (identity === null) return;

  await clearRateLimitWindows({
    namespace: input.namespace,
    identity,
    windows: input.windows,
    store: input.store ?? resolveDurableFounderAuthStore(),
  });
}
