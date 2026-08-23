/**
 * Authorization gate for Client Memory Concierge reads.
 *
 * V1 audience: Justin / internal only. No tenancy, no client portal.
 * Reuse the existing founder executive-dashboard session. Do not invent
 * a second auth stack. Do not add anon/authenticated database grants.
 *
 * Future UI must live under `/executive-dashboard` so the existing
 * session cookie (`path=/executive-dashboard`) is sent. Do not expose
 * this reader through public App Router pages or public API routes.
 */

import { readExecutiveDashboardSession } from "@/lib/executive-dashboard/access";

export const CLIENT_MEMORY_CONCIERGE_AUTH_GATE = {
  mechanism: "executive-dashboard-session",
  audience: "justin-internal",
  cookiePath: "/executive-dashboard",
  productionUi: "not-exposed",
} as const;

export function requireInternalClientMemorySession(
  cookieValue: string | undefined | null,
  nowMs = Date.now(),
): { ok: true; username: string } | { ok: false; reason: string } {
  const session = readExecutiveDashboardSession(cookieValue, nowMs);
  if (!session.ok) return { ok: false, reason: session.reason };
  return { ok: true, username: session.username };
}
