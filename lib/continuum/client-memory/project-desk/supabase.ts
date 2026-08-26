/**
 * Supabase Project Desk reader.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role only. SELECT against existing Client Memory tables.
 * Does not query operating/lifecycle, Gmail, CoS, Open Jobs, or artifacts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isRelationshipContextLayer } from "../contracts";
import type {
  EntityRelationship,
  ProjectHistory,
  ProjectProfile,
  SourceNote,
} from "../types";
import {
  getProjectDeskFromSnapshot,
  listProjectsFromSnapshot,
} from "./compose";
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
  "project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at";
const PROJECT_HISTORY_COLUMNS =
  "project_id, cad_job_number, order_number, gmail_thread_id, match_judgment, match_judgment_raw, finger_size, metal, center_stone, diamond_supply_notes, source_system, created_at, updated_at";
const RELATIONSHIP_COLUMNS =
  "id, from_entity_id, to_entity_id, kind, status, source_system, created_at, created_by";
const NOTE_COLUMNS =
  "id, person_id, project_id, context_layer, source_system, source_artifact, source_sheet, source_field, import_row_key, gmail_thread_id, note_text, created_at";

function rowToProjectProfile(row: Record<string, unknown>): ProjectProfile {
  return {
    projectId: String(row.project_id),
    displayTitle: String(row.display_title),
    visibility: row.visibility as ProjectProfile["visibility"],
    importRowKey: row.import_row_key == null ? null : String(row.import_row_key),
    sourceSystem: row.source_system as ProjectProfile["sourceSystem"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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
  if (!isRelationshipContextLayer(row.context_layer)) {
    throw new Error("invalid-context-layer");
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
  };
}

async function loadSnapshot(client: SupabaseClient): Promise<ProjectDeskSnapshot> {
  const [
    projectProfileRows,
    projectHistoryRows,
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
    return getProjectDeskFromSnapshot(snapshot, projectId);
  }
}

export function createSupabaseProjectDeskReader(
  client?: SupabaseClient | null,
): ProjectDeskReader {
  return new SupabaseProjectDeskReader(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
