"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
} from "@/lib/executive-dashboard/access";
import { getExecutiveDashboardAuthConfig } from "@/lib/executive-dashboard/env";
import { revokeDurableFounderSession } from "@/lib/executive-dashboard/founder-sessions";
import { authenticateExecutiveDashboardPassword } from "@/lib/executive-dashboard/password-login";
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
  const result = await authenticateExecutiveDashboardPassword({
    headers: headerList,
    formData,
  });
  if (!result.ok) return { error: result.error };
  redirect(result.destination);
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
