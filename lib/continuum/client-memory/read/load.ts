/**
 * Server-only Concierge Client Memory loader.
 * Checks the founder session before constructing the service-role reader.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseClientMemoryReader } from "@/lib/continuum/client-memory/read/server";
import type { ClientMemoryReader } from "@/lib/continuum/client-memory/read/reader";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedReader =
  | { ok: true; reader: ClientMemoryReader }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedClientMemoryReader(): Promise<AuthenticatedReader> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return { ok: true, reader: createSupabaseClientMemoryReader() };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
