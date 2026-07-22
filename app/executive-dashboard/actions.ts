"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR,
  EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  EXECUTIVE_DASHBOARD_ROOT_PATH,
} from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import {
  checkExecutiveDashboardLoginRateLimit,
  clearExecutiveDashboardLoginFailures,
  delayExecutiveDashboardAuthFailure,
  getExecutiveDashboardAuthClientIp,
  recordExecutiveDashboardLoginFailure,
} from "@/lib/executive-dashboard/rate-limit";
import {
  usernamesMatch,
  verifyExecutiveDashboardPassword,
} from "@/lib/executive-dashboard/password";
import {
  createExecutiveDashboardSessionToken,
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  EXECUTIVE_DASHBOARD_SESSION_PATH,
  executiveDashboardSessionCookieOptions,
  shouldUseSecureExecutiveDashboardCookie,
} from "@/lib/executive-dashboard/session";

export type ExecutiveDashboardLoginState = {
  error?: string;
};

export async function loginExecutiveDashboard(
  _prev: ExecutiveDashboardLoginState,
  formData: FormData,
): Promise<ExecutiveDashboardLoginState> {
  const headerList = await headers();
  const ip = getExecutiveDashboardAuthClientIp(headerList);

  const rate = checkExecutiveDashboardLoginRateLimit(ip);
  if (!rate.allowed) {
    await delayExecutiveDashboardAuthFailure();
    return { error: EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR };
  }

  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) {
    await delayExecutiveDashboardAuthFailure();
    return { error: EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const userOk = usernamesMatch(username, config.username);
  const passOk = verifyExecutiveDashboardPassword(password, config.passwordHash);

  if (!userOk || !passOk) {
    recordExecutiveDashboardLoginFailure(ip);
    await delayExecutiveDashboardAuthFailure();
    return { error: EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR };
  }

  clearExecutiveDashboardLoginFailures(ip);

  const token = createExecutiveDashboardSessionToken(
    config.username,
    config.sessionSecret,
  );
  const jar = await cookies();
  jar.set(
    EXECUTIVE_DASHBOARD_SESSION_COOKIE,
    token,
    executiveDashboardSessionCookieOptions(
      shouldUseSecureExecutiveDashboardCookie(),
    ),
  );

  redirect(EXECUTIVE_DASHBOARD_ROOT_PATH);
}

export async function logoutExecutiveDashboard(): Promise<void> {
  const jar = await cookies();
  jar.set(EXECUTIVE_DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: shouldUseSecureExecutiveDashboardCookie(),
    sameSite: "lax",
    path: EXECUTIVE_DASHBOARD_SESSION_PATH,
    maxAge: 0,
  });
  redirect(EXECUTIVE_DASHBOARD_LOGIN_PATH);
}
