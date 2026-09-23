/**
 * Cheap source version for the Today read model.
 * Counts plus newest timestamps. Not a full history scan, and not a Gmail API call.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

async function exactCount(client: SupabaseClient, table: string): Promise<string> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return String(count ?? 0);
}

async function latestIso(
  client: SupabaseClient,
  table: string,
  column: string,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .select(column)
    .order(column, { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  const row = (data?.[0] ?? null) as unknown as Record<string, unknown> | null;
  const value = row?.[column];
  return value == null ? "" : String(value);
}

export async function readTodaySourceWatermark(
  client: SupabaseClient,
): Promise<string> {
  const [
    candidateCount,
    candidateCreated,
    candidateReviewed,
    gmailCount,
    gmailIndexed,
    jobUpdated,
    projectUpdated,
  ] = await Promise.all([
    exactCount(client, "continuum_candidates"),
    latestIso(client, "continuum_candidates", "created_at"),
    latestIso(client, "continuum_candidates", "reviewed_at"),
    exactCount(client, "continuum_gmail_messages"),
    latestIso(client, "continuum_gmail_messages", "indexed_at"),
    latestIso(client, "continuum_project_jobs", "updated_at"),
    latestIso(client, "continuum_project_profiles", "updated_at"),
  ]);
  return [
    candidateCount,
    candidateCreated,
    candidateReviewed,
    gmailCount,
    gmailIndexed,
    jobUpdated,
    projectUpdated,
  ].join("|");
}
