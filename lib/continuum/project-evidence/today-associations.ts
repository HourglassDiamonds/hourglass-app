/**
 * Read-only founder-trusted Gmail thread membership for Today.
 * Fails closed on malformed or conflicting ownership and never infers identity.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import { PROJECT_EVIDENCE_TABLE } from "./types";

export type TrustedProjectThreadAssociationRow = {
  project_id?: unknown;
  source_type?: unknown;
  source_identity?: unknown;
  source_thread_id?: unknown;
  status?: unknown;
};

/**
 * Returns exact thread -> Project membership. A thread trusted to more than one
 * Project is excluded entirely, even if database constraints are unavailable.
 */
export function selectTrustedProjectThreadAssociations(
  rows: readonly TrustedProjectThreadAssociationRow[],
  projectIds: ReadonlySet<string>,
): Map<string, string> {
  const projectsByThread = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.status !== "trusted" || row.source_type !== "gmail") continue;
    const projectId = String(row.project_id ?? "").trim();
    if (!projectIds.has(projectId)) continue;
    const rawThreadId = String(row.source_thread_id ?? row.source_identity ?? "").trim();
    const threadId = coerceGmailThreadId(rawThreadId);
    if (threadId.status !== "canonical") continue;
    const projects = projectsByThread.get(threadId.value) ?? new Set<string>();
    projects.add(projectId);
    projectsByThread.set(threadId.value, projects);
  }

  const trusted = new Map<string, string>();
  for (const [threadId, projects] of projectsByThread) {
    if (projects.size === 1) trusted.set(threadId, [...projects][0]!);
  }
  return trusted;
}

export async function loadTrustedProjectThreadAssociations(
  client: SupabaseClient,
  projectIds: ReadonlySet<string>,
): Promise<Map<string, string>> {
  if (projectIds.size === 0) return new Map();
  try {
    const { data, error } = await client
      .from(PROJECT_EVIDENCE_TABLE)
      .select("project_id, source_type, source_identity, source_thread_id, status")
      .eq("source_type", "gmail")
      .eq("status", "trusted");
    if (error) return new Map();
    return selectTrustedProjectThreadAssociations(
      (data ?? []) as TrustedProjectThreadAssociationRow[],
      projectIds,
    );
  } catch {
    // Backward compatible where the additive association table is not installed.
    return new Map();
  }
}
