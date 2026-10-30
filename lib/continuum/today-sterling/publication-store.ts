import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSterlingTodayProposal } from "./schema";
import type { SterlingTodayProposal } from "./types";

export const STERLING_TODAY_PUBLICATIONS_TABLE = "continuum_sterling_today_publications" as const;

/** Durable publication read. It never invokes a model or mutates canonical data. */
export async function loadFreshSterlingTodayPublication(
  client: SupabaseClient,
  now = new Date(),
): Promise<SterlingTodayProposal | null> {
  const nowIso = now.toISOString();
  const result = await client.from(STERLING_TODAY_PUBLICATIONS_TABLE)
    .select("run_id, proposal, validation_summary, published_at, expires_at")
    .eq("status", "active")
    .lte("published_at", nowIso)
    .gt("expires_at", nowIso)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) return null;
  const validation = result.data.validation_summary as Record<string, unknown> | null;
  if (validation?.verdict !== "PASS" || validation.accepted !== true ||
    validation.mutationsReviewable !== true) return null;
  const proposal = parseSterlingTodayProposal(result.data.proposal);
  if (!proposal || proposal.runId !== String(result.data.run_id)) return null;
  return proposal;
}
