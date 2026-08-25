/**
 * Server-only Concierge Client Memory Person-writer loader.
 * Checks the founder session before constructing the service-role writer.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseClientMemoryPersonWriter } from "@/lib/continuum/client-memory/person/server";
import type { ClientMemoryPersonWriter } from "@/lib/continuum/client-memory/person/writer";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedPersonWriter =
  | { ok: true; writer: ClientMemoryPersonWriter }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedClientMemoryPersonWriter(): Promise<AuthenticatedPersonWriter> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return { ok: true, writer: createSupabaseClientMemoryPersonWriter() };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
