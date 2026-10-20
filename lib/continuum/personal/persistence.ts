import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { deletePerformanceSourceWithClient, loadPerformanceStateWithClient, savePerformanceStateWithClient, type SavePerformanceStateInput } from "./persistence-core";

export { PERFORMANCE_SOURCE_BUCKET, PerformanceRevisionConflict, type PerformanceMutation } from "./persistence-core";

function requireClient(client?: SupabaseClient | null): SupabaseClient {
  const resolved = client === undefined ? getSupabaseAdmin() : client;
  if (!resolved) throw new Error("performance-persistence-unavailable");
  return resolved;
}

export function loadPerformanceState(founderKey: string, today: string, client?: SupabaseClient | null) {
  return loadPerformanceStateWithClient(founderKey, today, requireClient(client));
}

export function savePerformanceState(input: SavePerformanceStateInput, client?: SupabaseClient | null) {
  return savePerformanceStateWithClient(input, requireClient(client));
}

export function deletePerformanceSource(input: { founderKey: string; expectedRevision: number; entryId: string; kind: "meal" | "activity" | "recovery"; idempotencyKey: string; now?: string }, client?: SupabaseClient | null) {
  return deletePerformanceSourceWithClient(input, requireClient(client));
}
