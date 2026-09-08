/**
 * Server-only founder Project writer loader.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseFounderProjectWriter } from "./server";
import type { FounderProjectWriter } from "./writer";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedFounderProjectWriter =
  | { ok: true; writer: FounderProjectWriter; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedFounderProjectWriter(): Promise<AuthenticatedFounderProjectWriter> {
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
      writer: createSupabaseFounderProjectWriter(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
