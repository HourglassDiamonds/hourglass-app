/**
 * App Router helper to issue the existing executive-dashboard session cookie.
 * Password login and passkey login must share this path.
 */

import { cookies } from "next/headers";
import { buildExecutiveDashboardSessionCookie } from "./session";

export async function issueExecutiveDashboardSession(
  username: string,
  sessionSecret: string,
  nowMs = Date.now(),
): Promise<void> {
  const cookie = buildExecutiveDashboardSessionCookie(
    username,
    sessionSecret,
    nowMs,
  );
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
}
