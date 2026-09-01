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
import { projectKindFromUnknown } from "../project-kind";
import { correctProjectSpec } from "./correct";
import type {
  CorrectProjectSpecDeps,
  CorrectProjectSpecInput,
  CorrectProjectSpecResult,
  ProjectSpecCorrectionApplyResult,
} from "./correct";
import { correctProjectKind } from "./correct-kind";
import type {
  CorrectProjectKindDeps,
  CorrectProjectKindInput,
  CorrectProjectKindResult,
  ProjectKindCorrectionApplyResult,
} from "./correct-kind";
import { correctProjectOperatingDetail } from "../project-operating/correct";
import type {
  CorrectOperatingDetailDeps,
  CorrectOperatingDetailInput,
  CorrectOperatingDetailResult,
  OperatingDetailCorrectionApplyResult,
} from "../project-operating/correct";
import { setProjectLifecycle } from "../project-lifecycle/set";
import type {
  ProjectLifecycleMutationApplyResult,
  SetProjectLifecycleDeps,
  SetProjectLifecycleInput,
  SetProjectLifecycleResult,
} from "../project-lifecycle/set";
import { isLifecycleKind, type LifecycleKind } from "../project-lifecycle";
import {
  LIFECYCLE_STATE_COLUMNS,
  rowToLifecycleState,
} from "../project-lifecycle/rows";
import {
  CUSTOM_DETAIL_COLUMNS,
  REPAIR_DETAIL_COLUMNS,
  rowToCustomDetails,
  rowToRepairDetails,
} from "../project-operating/rows";
import type {
  ProjectCustomDetails,
  ProjectHistory,
  ProjectLifecycleState,
  ProjectProfile,
  ProjectRepairDetails,
} from "../types";
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
  if (message.includes("wrong-project-kind")) return new Error("wrong-project-kind");
  if (message.includes("unsupported-project-kind")) {
    return new Error("unsupported-project-kind");
  }
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

export class SupabaseClientMemoryProjectSpecWriter
  implements ClientMemoryProjectSpecWriter
{
  constructor(private readonly client: SupabaseClient) {}

  private async getEntityKind(
    id: string,
  ): Promise<{ kind: EntityKind } | null> {
    const { data, error } = await this.client
      .from("continuum_entities")
      .select("kind")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { kind: data.kind as EntityKind };
  }

  private correctDeps(): CorrectProjectSpecDeps {
    return {
      nowIso: () => new Date().toISOString(),
      newRevisionId: () => randomUUID(),
      getEntity: (id) => this.getEntityKind(id),
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

  private kindDeps(): CorrectProjectKindDeps {
    return {
      nowIso: () => new Date().toISOString(),
      newRevisionId: () => randomUUID(),
      getEntity: (id) => this.getEntityKind(id),
      getProjectProfile: (projectId) => this.getProjectProfile(projectId),
      getProjectHistory: (projectId) => this.getProjectHistory(projectId),
      applyCorrection: async (input) => {
        const { data, error } = await this.client.rpc(
          "continuum_client_memory_correct_project_kind",
          {
            p_project_id: input.projectId,
            p_mutation_id: input.mutationId,
            p_revision_id: input.revisionId,
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
        const status: ProjectKindCorrectionApplyResult["status"] =
          payload && payload.status === "already-present"
            ? "already-present"
            : "updated";
        const profile =
          payload && payload.profile && typeof payload.profile === "object"
            ? rowToProjectProfile(payload.profile as Record<string, unknown>)
            : input.next;
        return {
          status,
          profile,
          revisionId:
            payload && payload.revision_id != null
              ? String(payload.revision_id)
              : null,
        };
      },
    };
  }

  private operatingDeps(): CorrectOperatingDetailDeps {
    return {
      nowIso: () => new Date().toISOString(),
      newRevisionId: () => randomUUID(),
      getEntity: (id) => this.getEntityKind(id),
      getProjectProfile: (projectId) => this.getProjectProfile(projectId),
      getProjectHistory: (projectId) => this.getProjectHistory(projectId),
      getCustomDetails: (projectId) => this.getProjectCustomDetails(projectId),
      getRepairDetails: (projectId) => this.getProjectRepairDetails(projectId),
      applyCorrection: async (input) => {
        const { data, error } = await this.client.rpc(
          "continuum_client_memory_correct_project_operating_detail",
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
        const status: OperatingDetailCorrectionApplyResult["status"] =
          payload && payload.status === "already-present"
            ? "already-present"
            : "updated";
        return {
          status,
          customDetails:
            payload && payload.custom_details && typeof payload.custom_details === "object"
              ? rowToCustomDetails(payload.custom_details as Record<string, unknown>)
              : input.nextCustom,
          repairDetails:
            payload && payload.repair_details && typeof payload.repair_details === "object"
              ? rowToRepairDetails(payload.repair_details as Record<string, unknown>)
              : input.nextRepair,
          revisionId:
            payload && payload.revision_id != null
              ? String(payload.revision_id)
              : null,
        };
      },
    };
  }

  private lifecycleDeps(): SetProjectLifecycleDeps {
    return {
      nowIso: () => new Date().toISOString(),
      newEventId: () => randomUUID(),
      getEntity: (id) => this.getEntityKind(id),
      getProjectProfile: (projectId) => this.getProjectProfile(projectId),
      getLifecycleState: (projectId, projectKind) =>
        this.getProjectLifecycleState(projectId, projectKind),
      applyMutation: async (input) => {
        const { data, error } = await this.client.rpc(
          "continuum_client_memory_set_project_lifecycle",
          {
            p_project_id: input.projectId,
            p_stage: input.newStage,
            p_mutation_id: input.mutationId,
            p_event_id: input.eventId,
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
        const status: ProjectLifecycleMutationApplyResult["status"] =
          payload && payload.status === "already-present"
            ? "already-present"
            : "updated";
        return {
          status,
          state:
            payload && payload.state && typeof payload.state === "object"
              ? rowToLifecycleState(payload.state as Record<string, unknown>)
              : null,
          eventId:
            payload && payload.event_id != null
              ? String(payload.event_id)
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

  async getProjectProfile(projectId: string): Promise<ProjectProfile | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToProjectProfile(data as Record<string, unknown>);
  }

  async getProjectCustomDetails(
    projectId: string,
  ): Promise<ProjectCustomDetails | null> {
    const { data, error } = await this.client
      .from("continuum_project_custom_details")
      .select(CUSTOM_DETAIL_COLUMNS)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToCustomDetails(data as Record<string, unknown>);
  }

  async getProjectRepairDetails(
    projectId: string,
  ): Promise<ProjectRepairDetails | null> {
    const { data, error } = await this.client
      .from("continuum_project_repair_details")
      .select(REPAIR_DETAIL_COLUMNS)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToRepairDetails(data as Record<string, unknown>);
  }

  async getProjectLifecycleState(
    projectId: string,
    projectKind: LifecycleKind,
  ): Promise<ProjectLifecycleState | null> {
    if (!isLifecycleKind(projectKind)) return null;
    const { data, error } = await this.client
      .from("continuum_project_lifecycle_states")
      .select(LIFECYCLE_STATE_COLUMNS)
      .eq("project_id", projectId)
      .eq("project_kind", projectKind)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToLifecycleState(data as Record<string, unknown>);
  }

  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult> {
    return correctProjectSpec(this.correctDeps(), input);
  }

  correctProjectKind(
    input: CorrectProjectKindInput,
  ): Promise<CorrectProjectKindResult> {
    return correctProjectKind(this.kindDeps(), input);
  }

  correctProjectOperatingDetail(
    input: CorrectOperatingDetailInput,
  ): Promise<CorrectOperatingDetailResult> {
    return correctProjectOperatingDetail(this.operatingDeps(), input);
  }

  setProjectLifecycle(
    input: SetProjectLifecycleInput,
  ): Promise<SetProjectLifecycleResult> {
    return setProjectLifecycle(this.lifecycleDeps(), input);
  }
}

export function createSupabaseClientMemoryProjectSpecWriter(
  client?: SupabaseClient | null,
): SupabaseClientMemoryProjectSpecWriter {
  return new SupabaseClientMemoryProjectSpecWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
