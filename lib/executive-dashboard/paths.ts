/**
 * Founder-dashboard path constants and predicates.
 * Safe for Client Components. Must not import session stores, Supabase,
 * or Google auth — those live in access.ts / founder-sessions.ts.
 */

import { isExecutiveDashboardPublicProduction } from "./env";

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
