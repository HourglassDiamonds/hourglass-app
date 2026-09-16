"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR,
  EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
} from "@/lib/executive-dashboard/access";
import { resolveFounderLoginDestination } from "@/lib/continuum/operating-shell/login-destination";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { revokeDurableFounderSession } from "@/lib/executive-dashboard/founder-sessions";
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
  verifyExecutiveDashboardSessionToken,
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

  const rate = await checkExecutiveDashboardLoginRateLimit(ip);
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
    await recordExecutiveDashboardLoginFailure(ip);
    await delayExecutiveDashboardAuthFailure();
    return { error: EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR };
  }

  await clearExecutiveDashboardLoginFailures(ip);

  const issued = await issueExecutiveDashboardSession(
    config.username,
    config.sessionSecret,
  );
  if (!issued.ok) {
    await delayExecutiveDashboardAuthFailure();
    return { error: EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR };
  }

  redirect(
    resolveFounderLoginDestination({
      next: String(formData.get("next") ?? ""),
      viewport: String(formData.get("viewport") ?? ""),
    }),
  );
}

export async function logoutExecutiveDashboard(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value;
  const config = getExecutiveDashboardAuthConfig();
  const payload =
    config.ok && token
      ? verifyExecutiveDashboardSessionToken(
          token,
          config.sessionSecret,
          config.username,
        )
      : null;
  // Preview revoke is best-effort. Always clear the browser cookie after.
  // If revoke fails, this browser is logged out but a copied cookie may
  // remain valid until expiry. Do not leak store or SQL details.
  await revokeDurableFounderSession(payload?.sid);
  jar.set(EXECUTIVE_DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: shouldUseSecureExecutiveDashboardCookie(),
    sameSite: "lax",
    path: EXECUTIVE_DASHBOARD_SESSION_PATH,
    maxAge: 0,
  });
  redirect(EXECUTIVE_DASHBOARD_LOGIN_PATH);
}
