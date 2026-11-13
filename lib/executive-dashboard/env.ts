/**
 * Server-only executive dashboard auth env.
 * Never expose via NEXT_PUBLIC_*.
 */

import { isVerifiedContinuumProductionShadowRuntime } from "@/lib/continuum/runtime-env";

export const PRODUCTION_SHADOW_FOUNDER_USERNAME_ENV =
  "CONTINUUM_PRODUCTION_SHADOW_FOUNDER_USERNAME" as const;
export const PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH_ENV =
  "CONTINUUM_PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH" as const;

function trimmed(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export function getExecutiveDashboardUsername(): string | undefined {
  return trimmed(process.env.EXECUTIVE_DASHBOARD_USERNAME);
}

export function getExecutiveDashboardPasswordHash(): string | undefined {
  return trimmed(process.env.EXECUTIVE_DASHBOARD_PASSWORD_HASH);
}

export function getExecutiveDashboardSessionSecret(): string | undefined {
  return trimmed(process.env.EXECUTIVE_DASHBOARD_SESSION_SECRET);
}

/** Must never use a NEXT_PUBLIC_ prefix. */
export const SERVER_ONLY_EXECUTIVE_DASHBOARD_ENV = [
  "EXECUTIVE_DASHBOARD_USERNAME",
  "EXECUTIVE_DASHBOARD_PASSWORD_HASH",
  "EXECUTIVE_DASHBOARD_SESSION_SECRET",
  PRODUCTION_SHADOW_FOUNDER_USERNAME_ENV,
  PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH_ENV,
] as const;

function activeFounderCredentialScope(): {
  username: string | undefined;
  passwordHash: string | undefined;
  usernameKey: string;
  passwordHashKey: string;
} {
  if (isVerifiedContinuumProductionShadowRuntime()) {
    return {
      username: trimmed(process.env[PRODUCTION_SHADOW_FOUNDER_USERNAME_ENV]),
      passwordHash: trimmed(
        process.env[PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH_ENV],
      ),
      usernameKey: PRODUCTION_SHADOW_FOUNDER_USERNAME_ENV,
      passwordHashKey: PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH_ENV,
    };
  }
  return {
    username: getExecutiveDashboardUsername(),
    passwordHash: getExecutiveDashboardPasswordHash(),
    usernameKey: "EXECUTIVE_DASHBOARD_USERNAME",
    passwordHashKey: "EXECUTIVE_DASHBOARD_PASSWORD_HASH",
  };
}

/**
 * Public Vercel production — dashboard stays hidden (404), even if auth
 * credentials are configured. Preview/local may authenticate.
 */
export function isExecutiveDashboardPublicProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * Auth config is complete only when username, password hash, and a strong
 * session secret are all present.
 */
export function getExecutiveDashboardAuthConfig():
  | {
      ok: true;
      username: string;
      passwordHash: string;
      sessionSecret: string;
    }
  | { ok: false; missing: string[] } {
  const {
    username,
    passwordHash,
    usernameKey,
    passwordHashKey,
  } = activeFounderCredentialScope();
  const sessionSecret = getExecutiveDashboardSessionSecret();
  const missing: string[] = [];
  if (!username) missing.push(usernameKey);
  if (!passwordHash) missing.push(passwordHashKey);
  if (!sessionSecret || sessionSecret.length < 32) {
    missing.push("EXECUTIVE_DASHBOARD_SESSION_SECRET");
  }
  if (missing.length > 0 || !username || !passwordHash || !sessionSecret) {
    return { ok: false, missing };
  }
  return { ok: true, username, passwordHash, sessionSecret };
}

/**
 * Local/test-only rate-limit bypass. Never honored when NODE_ENV=production
 * or on Vercel production.
 */
export function isExecutiveDashboardAuthRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED === "1";
}
