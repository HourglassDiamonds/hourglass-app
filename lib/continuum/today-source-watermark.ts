/**
 * Cheap source version for the Today read model.
 * Counts plus newest timestamps. Not a full history scan, and not a Gmail API call.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attentionBoundaryJobFromRow,
  attentionBoundaryState,
} from "./client-memory/project-jobs/attention-boundary";

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
    elapsedAttentionBoundary,
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
    elapsedAttentionBoundaryToken(client, now),
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
    elapsedAttentionBoundary,
  ].join("|");
}

async function elapsedAttentionBoundaryToken(client: SupabaseClient, now: Date): Promise<string> {
  const { data, error } = await client.from("continuum_project_jobs")
    .select("job_id, state, attention_mode, activation_at, checkpoint_at, deferred_until");
  if (error) return legacyExpiredDeferral(client, now);
  const jobs = (data ?? []).flatMap((row) => {
    const job = attentionBoundaryJobFromRow(row as Record<string, unknown>);
    return job ? [job] : [];
  });
  if (jobs.length === 0 && (data ?? []).length > 0) return legacyExpiredDeferral(client, now);
  return attentionBoundaryState(jobs, now).elapsedToken;
}

async function legacyExpiredDeferral(client: SupabaseClient, now: Date): Promise<string> {
  const { data, error } = await client.from("continuum_project_jobs").select("deferred_until")
    .lte("deferred_until", now.toISOString()).order("deferred_until", { ascending: false }).limit(1);
  if (error) throw error;
  return String(data?.[0]?.deferred_until ?? "");
}
