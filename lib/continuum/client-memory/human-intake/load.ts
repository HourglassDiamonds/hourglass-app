/**
 * Server-only Concierge human-source loader.
 * Checks the founder session before constructing the service-role store.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/server";
import type { HumanSourceStore } from "@/lib/continuum/client-memory/human-intake/store";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedHumanSourceStore =
  | { ok: true; store: HumanSourceStore }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedHumanSourceStore(): Promise<AuthenticatedHumanSourceStore> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return { ok: true, store: createSupabaseHumanSourceStore() };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
