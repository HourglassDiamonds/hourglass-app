import {
  getExecutiveDashboardAuthConfig,
  isExecutiveDashboardPublicProduction,
} from "./env";
import { verifyExecutiveDashboardSessionToken } from "./session";

export const EXECUTIVE_DASHBOARD_LOGIN_PATH = "/executive-dashboard/login";
export const EXECUTIVE_DASHBOARD_ROOT_PATH = "/executive-dashboard";
export const EXECUTIVE_DASHBOARD_CONCIERGE_PATH =
  "/executive-dashboard/concierge";
export const EXECUTIVE_DASHBOARD_SECURITY_PATH =
  "/executive-dashboard/security";
export const EXECUTIVE_DASHBOARD_PASSKEYS_PATH =
  "/executive-dashboard/security/passkeys";
export const EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH =
  "/executive-dashboard/security/passkeys/pair";
export const EXECUTIVE_DASHBOARD_PATHNAME_HEADER = "x-hg-ed-pathname";

/**
 * Neutral internal rewrite target for Vercel production hard-404.
 * Must not exist as a real App Router page, and must sit outside
 * `/executive-dashboard` so the dashboard route tree never loads.
 */
export const EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH =
  "/__hg_production_not_found__";

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

/** Paths under /executive-dashboard that do not require a session. */
export function isExecutiveDashboardPublicAuthPath(pathname: string): boolean {
  return (
    pathname === EXECUTIVE_DASHBOARD_LOGIN_PATH ||
    pathname.startsWith(`${EXECUTIVE_DASHBOARD_LOGIN_PATH}/`)
  );
}

export function isExecutiveDashboardPath(pathname: string): boolean {
  return (
    pathname === EXECUTIVE_DASHBOARD_ROOT_PATH ||
    pathname.startsWith(`${EXECUTIVE_DASHBOARD_ROOT_PATH}/`)
  );
}

/** Internal Concierge Client Memory UI — session-gated, not the metrics dashboard. */
export function isExecutiveDashboardConciergePath(pathname: string): boolean {
  return (
    pathname === EXECUTIVE_DASHBOARD_CONCIERGE_PATH ||
    pathname.startsWith(`${EXECUTIVE_DASHBOARD_CONCIERGE_PATH}/`)
  );
}

/** Private founder security (passkeys). Session-gated like Concierge; not Client Memory. */
export function isExecutiveDashboardSecurityPath(pathname: string): boolean {
  return (
    pathname === EXECUTIVE_DASHBOARD_SECURITY_PATH ||
    pathname.startsWith(`${EXECUTIVE_DASHBOARD_SECURITY_PATH}/`)
  );
}

/**
 * iPhone QR pairing page. Reachable without a founder session, but only
 * with a one-time token then an HttpOnly pairing cookie. Not Concierge.
 */
export function isExecutiveDashboardPasskeyPairPath(pathname: string): boolean {
  return (
    pathname === EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH ||
    pathname.startsWith(`${EXECUTIVE_DASHBOARD_PASSKEY_PAIR_PATH}/`)
  );
}

export function executiveDashboardPostLoginPath(): string {
  return isExecutiveDashboardPublicProduction()
    ? EXECUTIVE_DASHBOARD_CONCIERGE_PATH
    : EXECUTIVE_DASHBOARD_ROOT_PATH;
}

/**
 * Authoritative session check — fail closed when config is missing or
 * the cookie is absent/invalid/expired/tampered.
 */
export function readExecutiveDashboardSession(
  cookieValue: string | undefined | null,
  nowMs = Date.now(),
): { ok: true; username: string } | { ok: false; reason: string } {
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
  return { ok: true, username: payload.u };
}

/**
 * Option B: Vercel production always denies (caller should notFound()).
 * Non-production requires a valid session before dashboard data loads.
 */
export function getExecutiveDashboardAccessDecision(options: {
  cookieValue?: string | null;
  nowMs?: number;
}):
  | { status: "hidden" }
  | { status: "unauthenticated"; reason: string }
  | { status: "authenticated"; username: string } {
  if (isExecutiveDashboardPublicProduction()) {
    return { status: "hidden" };
  }
  const session = readExecutiveDashboardSession(
    options.cookieValue,
    options.nowMs,
  );
  if (!session.ok) {
    return { status: "unauthenticated", reason: session.reason };
  }
  return { status: "authenticated", username: session.username };
}
