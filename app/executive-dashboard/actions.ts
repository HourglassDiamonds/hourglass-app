"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR,
  EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  executiveDashboardPostLoginPath,
} from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import {
  checkExecutiveDashboardLoginRateLimit,
  clearExecutiveDashboardLoginFailures,
  delayExecutiveDashboardAuthFailure,
  getExecutiveDashboardAuthClientIp,
  recordExecutiveDashboardLoginFailure,
} from "@/lib/executive-dashboard/rate-limit";
import { issueExecutiveDashboardSession } from "@/lib/executive-dashboard/issue-session";
import {
  usernamesMatch,
  verifyExecutiveDashboardPassword,
} from "@/lib/executive-dashboard/password";
import {
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  EXECUTIVE_DASHBOARD_SESSION_PATH,
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

  await issueExecutiveDashboardSession(config.username, config.sessionSecret);

  redirect(executiveDashboardPostLoginPath());
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
