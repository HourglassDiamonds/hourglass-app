/**
 * Supabase Client Memory note writer.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role INSERT/RPC into continuum_source_notes only.
 * Never writes Facts, Wishes, or kernel Event/Evidence/Observation.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "../../contracts/types";
import type { SourceNote } from "../types";
import {
  SOURCE_NOTE_COLUMNS,
  rowToSourceNote,
  sourceNoteInsertRow,
} from "../source-note-row";
import { addManualNote } from "./add-manual-note";
import {
  editSourceNote,
  moveSourceNote,
  restoreSourceNote,
  trashSourceNote,
  type EditSourceNoteInput,
  type LifecycleSourceNoteInput,
  type MoveSourceNoteInput,
  type MutateNoteDeps,
  type MutateNoteResult,
  type NoteMutationApplyResult,
} from "./mutate-note";
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

function mutationReason(message: string): Error {
  if (message.includes("note-not-found")) return new Error("note-not-found");
  if (message.includes("person-not-found")) return new Error("person-not-found");
  if (message.includes("project-not-linked")) return new Error("project-not-linked");
  if (message.includes("entity-kind-mismatch")) {
    return new Error("entity-kind-mismatch");
  }
  if (message.includes("cross-person-unconfirmed")) {
    return new Error("cross-person-unconfirmed");
  }
  if (message.includes("not-editable")) return new Error("not-editable");
  if (message.includes("not-trashed")) return new Error("not-trashed");
  if (message.includes("empty-note")) return new Error("empty-note");
  if (message.includes("oversized-note")) return new Error("oversized-note");
  if (message.includes("invalid-context")) return new Error("invalid-context");
  if (message.includes("project-not-allowed")) return new Error("project-not-allowed");
  return new Error(message || "mutate-source-note-failed");
}

export class SupabaseClientMemoryNoteWriter implements ClientMemoryNoteWriter {
  constructor(private readonly client: SupabaseClient) {}

  private mutateDeps(): MutateNoteDeps {
    return {
      nowIso: () => new Date().toISOString(),
      newRevisionId: () => randomUUID(),
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
      getNote: (id) => this.getSourceNote(id),
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
      applyMutation: async (input) => {
        const { data, error } = await this.client.rpc(
          "continuum_client_memory_mutate_source_note",
          {
            p_note_id: input.prior.id,
            p_mutation_id: input.mutationId,
            p_change_kind: input.changeKind,
            p_edited_at: input.editedAt,
            p_edited_by: input.editedBy,
            p_revision_id: input.revisionId,
            p_note_text: input.next.noteText,
            p_person_id: input.next.personId,
            p_project_id: input.next.projectId,
            p_context_layer: input.next.contextLayer,
            p_cross_person_confirmed: true,
          },
        );
        if (error) throw mutationReason(error.message ?? "");
        const payload =
          data && typeof data === "object"
            ? (data as Record<string, unknown>)
            : null;
        const status: NoteMutationApplyResult["status"] =
          payload && payload.status === "already-present"
            ? "already-present"
            : "updated";
        const note =
          payload && payload.note && typeof payload.note === "object"
            ? rowToSourceNote(payload.note as Record<string, unknown>)
            : input.next;
        return {
          status,
          note,
          revisionId:
            payload && payload.revision_id != null
              ? String(payload.revision_id)
              : null,
        };
      },
    };
  }

  addManualNote(input: AddManualNoteInput): Promise<AddManualNoteResult> {
    return addManualNote(
      {
        nowIso: () => new Date().toISOString(),
        newNoteId: () => randomUUID(),
        getEntity: this.mutateDeps().getEntity,
        hasActiveClientProjectLink: this.mutateDeps().hasActiveClientProjectLink,
        insertNote: async (row) => {
          const { error } = await this.client
            .from("continuum_source_notes")
            .insert(sourceNoteInsertRow(row));
          if (error && isUniqueViolation(error)) return "duplicate-key";
          if (error) throw error;
          return "inserted";
        },
        findNoteByIdentity: async (identity) => {
          const { data, error } = await this.client
            .from("continuum_source_notes")
            .select(SOURCE_NOTE_COLUMNS)
            .eq("source_system", identity.sourceSystem)
            .eq("import_row_key", identity.importRowKey)
            .eq("source_field", identity.sourceField)
            .maybeSingle();
          if (error) throw error;
          if (!data) return null;
          return rowToSourceNote(data);
        },
      },
      input,
    );
  }

  async getSourceNote(id: string): Promise<SourceNote | null> {
    const { data, error } = await this.client
      .from("continuum_source_notes")
      .select(SOURCE_NOTE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToSourceNote(data);
  }

  editNote(input: EditSourceNoteInput): Promise<MutateNoteResult> {
    return editSourceNote(this.mutateDeps(), input);
  }

  moveNote(input: MoveSourceNoteInput): Promise<MutateNoteResult> {
    return moveSourceNote(this.mutateDeps(), input);
  }

  trashNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult> {
    return trashSourceNote(this.mutateDeps(), input);
  }

  restoreNote(input: LifecycleSourceNoteInput): Promise<MutateNoteResult> {
    return restoreSourceNote(this.mutateDeps(), input);
  }
}

export function createSupabaseClientMemoryNoteWriter(
  client?: SupabaseClient | null,
): SupabaseClientMemoryNoteWriter {
  return new SupabaseClientMemoryNoteWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
