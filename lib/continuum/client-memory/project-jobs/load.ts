/**
 * Supabase Open Jobs reader.
 * Missing table is unavailable, not an inferred empty book.
 * Does not create rows. Does not write Gmail, Human Intake, or CoS.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PROJECT_JOB_COLUMNS, rowToProjectJob } from "./rows";
import type { ProjectJob } from "./types";

function isMissingJobsRelation(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return (
    /continuum_project_jobs/i.test(message) &&
    /does not exist|Could not find the table|schema cache/i.test(message)
  );
}

export async function loadProjectJobs(
  client: SupabaseClient,
): Promise<ProjectJob[] | null> {
  const { data, error } = await client
    .from("continuum_project_jobs")
    .select(PROJECT_JOB_COLUMNS);
  if (error) {
    if (isMissingJobsRelation(error)) return null;
    throw new Error(error.message ?? "read-project-jobs-failed");
  }
  return (data ?? []).flatMap((row) => {
    const mapped = rowToProjectJob(row as Record<string, unknown>);
    return mapped ? [mapped] : [];
  });
}
