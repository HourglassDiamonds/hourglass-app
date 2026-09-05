/**
 * Supabase Project Artifacts reader.
 * Missing table is unavailable, not an inferred empty book.
 * Does not copy Gmail attachments or query Shape Studio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PROJECT_ARTIFACT_COLUMNS, rowToProjectArtifact } from "./rows";
import type { ProjectArtifact } from "./types";

function isMissingArtifactsRelation(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return (
    /continuum_project_artifacts/i.test(message) &&
    /does not exist|Could not find the table|schema cache/i.test(message)
  );
}

export async function loadProjectArtifacts(
  client: SupabaseClient,
): Promise<ProjectArtifact[] | null> {
  const { data, error } = await client
    .from("continuum_project_artifacts")
    .select(PROJECT_ARTIFACT_COLUMNS);
  if (error) {
    if (isMissingArtifactsRelation(error)) return null;
    throw new Error(error.message ?? "read-project-artifacts-failed");
  }
  return (data ?? []).flatMap((row) => {
    const mapped = rowToProjectArtifact(row as Record<string, unknown>);
    return mapped ? [mapped] : [];
  });
}
