import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { shouldUseSecureExecutiveDashboardCookie } from "@/lib/executive-dashboard/session";
import {
  createCalendarOAuthIntent,
  CALENDAR_OAUTH_INTENT_COOKIE,
  calendarOAuthCookieOptions,
} from "@/lib/continuum/calendar/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Session-gated start. Issues a short-lived OAuth intent cookie then redirects
 * to the Calendar OAuth start handler. Does not touch Gmail OAuth cookies.
 */
export async function GET(request: Request) {
  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const intent = createCalendarOAuthIntent(session.username, config.sessionSecret);
  const redirectTo = new URL("/api/continuum/calendar/oauth/start", request.url);
  const response = NextResponse.redirect(redirectTo);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    CALENDAR_OAUTH_INTENT_COOKIE,
    intent.token,
    calendarOAuthCookieOptions(shouldUseSecureExecutiveDashboardCookie()),
  );
  return response;
}
