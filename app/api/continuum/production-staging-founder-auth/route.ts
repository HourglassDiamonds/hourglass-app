import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  PRODUCTION_STAGING_LOGIN_PATH,
} from "@/lib/continuum/production-staging-access";
import { isVerifiedContinuumProductionStagingRuntime } from "@/lib/continuum/runtime-env";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { revokeDurableFounderSession } from "@/lib/executive-dashboard/founder-sessions";
import { authenticateExecutiveDashboardPassword } from "@/lib/executive-dashboard/password-login";
import {
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  EXECUTIVE_DASHBOARD_SESSION_PATH,
  shouldUseSecureExecutiveDashboardCookie,
  verifyExecutiveDashboardSessionToken,
} from "@/lib/executive-dashboard/session";

function stagingRedirect(request: NextRequest, pathname: string): NextResponse {
  return NextResponse.redirect(new URL(pathname, request.url), 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isVerifiedContinuumProductionStagingRuntime()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  if (String(formData.get("intent") ?? "login") === "logout") {
    const jar = await cookies();
    const token = jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value;
    const config = getExecutiveDashboardAuthConfig();
    const payload = config.ok && token
      ? verifyExecutiveDashboardSessionToken(
          token,
          config.sessionSecret,
          config.username,
        )
      : null;
    await revokeDurableFounderSession(payload?.sid);
    jar.set(EXECUTIVE_DASHBOARD_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: shouldUseSecureExecutiveDashboardCookie(),
      sameSite: "lax",
      path: EXECUTIVE_DASHBOARD_SESSION_PATH,
      maxAge: 0,
    });
    return stagingRedirect(request, PRODUCTION_STAGING_LOGIN_PATH);
  }

  const result = await authenticateExecutiveDashboardPassword({
    headers: new Headers(request.headers),
    formData,
  });
  if (!result.ok) {
    return stagingRedirect(
      request,
      `${PRODUCTION_STAGING_LOGIN_PATH}?error=invalid`,
    );
  }
  return stagingRedirect(request, "/executive-dashboard");
}
