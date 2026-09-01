/**
 * Bounded batched reads of the active Custom / Repair lifecycle current state.
 * Collects supported Project IDs, then at most one .in() query.
 * Does not create rows. Does not infer Kind. Does not fetch event history.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectKind } from "../project-kind";
import { PROJECT_LIFECYCLE_EVENT_LIMIT } from "../project-lifecycle";
import { isLifecycleKind } from "../project-lifecycle";
import type { ProjectLifecycleEvent, ProjectLifecycleState } from "../types";
import { collectLifecycleProjectIds } from "./view";
import {
  LIFECYCLE_EVENT_COLUMNS,
  LIFECYCLE_STATE_COLUMNS,
  rowToLifecycleEvent,
  rowToLifecycleState,
} from "./rows";

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  fallback: string,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? fallback);
  return data ?? [];
}

export async function loadActiveLifecycleStates(
  client: SupabaseClient,
  profiles: ReadonlyArray<{ projectId: string; projectKind?: ProjectKind | null }>,
): Promise<ProjectLifecycleState[]> {
  const projectIds = collectLifecycleProjectIds(profiles);
  if (projectIds.length === 0) return [];
  const stateRows = await rows<Record<string, unknown>>(
    client
      .from("continuum_project_lifecycle_states")
      .select(LIFECYCLE_STATE_COLUMNS)
      .in("project_id", projectIds),
    "read-project-lifecycle-states-failed",
  );
  return stateRows.flatMap((row) => {
    const mapped = rowToLifecycleState(row);
    return mapped ? [mapped] : [];
  });
}

export async function loadProjectLifecycleForDesk(
  client: SupabaseClient,
  profile: { projectId: string; projectKind?: ProjectKind | null },
): Promise<{
  states: ProjectLifecycleState[];
  events: ProjectLifecycleEvent[];
}> {
  if (!isLifecycleKind(profile.projectKind)) {
    return { states: [], events: [] };
  }
  const stateRows = await rows<Record<string, unknown>>(
    client
      .from("continuum_project_lifecycle_states")
      .select(LIFECYCLE_STATE_COLUMNS)
      .eq("project_id", profile.projectId)
      .eq("project_kind", profile.projectKind),
    "read-project-lifecycle-state-failed",
  );
  const states = stateRows.flatMap((row) => {
    const mapped = rowToLifecycleState(row);
    return mapped ? [mapped] : [];
  });
  if (states.length === 0) {
    return { states: [], events: [] };
  }
  const eventRows = await rows<Record<string, unknown>>(
    client
      .from("continuum_project_lifecycle_events")
      .select(LIFECYCLE_EVENT_COLUMNS)
      .eq("project_id", profile.projectId)
      .eq("project_kind", profile.projectKind)
      .order("changed_at", { ascending: false })
      .limit(PROJECT_LIFECYCLE_EVENT_LIMIT),
    "read-project-lifecycle-events-failed",
  );
  return {
    states,
    events: eventRows.flatMap((row) => {
      const mapped = rowToLifecycleEvent(row);
      return mapped ? [mapped] : [];
    }),
  };
}
