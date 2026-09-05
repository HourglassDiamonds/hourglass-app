/**
 * Server-only founder Open Jobs writer loader.
 * Checks the founder session before constructing the service-role writer.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseProjectJobWriter } from "./server";
import type { ProjectJobWriter } from "./writer";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedProjectJobWriter =
  | { ok: true; writer: ProjectJobWriter; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedProjectJobWriter(): Promise<AuthenticatedProjectJobWriter> {
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
      writer: createSupabaseProjectJobWriter(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
