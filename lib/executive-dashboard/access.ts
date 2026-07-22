import {
  getExecutiveDashboardAuthConfig,
  isExecutiveDashboardPublicProduction,
} from "./env";
import { verifyExecutiveDashboardSessionToken } from "./session";

export const EXECUTIVE_DASHBOARD_LOGIN_PATH = "/executive-dashboard/login";
export const EXECUTIVE_DASHBOARD_ROOT_PATH = "/executive-dashboard";

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
