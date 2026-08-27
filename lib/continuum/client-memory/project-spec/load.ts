/**
 * Server-only Concierge Client Memory project-spec writer loader.
 * Checks the founder session before constructing the service-role writer.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/server";
import type { ClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/writer";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedProjectSpecWriter =
  | { ok: true; writer: ClientMemoryProjectSpecWriter; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedClientMemoryProjectSpecWriter(): Promise<AuthenticatedProjectSpecWriter> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return {
      ok: true,
      writer: createSupabaseClientMemoryProjectSpecWriter(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
