import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readExecutiveDashboardSession } from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { shouldUseSecureExecutiveDashboardCookie } from "@/lib/executive-dashboard/session";
import { handleGmailOAuthStart } from "@/lib/continuum/gmail/handlers";
import {
  GMAIL_OAUTH_INTENT_COOKIE,
  GMAIL_OAUTH_PKCE_COOKIE,
  gmailOAuthCookieOptions,
} from "@/lib/continuum/gmail/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) return fail("unauthorized", 401);

  const jar = await cookies();
  const session = readExecutiveDashboardSession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  const result = handleGmailOAuthStart({
    founderSessionOk: session.ok,
    intentCookie: jar.get(GMAIL_OAUTH_INTENT_COOKIE)?.value,
    signingSecret: config.sessionSecret,
  });

  if (result.status === "error") {
    return fail(result.error, result.httpStatus);
  }

  const response = NextResponse.redirect(result.url);
  response.headers.set("Cache-Control", "no-store");
  if (result.setPendingCookie) {
    response.cookies.set(
      GMAIL_OAUTH_PKCE_COOKIE,
      result.setPendingCookie,
      gmailOAuthCookieOptions(shouldUseSecureExecutiveDashboardCookie()),
    );
  }
  return response;
}
