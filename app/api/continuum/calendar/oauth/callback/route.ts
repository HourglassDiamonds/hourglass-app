import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { CONCIERGE_CALENDAR_PATH } from "@/lib/continuum/calendar/types";
import { createLiveCalendarApi } from "@/lib/continuum/calendar/adapter";
import { primaryCalendarEmail } from "@/lib/continuum/calendar/context";
import { createSupabaseCalendarConnectionStore } from "@/lib/continuum/calendar/server";
import { handleCalendarOAuthCallback } from "@/lib/continuum/calendar/handlers";
import {
  CALENDAR_OAUTH_INTENT_COOKIE,
  CALENDAR_OAUTH_PKCE_COOKIE,
  liveCalendarOAuthTokenExchanger,
} from "@/lib/continuum/calendar/oauth";

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
    path: "/api/continuum/calendar/oauth",
    maxAge: 0,
  };
  response.cookies.set(CALENDAR_OAUTH_PKCE_COOKIE, "", expired);
  response.cookies.set(CALENDAR_OAUTH_INTENT_COOKIE, "", expired);
}

export async function GET(request: Request) {
  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) return fail("unauthorized", 401);

  const jar = await cookies();
  const url = new URL(request.url);
  const result = await handleCalendarOAuthCallback({
    url,
    pendingCookie: jar.get(CALENDAR_OAUTH_PKCE_COOKIE)?.value,
    signingSecret: config.sessionSecret,
    exchanger: liveCalendarOAuthTokenExchanger,
    fetchPrimaryEmail: async (accessToken) => {
      if (!accessToken) throw new Error("token-exchange-failed");
      const list = await createLiveCalendarApi(accessToken).getCalendarList();
      const email = primaryCalendarEmail(list.calendars);
      if (!email) throw new Error("token-exchange-failed");
      return { emailAddress: email };
    },
    connections: createSupabaseCalendarConnectionStore(),
    founderRedirect: CONCIERGE_CALENDAR_PATH,
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
