/**
 * Shared source-note row mapping. Safe for read and write adapters.
 * Does not log note text.
 */

import {
  isRelationshipContextLayer,
  isSourceNoteLifecycleStatus,
} from "./contracts";
import {
  classifySourceNoteLifecycle,
  type SourceNote,
  type SourceNoteLifecycleStatus,
} from "./types";

export const SOURCE_NOTE_COLUMNS =
  "id, person_id, project_id, context_layer, source_system, source_artifact, source_sheet, source_field, import_row_key, gmail_thread_id, note_text, created_at, lifecycle_status, updated_at, updated_by, deleted_at, previous_lifecycle";

export function sourceNoteInsertRow(row: SourceNote): Record<string, unknown> {
  return {
    id: row.id,
    person_id: row.personId,
    project_id: row.projectId,
    context_layer: row.contextLayer,
    source_system: row.sourceSystem,
    source_artifact: row.sourceArtifact,
    source_sheet: row.sourceSheet,
    source_field: row.sourceField,
    import_row_key: row.importRowKey,
    gmail_thread_id: row.gmailThreadId,
    note_text: row.noteText,
    created_at: row.createdAt,
    lifecycle_status: row.lifecycleStatus,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt,
    previous_lifecycle: row.previousLifecycle,
  };
}

export function newSourceNoteLifecycle(input: {
  sourceSystem: string;
  createdAt: string;
  updatedBy?: string | null;
  lifecycleStatus?: SourceNoteLifecycleStatus;
}): Pick<
  SourceNote,
  "lifecycleStatus" | "updatedAt" | "updatedBy" | "deletedAt" | "previousLifecycle"
> {
  return {
    lifecycleStatus:
      input.lifecycleStatus ?? classifySourceNoteLifecycle(input.sourceSystem),
    updatedAt: input.createdAt,
    updatedBy: input.updatedBy ?? null,
    deletedAt: null,
    previousLifecycle: null,
  };
}

export function rowToSourceNote(row: Record<string, unknown>): SourceNote {
  if (!isRelationshipContextLayer(row.context_layer)) {
    throw new Error("invalid-context-layer");
  }
  if (!isSourceNoteLifecycleStatus(row.lifecycle_status)) {
    throw new Error("invalid-lifecycle-status");
  }
  const previous = row.previous_lifecycle;
  if (previous != null && !isSourceNoteLifecycleStatus(previous)) {
    throw new Error("invalid-lifecycle-status");
  }
  return {
    id: String(row.id),
    personId: row.person_id == null ? null : String(row.person_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    contextLayer: row.context_layer,
    sourceSystem: row.source_system as SourceNote["sourceSystem"],
    sourceArtifact: String(row.source_artifact),
    sourceSheet: String(row.source_sheet),
    sourceField: String(row.source_field),
    importRowKey: String(row.import_row_key),
    gmailThreadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
    noteText: String(row.note_text),
    createdAt: String(row.created_at),
    lifecycleStatus: row.lifecycle_status,
    updatedAt: String(row.updated_at ?? row.created_at),
    updatedBy: row.updated_by == null ? null : String(row.updated_by),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    previousLifecycle: previous == null ? null : previous,
  };
}
