/**
 * App Router helper to issue the existing executive-dashboard session cookie.
 * Password login and passkey login must share this path.
 *
 * Isolated Preview persists a random session_id before setting the cookie.
 * Production remains stateless and never calls the durable store.
 */

import { cookies } from "next/headers";
import {
  founderSessionSubjectId,
  persistDurableFounderSession,
} from "./founder-sessions";
import {
  buildExecutiveDashboardSessionCookie,
  createFounderSessionId,
  EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC,
} from "./session";

export async function issueExecutiveDashboardSession(
  username: string,
  sessionSecret: string,
  nowMs = Date.now(),
): Promise<{ ok: true } | { ok: false }> {
  const sessionId = createFounderSessionId();
  const persisted = await persistDurableFounderSession({
    sessionId,
    founderUserId: founderSessionSubjectId(),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + EXECUTIVE_DASHBOARD_SESSION_MAX_AGE_SEC * 1000,
    revokedAtMs: null,
  });
  if (!persisted.ok) return { ok: false };

  const cookie = buildExecutiveDashboardSessionCookie(
    username,
    sessionSecret,
    nowMs,
    sessionId,
  );
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
  return { ok: true };
}
