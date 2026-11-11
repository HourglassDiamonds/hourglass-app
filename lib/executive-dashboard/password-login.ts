import {
  EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR,
  EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR,
} from "./access";
import { resolveFounderLoginDestination } from "@/lib/continuum/operating-shell/login-destination";
import { getExecutiveDashboardAuthConfig } from "./env";
import {
  checkExecutiveDashboardLoginRateLimit,
  clearExecutiveDashboardLoginFailures,
  delayExecutiveDashboardAuthFailure,
  getExecutiveDashboardAuthClientIp,
  recordExecutiveDashboardLoginFailure,
} from "./rate-limit";
import { issueExecutiveDashboardSession } from "./issue-session";
import {
  usernamesMatch,
  verifyExecutiveDashboardPassword,
} from "./password";

export type ExecutiveDashboardPasswordLoginResult =
  | { ok: true; destination: string }
  | { ok: false; error: string };

export async function authenticateExecutiveDashboardPassword(input: {
  headers: Headers;
  formData: FormData;
}): Promise<ExecutiveDashboardPasswordLoginResult> {
  const ip = getExecutiveDashboardAuthClientIp(input.headers);
  const rate = await checkExecutiveDashboardLoginRateLimit(ip);
  if (!rate.allowed) {
    await delayExecutiveDashboardAuthFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR };
  }

  const config = getExecutiveDashboardAuthConfig();
  if (!config.ok) {
    await delayExecutiveDashboardAuthFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR };
  }

  const username = String(input.formData.get("username") ?? "");
  const password = String(input.formData.get("password") ?? "");
  if (
    !usernamesMatch(username, config.username) ||
    !verifyExecutiveDashboardPassword(password, config.passwordHash)
  ) {
    await recordExecutiveDashboardLoginFailure(ip);
    await delayExecutiveDashboardAuthFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR };
  }

  await clearExecutiveDashboardLoginFailures(ip);
  const issued = await issueExecutiveDashboardSession(
    config.username,
    config.sessionSecret,
  );
  if (!issued.ok) {
    await delayExecutiveDashboardAuthFailure();
    return { ok: false, error: EXECUTIVE_DASHBOARD_AUTH_UNAVAILABLE_ERROR };
  }

  return {
    ok: true,
    destination: resolveFounderLoginDestination({
      next: String(input.formData.get("next") ?? ""),
      viewport: String(input.formData.get("viewport") ?? ""),
    }),
  };
}
