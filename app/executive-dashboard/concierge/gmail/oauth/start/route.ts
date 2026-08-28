import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { shouldUseSecureExecutiveDashboardCookie } from "@/lib/executive-dashboard/session";
import {
  createGmailOAuthIntent,
  GMAIL_OAUTH_INTENT_COOKIE,
  gmailOAuthCookieOptions,
} from "@/lib/continuum/gmail/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Session-gated start. Issues a short-lived OAuth intent cookie (path covers
 * the API callback/start routes) then redirects to the Gmail OAuth start handler.
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

  const intent = createGmailOAuthIntent(session.username, config.sessionSecret);
  const redirectTo = new URL("/api/continuum/gmail/oauth/start", request.url);
  const response = NextResponse.redirect(redirectTo);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    GMAIL_OAUTH_INTENT_COOKIE,
    intent.token,
    gmailOAuthCookieOptions(shouldUseSecureExecutiveDashboardCookie()),
  );
  return response;
}
