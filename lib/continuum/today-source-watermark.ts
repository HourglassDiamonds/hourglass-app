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
  now = new Date(),
): Promise<string> {
  const [
    candidateCount,
    candidateCreated,
    candidateReviewed,
    gmailCount,
    gmailIndexed,
    jobUpdated,
    projectUpdated,
    noteUpdated,
    noteCount,
    expiredDefer,
  ] = await Promise.all([
    exactCount(client, "continuum_candidates"),
    latestIso(client, "continuum_candidates", "created_at"),
    latestIso(client, "continuum_candidates", "reviewed_at"),
    exactCount(client, "continuum_gmail_messages"),
    latestIso(client, "continuum_gmail_messages", "indexed_at"),
    latestIso(client, "continuum_project_jobs", "updated_at"),
    latestIso(client, "continuum_project_profiles", "updated_at"),
    latestIso(client, "continuum_source_notes", "updated_at"),
    exactCount(client, "continuum_source_notes"),
    expiredDeferral(client, now),
  ]);
  return [
    candidateCount,
    candidateCreated,
    candidateReviewed,
    gmailCount,
    gmailIndexed,
    jobUpdated,
    projectUpdated,
    noteUpdated,
    noteCount,
    expiredDefer,
  ].join("|");
}

async function expiredDeferral(client: SupabaseClient, now: Date): Promise<string> {
  const { data, error } = await client.from("continuum_project_jobs").select("deferred_until").lte("deferred_until", now.toISOString()).order("deferred_until", { ascending: false }).limit(1);
  if (error) throw error;
  return String(data?.[0]?.deferred_until ?? "");
}
