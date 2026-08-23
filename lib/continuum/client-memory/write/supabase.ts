/**
 * Supabase Client Memory note writer.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role INSERT into continuum_source_notes only.
 * Never writes Facts, Wishes, or kernel Event/Evidence/Observation.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "../../contracts/types";
import { isRelationshipContextLayer } from "../contracts";
import type { SourceNote } from "../types";
import { addManualNote } from "./add-manual-note";
import type { ClientMemoryNoteWriter } from "./writer";
import type { AddManualNoteInput, AddManualNoteResult } from "./types";

const UNIQUE_VIOLATION = "23505";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
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

export class SupabaseClientMemoryNoteWriter implements ClientMemoryNoteWriter {
  constructor(private readonly client: SupabaseClient) {}

  addManualNote(input: AddManualNoteInput): Promise<AddManualNoteResult> {
    return addManualNote(
      {
        nowIso: () => new Date().toISOString(),
        newNoteId: () => randomUUID(),
        getEntity: async (id) => {
          const { data, error } = await this.client
            .from("continuum_entities")
            .select("kind")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return { kind: data.kind as EntityKind };
        },
        hasActiveClientProjectLink: async (personId, projectId) => {
          const person = await this.client
            .from("continuum_entities")
            .select("kind")
            .eq("id", personId)
            .maybeSingle();
          if (person.error) throw person.error;
          if (!person.data || person.data.kind !== "person") return false;
          const project = await this.client
            .from("continuum_entities")
            .select("kind")
            .eq("id", projectId)
            .maybeSingle();
          if (project.error) throw project.error;
          if (!project.data || project.data.kind !== "project") return false;
          const forward = await this.client
            .from("continuum_relationships")
            .select("id")
            .eq("kind", "client-project")
            .eq("status", "active")
            .eq("from_entity_id", personId)
            .eq("to_entity_id", projectId)
            .limit(1);
          if (forward.error) throw forward.error;
          if ((forward.data?.length ?? 0) > 0) return true;
          const reverse = await this.client
            .from("continuum_relationships")
            .select("id")
            .eq("kind", "client-project")
            .eq("status", "active")
            .eq("from_entity_id", projectId)
            .eq("to_entity_id", personId)
            .limit(1);
          if (reverse.error) throw reverse.error;
          return (reverse.data?.length ?? 0) > 0;
        },
        insertNote: async (row) => {
          const { error } = await this.client.from("continuum_source_notes").insert({
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
          });
          if (error && isUniqueViolation(error)) return "duplicate-key";
          if (error) throw error;
          return "inserted";
        },
        findNoteByIdentity: async (identity) => {
          const { data, error } = await this.client
            .from("continuum_source_notes")
            .select(
              "id, person_id, project_id, context_layer, source_system, source_artifact, source_sheet, source_field, import_row_key, gmail_thread_id, note_text, created_at",
            )
            .eq("source_system", identity.sourceSystem)
            .eq("import_row_key", identity.importRowKey)
            .eq("source_field", identity.sourceField)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return rowToNote(data);
        },
      },
      input,
    );
  }
}

export function createSupabaseClientMemoryNoteWriter(
  client?: SupabaseClient | null,
): SupabaseClientMemoryNoteWriter {
  return new SupabaseClientMemoryNoteWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
