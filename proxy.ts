import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getExecutiveDashboardAccessDecision,
  isExecutiveDashboardConciergePath,
  isExecutiveDashboardPasskeyPairPath,
  isExecutiveDashboardPath,
  isExecutiveDashboardPublicAuthPath,
  isExecutiveDashboardSecurityPath,
  readExecutiveDashboardSession,
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  EXECUTIVE_DASHBOARD_PATHNAME_HEADER,
  EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH,
} from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

/**
 * Next.js 16 Proxy — early network boundary for /executive-dashboard.
 * Authoritative auth still runs in server layouts/loaders (fail closed).
 * Proxy adds private cache headers and optimistic session redirects only.
 *
 * On Vercel production (`hidden`), the metrics dashboard is rewritten to a
 * neutral 404 before the App Router loads. Login, Concierge, and founder
 * security/passkeys stay session-gated so Continuum can run on a phone.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isExecutiveDashboardPath(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value;
  const isLogin = isExecutiveDashboardPublicAuthPath(pathname);
  const isConcierge = isExecutiveDashboardConciergePath(pathname);
  const isSecurity = isExecutiveDashboardSecurityPath(pathname);
  const isPair = isExecutiveDashboardPasskeyPairPath(pathname);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(EXECUTIVE_DASHBOARD_PATHNAME_HEADER, pathname);

  if (isPair) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyExecutiveDashboardHeaders(response);
    return response;
  }

  if (isLogin || isConcierge || isSecurity) {
    const session = readExecutiveDashboardSession(cookieValue);
    if (!session.ok && !isLogin) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = EXECUTIVE_DASHBOARD_LOGIN_PATH;
      loginUrl.search = "";
      const redirectResponse = NextResponse.redirect(loginUrl);
      applyExecutiveDashboardHeaders(redirectResponse);
      return redirectResponse;
    }
    if (session.ok && isLogin) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = EXECUTIVE_DASHBOARD_CONCIERGE_PATH;
      nextUrl.search = "";
      const redirectResponse = NextResponse.redirect(nextUrl);
      applyExecutiveDashboardHeaders(redirectResponse);
      return redirectResponse;
    }
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyExecutiveDashboardHeaders(response);
    return response;
  }

  const decision = getExecutiveDashboardAccessDecision({ cookieValue });

  if (decision.status === "hidden") {
    // Fail closed at the proxy boundary: do not enter the metrics dashboard.
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH;
    notFoundUrl.search = "";
    return NextResponse.rewrite(notFoundUrl);
  }

  if (decision.status === "unauthenticated") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = EXECUTIVE_DASHBOARD_LOGIN_PATH;
    loginUrl.search = "";
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyExecutiveDashboardHeaders(redirectResponse);
    return redirectResponse;
  }

  const response = NextResponse.next();
  applyExecutiveDashboardHeaders(response);
  return response;
}

function applyExecutiveDashboardHeaders(response: NextResponse): void {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
}

export const config = {
  matcher: ["/executive-dashboard", "/executive-dashboard/:path*"],
};
