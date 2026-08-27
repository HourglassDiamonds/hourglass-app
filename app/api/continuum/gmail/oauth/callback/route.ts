import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_CONCIERGE_PATH } from "@/lib/executive-dashboard/access";
import { createLiveGmailApi } from "@/lib/continuum/gmail/adapter";
import { createSupabaseGmailConnectionStore } from "@/lib/continuum/gmail/server";
import { handleGmailOAuthCallback } from "@/lib/continuum/gmail/handlers";
import {
  GMAIL_OAUTH_INTENT_COOKIE,
  GMAIL_OAUTH_PKCE_COOKIE,
  liveGmailOAuthTokenExchanger,
} from "@/lib/continuum/gmail/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function clearOauthCookies(response: NextResponse) {
  const expired = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/api/continuum/gmail/oauth",
    maxAge: 0,
  };
  response.cookies.set(GMAIL_OAUTH_PKCE_COOKIE, "", expired);
  response.cookies.set(GMAIL_OAUTH_INTENT_COOKIE, "", expired);
}

export async function GET(request: Request) {
  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) return fail("unauthorized", 401);

  const jar = await cookies();
  const url = new URL(request.url);
  const result = await handleGmailOAuthCallback({
    url,
    pendingCookie: jar.get(GMAIL_OAUTH_PKCE_COOKIE)?.value,
    signingSecret: config.sessionSecret,
    exchanger: liveGmailOAuthTokenExchanger,
    fetchProfile: async (accessToken) => {
      if (!accessToken) throw new Error("token-exchange-failed");
      return createLiveGmailApi(accessToken).getProfile();
    },
    connections: createSupabaseGmailConnectionStore(),
    founderRedirect: EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  });

  if (result.status === "error") {
    const response = fail(result.error, result.httpStatus);
    if (result.clearCookies) clearOauthCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(result.url, url.origin));
  response.headers.set("Cache-Control", "no-store");
  if (result.clearCookies) clearOauthCookies(response);
  return response;
}
