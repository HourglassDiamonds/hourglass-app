/**
 * Server-only Concierge Client Memory note-writer loader.
 * Checks the founder session before constructing the service-role writer.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/server";
import type { ClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedNoteWriter =
  | { ok: true; writer: ClientMemoryNoteWriter }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedClientMemoryNoteWriter(): Promise<AuthenticatedNoteWriter> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return { ok: true, writer: createSupabaseClientMemoryNoteWriter() };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
