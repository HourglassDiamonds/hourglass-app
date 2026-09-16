import {
  getExecutiveDashboardAuthConfig,
  isExecutiveDashboardPublicProduction,
} from "./env";
import { confirmDurableFounderSession } from "./founder-sessions";
import {
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH,
  EXECUTIVE_DASHBOARD_PASSKEYS_PATH,
  EXECUTIVE_DASHBOARD_PATHNAME_HEADER,
  EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH,
  EXECUTIVE_DASHBOARD_ROOT_PATH,
  EXECUTIVE_DASHBOARD_SECURITY_PATH,
  executiveDashboardPostLoginPath,
  isExecutiveDashboardConciergePath,
  isExecutiveDashboardPasskeyPairPath,
  isExecutiveDashboardPath,
  isExecutiveDashboardPublicAuthPath,
  isExecutiveDashboardSecurityPath,
} from "./paths";
import { verifyExecutiveDashboardSessionToken } from "./session";

export {
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH,
  EXECUTIVE_DASHBOARD_PASSKEYS_PATH,
  EXECUTIVE_DASHBOARD_PATHNAME_HEADER,
  EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH,
  EXECUTIVE_DASHBOARD_ROOT_PATH,
  EXECUTIVE_DASHBOARD_SECURITY_PATH,
  executiveDashboardPostLoginPath,
  isExecutiveDashboardConciergePath,
  isExecutiveDashboardPasskeyPairPath,
  isExecutiveDashboardPath,
  isExecutiveDashboardPublicAuthPath,
  isExecutiveDashboardSecurityPath,
};

export const EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR =
  "Invalid credentials. Please try again.";

export const EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR =
  "Sign-in is unavailable. Contact the founder.";

export const EXECUTIVE_DASHBOARD_PASSKEY_AUTH_ERROR =
  "Unable to verify passkey. Try again or use your password.";

export const EXECUTIVE_DASHBOARD_PASSKEY_ENROLL_ERROR =
  "Unable to create passkey. Try again.";

export const EXECUTIVE_DASHBOARD_PASSKEY_PAIR_ERROR =
  "This setup session has expired or was cancelled.";

/**
 * Authoritative session check — fail closed when config is missing or
 * the cookie is absent/invalid/expired/tampered. Isolated Preview also
 * requires a durable, non-revoked session row. Production stays stateless.
 */
export async function readExecutiveDashboardSession(
  cookieValue: string | undefined | null,
  nowMs = Date.now(),
): Promise<{ ok: true; username: string } | { ok: false; reason: string }> {
  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) {
    return { ok: false, reason: "missing-config" };
  }
  if (!cookieValue) {
    return { ok: false, reason: "missing-session" };
  }
  const payload = verifyExecutiveDashboardSessionToken(
    cookieValue,
    config.sessionSecret,
    config.username,
    nowMs,
  );
  if (!payload) {
    return { ok: false, reason: "invalid-session" };
  }
  const durable = await confirmDurableFounderSession(payload.sid, nowMs);
  if (!durable.ok) {
    return { ok: false, reason: "invalid-session" };
  }
  return { ok: true, username: payload.u };
}

/**
 * Option B: Vercel production always denies (caller should notFound()).
 * Non-production requires a valid session before dashboard data loads.
 */
export async function getExecutiveDashboardAccessDecision(options: {
  cookieValue?: string | null;
  nowMs?: number;
}): Promise<
  | { status: "hidden" }
  | { status: "unauthenticated"; reason: string }
  | { status: "authenticated"; username: string }
> {
  if (isExecutiveDashboardPublicProduction()) {
    return { status: "hidden" };
  }
  const session = await readExecutiveDashboardSession(
    options.cookieValue,
    options.nowMs,
  );
  if (!session.ok) {
    return { status: "unauthenticated", reason: session.reason };
  }
  return { status: "authenticated", username: session.username };
}
