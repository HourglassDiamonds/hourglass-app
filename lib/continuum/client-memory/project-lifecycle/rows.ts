/**
 * Row mappers for Project Lifecycle current-state and event tables.
 * Does not insert. Does not infer Kind or stage.
 */

import { isLifecycleKind } from "../project-lifecycle";
import type { ProjectLifecycleEvent, ProjectLifecycleState } from "../types";

export const LIFECYCLE_STATE_COLUMNS =
  "project_id, project_kind, stage, entered_at, created_at, updated_at";
export const LIFECYCLE_EVENT_COLUMNS =
  "event_id, project_id, project_kind, prior_stage, new_stage, changed_at, changed_by, source_system, mutation_id";

export function rowToLifecycleState(
  row: Record<string, unknown> | null | undefined,
): ProjectLifecycleState | null {
  if (!row || row.project_id == null) return null;
  if (!isLifecycleKind(row.project_kind)) return null;
  return {
    projectId: String(row.project_id),
    projectKind: row.project_kind,
    stage: row.stage == null ? null : String(row.stage),
    enteredAt: row.entered_at == null ? null : String(row.entered_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function rowToLifecycleEvent(
  row: Record<string, unknown> | null | undefined,
): ProjectLifecycleEvent | null {
  if (!row || row.event_id == null || row.project_id == null) return null;
  if (!isLifecycleKind(row.project_kind)) return null;
  return {
    eventId: String(row.event_id),
    projectId: String(row.project_id),
    projectKind: row.project_kind,
    priorStage: row.prior_stage == null ? null : String(row.prior_stage),
    newStage: row.new_stage == null ? null : String(row.new_stage),
    changedAt: String(row.changed_at),
    changedBy: String(row.changed_by),
    sourceSystem: row.source_system as ProjectLifecycleEvent["sourceSystem"],
    mutationId: String(row.mutation_id),
  };
}
