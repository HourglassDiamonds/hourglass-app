import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getExecutiveDashboardAccessDecision,
  isExecutiveDashboardPath,
  isExecutiveDashboardPublicAuthPath,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
} from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

/**
 * Next.js 16 Proxy — early network boundary for /executive-dashboard.
 * Authoritative auth still runs in server layouts/loaders (fail closed).
 * Proxy adds private cache headers and optimistic session redirects only.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isExecutiveDashboardPath(pathname)) {
    return NextResponse.next();
  }

  const decision = getExecutiveDashboardAccessDecision({
    cookieValue: request.cookies.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  });

  if (decision.status === "hidden") {
    // Let the App Router render the shared not-found page (no dashboard HTML).
    return NextResponse.next();
  }

  const isLogin = isExecutiveDashboardPublicAuthPath(pathname);

  if (decision.status === "unauthenticated" && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = EXECUTIVE_DASHBOARD_LOGIN_PATH;
    loginUrl.search = "";
    const redirectResponse = NextResponse.redirect(loginUrl);
    applyExecutiveDashboardHeaders(redirectResponse);
    return redirectResponse;
  }

  if (decision.status === "authenticated" && isLogin) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/executive-dashboard";
    dashUrl.search = "";
    const redirectResponse = NextResponse.redirect(dashUrl);
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
}

export const config = {
  matcher: ["/executive-dashboard", "/executive-dashboard/:path*"],
};
