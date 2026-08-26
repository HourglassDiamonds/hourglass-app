/**
 * Server-only Project Desk loaders.
 * Checks the founder session before constructing the service-role reader.
 * Slice A has no Project Desk writer.
 */

import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { createSupabaseProjectDeskReader } from "./server";
import type { ProjectDeskReader } from "./reader";
import { PROJECT_DESK_HOME_LIMIT } from "./types";
import type { ProjectDeskSummary } from "./types";

export type AuthenticatedProjectDeskReader =
  | { ok: true; reader: ProjectDeskReader }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedProjectDeskReader(): Promise<AuthenticatedProjectDeskReader> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) {
    return { ok: false, reason: "unauthorized" };
  }
  try {
    return { ok: true, reader: createSupabaseProjectDeskReader() };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function loadProjectBookPreview(
  limit = PROJECT_DESK_HOME_LIMIT,
): Promise<ProjectDeskSummary[]> {
  const auth = await getAuthenticatedProjectDeskReader();
  if (!auth.ok) return [];
  try {
    return await auth.reader.listProjects({ limit });
  } catch {
    return [];
  }
}
