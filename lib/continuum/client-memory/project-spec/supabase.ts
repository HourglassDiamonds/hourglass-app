/**
 * Supabase Client Memory project-spec writer.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Do not import from client components or public routes.
 * Service-role RPC only. Never writes Notes, Facts, Wishes, or kernel Event/Evidence/Observation.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "../../contracts/types";
import { isEditableProjectSpecField } from "../contracts";
import type { ProjectHistory } from "../types";
import { correctProjectSpec } from "./correct";
import type {
  CorrectProjectSpecDeps,
  CorrectProjectSpecInput,
  CorrectProjectSpecResult,
  ProjectSpecCorrectionApplyResult,
} from "./correct";
import { PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM } from "./types";
import type { ClientMemoryProjectSpecWriter } from "./writer";
import type { EditableProjectSpecField } from "./types";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function mutationReason(message: string): Error {
  if (message.includes("project-not-found")) return new Error("project-not-found");
  if (message.includes("entity-kind-mismatch")) {
    return new Error("entity-kind-mismatch");
  }
  if (message.includes("project-history-not-found")) {
    return new Error("project-history-not-found");
  }
  if (message.includes("implausible-finger-size")) {
    return new Error("implausible-finger-size");
  }
  if (message.includes("invalid-field")) return new Error("invalid-field");
  if (message.includes("invalid-value")) return new Error("invalid-value");
  if (message.includes("invalid-input")) return new Error("invalid-input");
  return new Error(message || "correct-project-spec-failed");
}

function founderCorrectedFieldsFrom(
  value: unknown,
): EditableProjectSpecField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isEditableProjectSpecField);
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
    founderCorrectedFields: founderCorrectedFieldsFrom(
      row.founder_corrected_fields,
    ),
  };
}

export class SupabaseClientMemoryProjectSpecWriter
  implements ClientMemoryProjectSpecWriter
{
  constructor(private readonly client: SupabaseClient) {}

  private correctDeps(): CorrectProjectSpecDeps {
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
      getProjectHistory: (projectId) => this.getProjectHistory(projectId),
      applyCorrection: async (input) => {
        const { data, error } = await this.client.rpc(
          "continuum_client_memory_correct_project_spec",
          {
            p_project_id: input.projectId,
            p_mutation_id: input.mutationId,
            p_revision_id: input.revisionId,
            p_field_name: input.fieldName,
            p_new_value: input.newValue,
            p_changed_at: input.changedAt,
            p_changed_by: input.changedBy,
            p_source_system: PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM,
          },
        );
        if (error) throw mutationReason(error.message ?? "");
        const payload =
          data && typeof data === "object"
            ? (data as Record<string, unknown>)
            : null;
        const status: ProjectSpecCorrectionApplyResult["status"] =
          payload && payload.status === "already-present"
            ? "already-present"
            : "updated";
        const history =
          payload && payload.history && typeof payload.history === "object"
            ? rowToProjectHistory(payload.history as Record<string, unknown>)
            : input.next;
        return {
          status,
          history,
          revisionId:
            payload && payload.revision_id != null
              ? String(payload.revision_id)
              : null,
        };
      },
    };
  }

  async getProjectHistory(projectId: string): Promise<ProjectHistory | null> {
    const { data, error } = await this.client
      .from("continuum_project_history")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToProjectHistory(data as Record<string, unknown>);
  }

  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult> {
    return correctProjectSpec(this.correctDeps(), input);
  }
}

export function createSupabaseClientMemoryProjectSpecWriter(
  client?: SupabaseClient | null,
): SupabaseClientMemoryProjectSpecWriter {
  return new SupabaseClientMemoryProjectSpecWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
