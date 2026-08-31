/**
 * Supabase Project Desk reader.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role only. SELECT against existing Client Memory tables.
 * Does not query operating/lifecycle, Gmail, CoS, Open Jobs, or artifacts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isEditableProjectSpecField, isProjectHistoryRevisionField } from "../contracts";
import { SOURCE_NOTE_COLUMNS, rowToSourceNote } from "../source-note-row";
import { projectKindFromUnknown } from "../project-kind";
import type {
  EntityRelationship,
  ProjectHistory,
  ProjectHistoryRevision,
  ProjectProfile,
  SourceNote,
} from "../types";
import {
  getProjectDeskFromSnapshot,
  listProjectsFromSnapshot,
} from "./compose";
import { loadActiveOperatingDetails } from "../project-operating/load-details";
import type { ProjectDeskReader } from "./reader";
import type {
  ListProjectsFilter,
  ProjectDeskGetResult,
  ProjectDeskSnapshot,
  ProjectDeskSummary,
} from "./types";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function throwQuery(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  fallback: string,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throwQuery(error, fallback);
  return data ?? [];
}

const PROJECT_PROFILE_COLUMNS =
  "project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at, project_kind";
const PROJECT_HISTORY_COLUMNS =
  "project_id, cad_job_number, order_number, gmail_thread_id, match_judgment, match_judgment_raw, finger_size, metal, center_stone, diamond_supply_notes, source_system, created_at, updated_at, founder_corrected_fields";
const PROJECT_HISTORY_REVISION_COLUMNS =
  "id, project_id, mutation_id, field_name, prior_value, new_value, source_system, changed_at, changed_by";
const RELATIONSHIP_COLUMNS =
  "id, from_entity_id, to_entity_id, kind, status, source_system, created_at, created_by";
const NOTE_COLUMNS = SOURCE_NOTE_COLUMNS;

function rowToProjectProfile(row: Record<string, unknown>): ProjectProfile {
  return {
    projectId: String(row.project_id),
    displayTitle: String(row.display_title),
    visibility: row.visibility as ProjectProfile["visibility"],
    importRowKey: row.import_row_key == null ? null : String(row.import_row_key),
    sourceSystem: row.source_system as ProjectProfile["sourceSystem"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    projectKind: projectKindFromUnknown(row.project_kind),
  };
}

function rowToProjectHistory(row: Record<string, unknown>): ProjectHistory {
  return {
    projectId: String(row.project_id),
    cadJobNumber: row.cad_job_number == null ? null : String(row.cad_job_number),
    orderNumber: row.order_number == null ? null : String(row.order_number),
    gmailThreadId: row.gmail_thread_id == null ? null : String(row.gmail_thread_id),
    matchJudgment: (row.match_judgment ?? null) as ProjectHistory["matchJudgment"],
    matchJudgmentRaw:
      row.match_judgment_raw == null ? null : String(row.match_judgment_raw),
    fingerSize: row.finger_size == null ? null : String(row.finger_size),
    metal: row.metal == null ? null : String(row.metal),
    centerStone: row.center_stone == null ? null : String(row.center_stone),
    diamondSupplyNotes:
      row.diamond_supply_notes == null ? null : String(row.diamond_supply_notes),
    sourceSystem: row.source_system as ProjectHistory["sourceSystem"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    founderCorrectedFields: Array.isArray(row.founder_corrected_fields)
      ? row.founder_corrected_fields.filter(isEditableProjectSpecField)
      : [],
  };
}

function rowToProjectHistoryRevision(
  row: Record<string, unknown>,
): ProjectHistoryRevision | null {
  if (!isProjectHistoryRevisionField(row.field_name)) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    mutationId: String(row.mutation_id),
    fieldName: row.field_name,
    priorValue: row.prior_value == null ? null : String(row.prior_value),
    newValue: row.new_value == null ? null : String(row.new_value),
    sourceSystem: row.source_system as ProjectHistoryRevision["sourceSystem"],
    changedAt: String(row.changed_at),
    changedBy: String(row.changed_by),
  };
}

function rowToRelationship(row: Record<string, unknown>): EntityRelationship {
  return {
    id: String(row.id),
    fromEntityId: String(row.from_entity_id),
    toEntityId: String(row.to_entity_id),
    kind: row.kind as EntityRelationship["kind"],
    status: row.status as EntityRelationship["status"],
    sourceSystem: row.source_system as EntityRelationship["sourceSystem"],
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
  };
}

function rowToNote(row: Record<string, unknown>): SourceNote {
  return rowToSourceNote(row);
}

async function loadSnapshot(client: SupabaseClient): Promise<ProjectDeskSnapshot> {
  const [
    projectProfileRows,
    projectHistoryRows,
    specRevisionRows,
    relationshipRows,
    noteRows,
    personRows,
  ] = await Promise.all([
    rows<Record<string, unknown>>(
      client.from("continuum_project_profiles").select(PROJECT_PROFILE_COLUMNS),
      "read-project-profiles-failed",
    ),
    rows<Record<string, unknown>>(
      client.from("continuum_project_history").select(PROJECT_HISTORY_COLUMNS),
      "read-project-history-failed",
    ),
    rows<Record<string, unknown>>(
      client
        .from("continuum_project_history_revisions")
        .select(PROJECT_HISTORY_REVISION_COLUMNS),
      "read-project-history-revisions-failed",
    ),
    rows<Record<string, unknown>>(
      client
        .from("continuum_relationships")
        .select(RELATIONSHIP_COLUMNS)
        .eq("kind", "client-project")
        .eq("status", "active"),
      "read-project-relationships-failed",
    ),
    rows<Record<string, unknown>>(
      client
        .from("continuum_source_notes")
        .select(NOTE_COLUMNS)
        .not("project_id", "is", null),
      "read-project-notes-failed",
    ),
    rows<Record<string, unknown>>(
      client.from("continuum_person_profiles").select("person_id, display_name"),
      "read-project-people-failed",
    ),
  ]);

  return {
    projectProfiles: projectProfileRows.map(rowToProjectProfile),
    projectHistories: projectHistoryRows.map(rowToProjectHistory),
    specRevisions: specRevisionRows.flatMap((row) => {
      const mapped = rowToProjectHistoryRevision(row);
      return mapped ? [mapped] : [];
    }),
    relationships: relationshipRows.map(rowToRelationship),
    people: personRows.map((row) => ({
      personId: String(row.person_id),
      displayName: String(row.display_name),
    })),
    sourceNotes: noteRows.map(rowToNote),
  };
}

export class SupabaseProjectDeskReader implements ProjectDeskReader {
  constructor(private readonly client: SupabaseClient) {}

  async listProjects(filter?: ListProjectsFilter): Promise<ProjectDeskSummary[]> {
    const snapshot = await loadSnapshot(this.client);
    return listProjectsFromSnapshot(snapshot, filter);
  }

  async getProjectDesk(projectId: string): Promise<ProjectDeskGetResult> {
    const snapshot = await loadSnapshot(this.client);
    const profile = snapshot.projectProfiles.find(
      (row) => row.projectId === projectId.trim(),
    );
    const details = profile
      ? await loadActiveOperatingDetails(this.client, [profile])
      : { customDetails: [], repairDetails: [] };
    return getProjectDeskFromSnapshot(
      {
        ...snapshot,
        customDetails: details.customDetails,
        repairDetails: details.repairDetails,
      },
      projectId,
    );
  }
}

export function createSupabaseProjectDeskReader(
  client?: SupabaseClient | null,
): ProjectDeskReader {
  return new SupabaseProjectDeskReader(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
