/**
 * Server-only founder Project Artifacts writer loader.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { createSupabaseProjectArtifactWriter } from "./server";
import type { ProjectArtifactWriter } from "./writer";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export type AuthenticatedProjectArtifactWriter =
  | { ok: true; writer: ProjectArtifactWriter; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedProjectArtifactWriter(): Promise<AuthenticatedProjectArtifactWriter> {
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
      writer: createSupabaseProjectArtifactWriter(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
