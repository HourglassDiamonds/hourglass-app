/**
 * Founder login landing. Viewport uses the same md / 768px split as
 * operating chrome. Deep links win when they are a safe Continuum path.
 */

import {
  CONCIERGE_HOME_PATH,
  CONCIERGE_HUB_PATH,
} from "@/lib/continuum/client-memory/read/presentation";
import {
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  isExecutiveDashboardConciergePath,
  isExecutiveDashboardPasskeyPairPath,
  isExecutiveDashboardPublicAuthPath,
  isExecutiveDashboardSecurityPath,
} from "@/lib/executive-dashboard/access";

export const CONTINUUM_DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

export const FOUNDER_LOGIN_NEXT_QUERY = "next";

export type FounderLoginViewport = "mobile" | "desktop";

function decodeOnce(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function safeFounderLoginDestination(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const decoded = decodeOnce(trimmed) ?? trimmed;
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//")) return null;
  if (decoded.includes("\\") || decoded.includes("\\0")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) return null;

  const withoutHash = decoded.split("#")[0] ?? "";
  const qIndex = withoutHash.indexOf("?");
  const pathname = normalizePathname(
    qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash,
  );
  const search = qIndex >= 0 ? withoutHash.slice(qIndex) : "";

  if (pathname.split("/").includes("..")) return null;
  if (
    !isExecutiveDashboardConciergePath(pathname) &&
    !isExecutiveDashboardSecurityPath(pathname)
  ) {
    return null;
  }
  if (isExecutiveDashboardPublicAuthPath(pathname)) return null;
  if (isExecutiveDashboardPasskeyPairPath(pathname)) return null;
  if (/javascript:/i.test(search) || search.includes("//")) return null;

  return `${pathname}${search}`;
}

export function founderDefaultLoginDestination(
  viewport: FounderLoginViewport,
): string {
  return viewport === "desktop" ? CONCIERGE_HOME_PATH : CONCIERGE_HUB_PATH;
}

export function resolveFounderLoginDestination(input: {
  next?: string | null;
  viewport?: string | null;
}): string {
  const requested = safeFounderLoginDestination(input.next);
  if (requested) return requested;
  const viewport: FounderLoginViewport =
    input.viewport === "desktop" ? "desktop" : "mobile";
  return founderDefaultLoginDestination(viewport);
}

export function assignFounderLoginDestination(
  url: { pathname: string; search: string; hash: string },
  destination: string,
): void {
  const qIndex = destination.indexOf("?");
  url.pathname = qIndex >= 0 ? destination.slice(0, qIndex) : destination;
  url.search = qIndex >= 0 ? destination.slice(qIndex) : "";
  url.hash = "";
}

export function founderLoginPathWithNext(nextPath: string | null): string {
  if (!nextPath) return EXECUTIVE_DASHBOARD_LOGIN_PATH;
  const safe = safeFounderLoginDestination(nextPath);
  if (!safe) return EXECUTIVE_DASHBOARD_LOGIN_PATH;
  return `${EXECUTIVE_DASHBOARD_LOGIN_PATH}?${FOUNDER_LOGIN_NEXT_QUERY}=${encodeURIComponent(safe)}`;
}
