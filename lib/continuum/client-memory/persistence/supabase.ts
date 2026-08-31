/**
 * Server-only Supabase Client Memory persistence.
 * Do not import from client components or the public client-memory index.
 * Service-role only. Not invoked by dry-run.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { validateIdentityKind } from "../../contracts/validation";
import type {
  ContinuumSourceSystem,
  EntityKind,
  ExternalIdentity,
  IdentityKind,
} from "../../contracts/types";
import { assertFactValue, assertPersonRoles, isEditableProjectSpecField } from "../contracts";
import { projectKindFromUnknown } from "../project-kind";
import { SOURCE_NOTE_COLUMNS, rowToSourceNote, sourceNoteInsertRow } from "../source-note-row";
import type { SetCurrentPersonFactResult } from "../facts/write";
import { planProfileMerge } from "../merge";
import {
  importedHistoryEqualsCurrent,
  mergeImportedProjectHistory,
} from "../project-spec/import-guard";
import { PROJECT_SPEC_CORRECTION_SOURCE_SYSTEM } from "../project-spec/types";
import type {
  ProjectSpecCorrectionApplyInput,
  ProjectSpecCorrectionApplyResult,
} from "../project-spec/correct";
import type {
  ProjectKindCorrectionApplyInput,
  ProjectKindCorrectionApplyResult,
} from "../project-spec/correct-kind";
import type {
  ApplyExistingPersonInput,
  ApplyExistingPersonResult,
  ClientMemoryCounts,
  ClientMemoryStore,
  CreatePersonAtomicInput,
  CreatePersonAtomicResult,
  UpdatePersonContactInput,
  UpdatePersonContactResult,
} from "../store";
import type {
  ClientMemoryEntity,
  EditableProjectSpecField,
  EntityRelationship,
  IdentityReview,
  IdentityWriteResult,
  InsertResult,
  PersonFact,
  PersonProfile,
  ProjectHistory,
  ProjectProfile,
  SourceNote,
  Wish,
} from "../types";
import type { NoteMutationApplyInput, NoteMutationApplyResult } from "../write/mutate-note";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function throwQuery(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

function founderCorrectedFieldsFrom(value: unknown): EditableProjectSpecField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isEditableProjectSpecField);
}

function rowToProjectHistory(data: Record<string, unknown>): ProjectHistory {
  return {
    projectId: String(data.project_id),
    cadJobNumber: data.cad_job_number == null ? null : String(data.cad_job_number),
    orderNumber: data.order_number == null ? null : String(data.order_number),
    gmailThreadId: data.gmail_thread_id == null ? null : String(data.gmail_thread_id),
    matchJudgment: (data.match_judgment ?? null) as ProjectHistory["matchJudgment"],
    matchJudgmentRaw:
      data.match_judgment_raw == null ? null : String(data.match_judgment_raw),
    fingerSize: data.finger_size == null ? null : String(data.finger_size),
    metal: data.metal == null ? null : String(data.metal),
    centerStone: data.center_stone == null ? null : String(data.center_stone),
    diamondSupplyNotes:
      data.diamond_supply_notes == null ? null : String(data.diamond_supply_notes),
    sourceSystem: data.source_system as ProjectHistory["sourceSystem"],
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
    founderCorrectedFields: founderCorrectedFieldsFrom(
      data.founder_corrected_fields,
    ),
  };
}

export class SupabaseClientMemoryStore implements ClientMemoryStore {
  constructor(private readonly client: SupabaseClient) {}

  async insertEntity(input: {
    id?: string;
    kind: EntityKind;
    createdAt: string;
    createdBy: string;
  }): Promise<InsertResult<ClientMemoryEntity>> {
    const id = input.id ?? randomUUID();
    const { data, error } = await this.client
      .from("continuum_entities")
      .insert({
        id,
        kind: input.kind,
        created_at: input.createdAt,
        created_by: input.createdBy,
      })
      .select("id, kind, created_at, created_by")
      .single();
    if (error && isUniqueViolation(error)) {
      const existing = await this.getEntity(id);
      if (existing) return { status: "already-present", record: existing };
    }
    if (error) throwQuery(error, "insert-entity-failed");
    return {
      status: "inserted",
      record: {
        id: String(data.id),
        kind: data.kind as EntityKind,
        createdAt: String(data.created_at),
        createdBy: String(data.created_by),
      },
    };
  }

  async getEntity(id: string): Promise<ClientMemoryEntity | null> {
    const { data, error } = await this.client
      .from("continuum_entities")
      .select("id, kind, created_at, created_by")
      .eq("id", id)
      .maybeSingle();
    if (error) throwQuery(error, "get-entity-failed");
    if (!data) return null;
    return {
      id: String(data.id),
      kind: data.kind as EntityKind,
      createdAt: String(data.created_at),
      createdBy: String(data.created_by),
    };
  }

  async insertExternalIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>> {
    return this.writeIdentity(identity);
  }

  async upsertExternalIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>> {
    return this.writeIdentity(identity);
  }

  async getExternalIdentity(id: string): Promise<ExternalIdentity | null> {
    const { data, error } = await this.client
      .from("continuum_external_identities")
      .select(
        "id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throwQuery(error, "get-identity-failed");
    return data ? rowToIdentity(data) : null;
  }

  async findActiveIdentities(input: {
    identityKind: IdentityKind;
    identifier: string;
  }): Promise<ExternalIdentity[]> {
    const { data, error } = await this.client
      .from("continuum_external_identities")
      .select(
        "id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at",
      )
      .eq("identity_kind", input.identityKind)
      .eq("identifier", input.identifier)
      .is("revoked_at", null);
    if (error) throwQuery(error, "find-identities-failed");
    return (data ?? []).map(rowToIdentity);
  }

  async insertPersonProfile(
    profile: PersonProfile,
  ): Promise<InsertResult<PersonProfile>> {
    await this.assertEntityKind(profile.personId, "person");
    assertPersonRoles(profile.roles);
    const { error } = await this.client.from("continuum_person_profiles").insert(
      profileToRow(profile),
    );
    if (error && isUniqueViolation(error)) {
      const existing = await this.getPersonProfile(profile.personId);
      if (existing) return { status: "already-present", record: existing };
    }
    if (error) throwQuery(error, "insert-profile-failed");
    return { status: "inserted", record: profile };
  }

  async getPersonProfile(personId: string): Promise<PersonProfile | null> {
    const { data, error } = await this.client
      .from("continuum_person_profiles")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle();
    if (error) throwQuery(error, "get-profile-failed");
    return data ? rowToProfile(data) : null;
  }

  async updatePersonProfile(
    personId: string,
    patch: Partial<
      Omit<PersonProfile, "personId" | "createdAt" | "sourceSystem">
    > & { updatedAt: string },
  ): Promise<PersonProfile | null> {
    const row: Record<string, unknown> = { updated_at: patch.updatedAt };
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.givenName !== undefined) row.given_name = patch.givenName;
    if (patch.familyName !== undefined) row.family_name = patch.familyName;
    if (patch.organizationName !== undefined) {
      row.organization_name = patch.organizationName;
    }
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.streetAddress !== undefined) row.street_address = patch.streetAddress;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.state !== undefined) row.state = patch.state;
    if (patch.country !== undefined) row.country = patch.country;
    if (patch.postalCode !== undefined) row.postal_code = patch.postalCode;
    if (patch.roles !== undefined) {
      assertPersonRoles(patch.roles);
      row.roles = patch.roles;
    }
    const { error } = await this.client
      .from("continuum_person_profiles")
      .update(row)
      .eq("person_id", personId);
    if (error) throwQuery(error, "update-profile-failed");
    return this.getPersonProfile(personId);
  }

  async insertPersonFact(fact: PersonFact): Promise<InsertResult<PersonFact>> {
    await this.assertEntityKind(fact.personId, "person");
    assertFactValue(fact.value);
    const { error } = await this.client.from("continuum_person_facts").insert({
      id: fact.id,
      person_id: fact.personId,
      fact_type: fact.factType,
      value: fact.value,
      confidence: fact.confidence,
      verification: fact.verification,
      approval_status: fact.approvalStatus,
      status: fact.status,
      visibility: fact.visibility,
      usage_permission: fact.usagePermission,
      valid_from: fact.validFrom,
      valid_until: fact.validUntil,
      supersedes_id: fact.supersedesId,
      source_system: fact.sourceSystem,
      created_at: fact.createdAt,
      created_by: fact.createdBy,
    });
    if (error && isUniqueViolation(error)) {
      throw new Error("current-fact-conflict");
    }
    if (error) throwQuery(error, "insert-fact-failed");
    return { status: "inserted", record: fact };
  }

  async getPersonFact(id: string): Promise<PersonFact | null> {
    const { data, error } = await this.client
      .from("continuum_person_facts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwQuery(error, "get-fact-failed");
    if (!data) return null;
    return {
      id: String(data.id),
      personId: String(data.person_id),
      factType: String(data.fact_type),
      value: data.value,
      confidence: Number(data.confidence),
      verification: data.verification == null ? null : String(data.verification),
      approvalStatus: data.approval_status,
      status: data.status,
      visibility: data.visibility,
      usagePermission: data.usage_permission,
      validFrom: data.valid_from == null ? null : String(data.valid_from),
      validUntil: data.valid_until == null ? null : String(data.valid_until),
      supersedesId: data.supersedes_id == null ? null : String(data.supersedes_id),
      sourceSystem: data.source_system,
      createdAt: String(data.created_at),
      createdBy: String(data.created_by),
    };
  }

  async setCurrentPersonFact(
    fact: PersonFact,
  ): Promise<SetCurrentPersonFactResult> {
    assertFactValue(fact.value);
    const { data, error } = await this.client.rpc(
      "continuum_client_memory_set_current_person_fact",
      {
        p_fact_id: fact.id,
        p_person_id: fact.personId,
        p_fact_type: fact.factType,
        p_value: fact.value,
        p_confidence: fact.confidence,
        p_verification: fact.verification,
        p_approval_status: fact.approvalStatus,
        p_visibility: fact.visibility,
        p_usage_permission: fact.usagePermission,
        p_valid_from: fact.validFrom,
        p_valid_until: fact.validUntil,
        p_source_system: fact.sourceSystem,
        p_created_at: fact.createdAt,
        p_created_by: fact.createdBy,
      },
    );
    if (error) {
      const message = error.message ?? "";
      if (message.includes("person-not-found")) throw new Error("person-not-found");
      if (message.includes("fact-id-conflict")) throw new Error("fact-id-conflict");
      throwQuery(error, "set-current-fact-failed");
    }
    return rpcToSetCurrentResult(data, fact);
  }

  async insertRelationship(
    row: EntityRelationship,
  ): Promise<InsertResult<EntityRelationship>> {
    if (row.fromEntityId === row.toEntityId) throw new Error("relationship-self");
    const { error } = await this.client.from("continuum_relationships").insert({
      id: row.id,
      from_entity_id: row.fromEntityId,
      to_entity_id: row.toEntityId,
      kind: row.kind,
      status: row.status,
      source_system: row.sourceSystem,
      created_at: row.createdAt,
      created_by: row.createdBy,
    });
    if (error && isUniqueViolation(error)) {
      return { status: "already-present", record: row };
    }
    if (error) throwQuery(error, "insert-relationship-failed");
    return { status: "inserted", record: row };
  }

  async insertSourceNote(row: SourceNote): Promise<InsertResult<SourceNote>> {
    const { error } = await this.client.from("continuum_source_notes").insert(
      sourceNoteInsertRow(row),
    );
    if (error && isUniqueViolation(error)) {
      return { status: "already-present", record: row };
    }
    if (error) throwQuery(error, "insert-note-failed");
    return { status: "inserted", record: row };
  }

  async getSourceNote(id: string): Promise<SourceNote | null> {
    const { data, error } = await this.client
      .from("continuum_source_notes")
      .select(SOURCE_NOTE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throwQuery(error, "get-note-failed");
    if (!data) return null;
    return rowToSourceNote(data);
  }

  async applySourceNoteMutation(
    input: NoteMutationApplyInput,
  ): Promise<NoteMutationApplyResult> {
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
    if (error) {
      const message = error.message ?? "";
      if (message.includes("note-not-found")) throw new Error("note-not-found");
      if (message.includes("person-not-found")) throw new Error("person-not-found");
      if (message.includes("project-not-linked")) throw new Error("project-not-linked");
      if (message.includes("entity-kind-mismatch")) {
        throw new Error("entity-kind-mismatch");
      }
      if (message.includes("cross-person-unconfirmed")) {
        throw new Error("cross-person-unconfirmed");
      }
      throwQuery(error, "mutate-source-note-failed");
    }
    return rpcToNoteMutationResult(data, input);
  }

  async findSourceNoteByIdentity(input: {
    sourceSystem: ContinuumSourceSystem;
    importRowKey: string;
    sourceField: string;
  }): Promise<SourceNote | null> {
    const { data, error } = await this.client
      .from("continuum_source_notes")
      .select(
        "id, person_id, project_id, context_layer, source_system, source_artifact, source_sheet, source_field, import_row_key, gmail_thread_id, note_text, created_at, lifecycle_status, updated_at, updated_by, deleted_at, previous_lifecycle",
      )
      .eq("source_system", input.sourceSystem)
      .eq("import_row_key", input.importRowKey)
      .eq("source_field", input.sourceField)
      .maybeSingle();
    if (error) throwQuery(error, "find-note-failed");
    if (!data) return null;
    return rowToSourceNote(data);
  }

  async hasActiveClientProjectLink(
    personId: string,
    projectId: string,
  ): Promise<boolean> {
    const person = await this.getEntity(personId);
    const project = await this.getEntity(projectId);
    if (!person || person.kind !== "person") return false;
    if (!project || project.kind !== "project") return false;
    const forward = await this.client
      .from("continuum_relationships")
      .select("id")
      .eq("kind", "client-project")
      .eq("status", "active")
      .eq("from_entity_id", personId)
      .eq("to_entity_id", projectId)
      .limit(1);
    if (forward.error) throwQuery(forward.error, "find-client-project-link-failed");
    if ((forward.data?.length ?? 0) > 0) return true;
    const reverse = await this.client
      .from("continuum_relationships")
      .select("id")
      .eq("kind", "client-project")
      .eq("status", "active")
      .eq("from_entity_id", projectId)
      .eq("to_entity_id", personId)
      .limit(1);
    if (reverse.error) throwQuery(reverse.error, "find-client-project-link-failed");
    return (reverse.data?.length ?? 0) > 0;
  }

  async insertWish(row: Wish): Promise<InsertResult<Wish>> {
    await this.assertEntityKind(row.personId, "person");
    const { error } = await this.client.from("continuum_wishes").insert({
      id: row.id,
      person_id: row.personId,
      household_id: row.householdId,
      project_id: row.projectId,
      related_fact_id: row.relatedFactId,
      description: row.description,
      category: row.category,
      status: row.status,
      visibility: row.visibility,
      usage_permission: row.usagePermission,
      source_system: row.sourceSystem,
      created_at: row.createdAt,
      created_by: row.createdBy,
    });
    if (error && isUniqueViolation(error)) {
      return { status: "already-present", record: row };
    }
    if (error) throwQuery(error, "insert-wish-failed");
    return { status: "inserted", record: row };
  }

  async insertProjectProfile(
    profile: ProjectProfile,
  ): Promise<InsertResult<ProjectProfile>> {
    await this.assertEntityKind(profile.projectId, "project");
    const { error } = await this.client.from("continuum_project_profiles").insert({
      project_id: profile.projectId,
      display_title: profile.displayTitle,
      visibility: profile.visibility,
      import_row_key: profile.importRowKey,
      source_system: profile.sourceSystem,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    });
    if (error && isUniqueViolation(error)) {
      const existing = await this.getProjectProfile(profile.projectId);
      if (existing) return { status: "already-present", record: existing };
    }
    if (error) throwQuery(error, "insert-project-profile-failed");
    return { status: "inserted", record: profile };
  }

  async getProjectProfile(projectId: string): Promise<ProjectProfile | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throwQuery(error, "get-project-profile-failed");
    if (!data) return null;
    return {
      projectId: String(data.project_id),
      displayTitle: String(data.display_title),
      visibility: data.visibility,
      importRowKey: data.import_row_key == null ? null : String(data.import_row_key),
      sourceSystem: data.source_system,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
      projectKind: projectKindFromUnknown(data.project_kind),
    };
  }

  async findProjectByImportRowKey(input: {
    sourceSystem: ContinuumSourceSystem;
    importRowKey: string;
  }): Promise<ProjectProfile | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select("*")
      .eq("source_system", input.sourceSystem)
      .eq("import_row_key", input.importRowKey)
      .maybeSingle();
    if (error) throwQuery(error, "find-project-import-key-failed");
    if (!data) return null;
    return {
      projectId: String(data.project_id),
      displayTitle: String(data.display_title),
      visibility: data.visibility,
      importRowKey: data.import_row_key == null ? null : String(data.import_row_key),
      sourceSystem: data.source_system,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
      projectKind: projectKindFromUnknown(data.project_kind),
    };
  }

  async insertProjectHistory(
    history: ProjectHistory,
  ): Promise<InsertResult<ProjectHistory>> {
    const { error } = await this.client.from("continuum_project_history").insert({
      project_id: history.projectId,
      cad_job_number: history.cadJobNumber,
      order_number: history.orderNumber,
      gmail_thread_id: history.gmailThreadId,
      match_judgment: history.matchJudgment,
      match_judgment_raw: history.matchJudgmentRaw,
      finger_size: history.fingerSize,
      metal: history.metal,
      center_stone: history.centerStone,
      diamond_supply_notes: history.diamondSupplyNotes,
      source_system: history.sourceSystem,
      created_at: history.createdAt,
      updated_at: history.updatedAt,
    });
    if (error && isUniqueViolation(error)) {
      const existing = await this.getProjectHistory(history.projectId);
      if (existing) return { status: "already-present", record: existing };
    }
    if (error) throwQuery(error, "insert-project-history-failed");
    return { status: "inserted", record: history };
  }

  async getProjectHistory(projectId: string): Promise<ProjectHistory | null> {
    const { data, error } = await this.client
      .from("continuum_project_history")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throwQuery(error, "get-project-history-failed");
    if (!data) return null;
    return rowToProjectHistory(data as Record<string, unknown>);
  }

  async applyProjectSpecCorrection(
    input: ProjectSpecCorrectionApplyInput,
  ): Promise<ProjectSpecCorrectionApplyResult> {
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
    if (error) {
      const message = error.message ?? "";
      if (message.includes("project-not-found")) throw new Error("project-not-found");
      if (message.includes("entity-kind-mismatch")) {
        throw new Error("entity-kind-mismatch");
      }
      if (message.includes("project-history-not-found")) {
        throw new Error("project-history-not-found");
      }
      throwQuery(error, "correct-project-spec-failed");
    }
    const payload =
      data && typeof data === "object" ? (data as Record<string, unknown>) : null;
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
  }

  async applyProjectKindCorrection(
    input: ProjectKindCorrectionApplyInput,
  ): Promise<ProjectKindCorrectionApplyResult> {
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
    if (error) {
      const message = error.message ?? "";
      if (message.includes("project-not-found")) throw new Error("project-not-found");
      if (message.includes("entity-kind-mismatch")) {
        throw new Error("entity-kind-mismatch");
      }
      if (message.includes("project-history-not-found")) {
        throw new Error("project-history-not-found");
      }
      if (message.includes("invalid-value")) throw new Error("invalid-value");
      throwQuery(error, "correct-project-kind-failed");
    }
    const payload =
      data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const status: ProjectKindCorrectionApplyResult["status"] =
      payload && payload.status === "already-present"
        ? "already-present"
        : "updated";
    const profile =
      payload && payload.profile && typeof payload.profile === "object"
        ? {
            projectId: String(
              (payload.profile as Record<string, unknown>).project_id,
            ),
            displayTitle: String(
              (payload.profile as Record<string, unknown>).display_title,
            ),
            visibility: (payload.profile as Record<string, unknown>)
              .visibility as ProjectProfile["visibility"],
            importRowKey:
              (payload.profile as Record<string, unknown>).import_row_key == null
                ? null
                : String(
                    (payload.profile as Record<string, unknown>).import_row_key,
                  ),
            sourceSystem: (payload.profile as Record<string, unknown>)
              .source_system as ProjectProfile["sourceSystem"],
            createdAt: String(
              (payload.profile as Record<string, unknown>).created_at,
            ),
            updatedAt: String(
              (payload.profile as Record<string, unknown>).updated_at,
            ),
            projectKind: projectKindFromUnknown(
              (payload.profile as Record<string, unknown>).project_kind,
            ),
          }
        : input.next;
    return {
      status,
      profile,
      revisionId:
        payload && payload.revision_id != null
          ? String(payload.revision_id)
          : null,
    };
  }

  async applyImportedProjectHistory(
    history: ProjectHistory,
  ): Promise<InsertResult<ProjectHistory>> {
    const existing = await this.getProjectHistory(history.projectId);
    if (!existing) return this.insertProjectHistory(history);
    const merged = mergeImportedProjectHistory(existing, history);
    if (importedHistoryEqualsCurrent(existing, merged)) {
      return { status: "already-present", record: existing };
    }
    const { error } = await this.client
      .from("continuum_project_history")
      .update({
        cad_job_number: merged.cadJobNumber,
        order_number: merged.orderNumber,
        finger_size: merged.fingerSize,
        metal: merged.metal,
        center_stone: merged.centerStone,
        diamond_supply_notes: merged.diamondSupplyNotes,
        updated_at: history.updatedAt,
      })
      .eq("project_id", history.projectId);
    if (error) throwQuery(error, "merge-imported-project-history-failed");
    return {
      status: "already-present",
      record: { ...merged, updatedAt: history.updatedAt },
    };
  }

  async insertIdentityReview(
    row: IdentityReview,
  ): Promise<InsertResult<IdentityReview>> {
    const { error } = await this.client.from("continuum_identity_reviews").insert({
      id: row.id,
      status: row.status,
      reason_code: row.reasonCode,
      left_person_id: row.leftPersonId,
      right_person_id: row.rightPersonId,
      import_row_key: row.importRowKey,
      issue_text: row.issueText,
      resolution_text: row.resolutionText,
      source_system: row.sourceSystem,
      created_at: row.createdAt,
    });
    if (error && isUniqueViolation(error)) {
      return { status: "already-present", record: row };
    }
    if (error) throwQuery(error, "insert-review-failed");
    return { status: "inserted", record: row };
  }

  async createPersonAtomic(
    input: CreatePersonAtomicInput,
  ): Promise<CreatePersonAtomicResult> {
    const personId = input.entityId ?? randomUUID();
    const { data, error } = await this.client.rpc(
      "continuum_client_memory_create_person",
      {
        p_entity_id: personId,
        p_created_at: input.createdAt,
        p_created_by: input.createdBy,
        p_profile: {
          display_name: input.profile.displayName,
          given_name: input.profile.givenName,
          family_name: input.profile.familyName,
          organization_name: input.profile.organizationName,
          email: input.profile.email,
          phone: input.profile.phone,
          street_address: input.profile.streetAddress,
          city: input.profile.city,
          state: input.profile.state,
          country: input.profile.country,
          postal_code: input.profile.postalCode,
          roles: input.profile.roles,
          source_system: input.profile.sourceSystem,
        },
        p_identities: input.identities.map((identity) => ({
          id: identity.id ?? randomUUID(),
          source_system: identity.sourceSystem,
          identity_kind: identity.identityKind,
          identifier: identity.identifier,
          created_at: input.createdAt,
        })),
      },
    );
    if (error) throwQuery(error, "create-person-atomic-failed");
    const status =
      data && typeof data === "object" && "status" in data
        ? String((data as { status: string }).status)
        : "inserted";
    const profile = { ...input.profile, personId };
    return {
      status: status === "already-present" ? "already-present" : "inserted",
      personId,
      profile,
    };
  }

  async applyExistingPersonAtomic(
    input: ApplyExistingPersonInput,
  ): Promise<ApplyExistingPersonResult> {
    const existing = await this.getPersonProfile(input.personId);
    if (!existing) throw new Error("person profile missing");
    const plan = planProfileMerge(existing, input.profile);
    if (plan.status === "conflict") {
      return { status: "conflict", reason: "profile_conflict", field: plan.field };
    }
    const { error } = await this.client.rpc(
      "continuum_client_memory_apply_existing_person",
      {
        p_person_id: input.personId,
        p_updated_at: input.updatedAt,
        p_profile: {
          display_name: input.profile.displayName ?? null,
          given_name: input.profile.givenName ?? null,
          family_name: input.profile.familyName ?? null,
          organization_name: input.profile.organizationName ?? null,
          email: input.profile.email ?? null,
          phone: input.profile.phone ?? null,
          street_address: input.profile.streetAddress ?? null,
          city: input.profile.city ?? null,
          state: input.profile.state ?? null,
          country: input.profile.country ?? null,
          postal_code: input.profile.postalCode ?? null,
          roles: input.roles ?? [],
        },
        p_identities: input.identities.map((identity) => ({
          id: identity.id ?? randomUUID(),
          source_system: identity.sourceSystem,
          identity_kind: identity.identityKind,
          identifier: identity.identifier,
          created_at: identity.createdAt,
        })),
      },
    );
    if (error) {
      const message = error.message ?? "";
      if (message.includes("profile_conflict")) {
        return { status: "conflict", reason: "profile_conflict" };
      }
      if (message.includes("identity_conflict")) {
        return { status: "conflict", reason: "identity_conflict" };
      }
      throwQuery(error, "apply-existing-person-failed");
    }
    return {
      status: "applied",
      personId: input.personId,
      populated: plan.status === "populate",
    };
  }

  async updatePersonContactAtomic(
    input: UpdatePersonContactInput,
  ): Promise<UpdatePersonContactResult> {
    const { error } = await this.client.rpc(
      "continuum_client_memory_update_person_contact",
      {
        p_person_id: input.personId,
        p_updated_at: input.updatedAt,
        p_profile: {
          display_name: input.profile.displayName,
          given_name: input.profile.givenName,
          family_name: input.profile.familyName,
          organization_name: input.profile.organizationName,
          email: input.profile.email,
          phone: input.profile.phone,
        },
        p_identities: input.identities.map((identity) => ({
          id: identity.id ?? randomUUID(),
          source_system: identity.sourceSystem,
          identity_kind: identity.identityKind,
          identifier: identity.identifier,
          created_at: identity.createdAt,
        })),
      },
    );
    if (error) {
      const message = error.message ?? "";
      if (message.includes("identity_conflict")) {
        return { status: "conflict", reason: "identity_conflict" };
      }
      throwQuery(error, "update-person-contact-failed");
    }
    return { status: "updated", personId: input.personId };
  }

  async inspectCounts(): Promise<ClientMemoryCounts> {
    const persons = await this.countEq("continuum_entities", "kind", "person");
    return {
      persons,
      profiles: await this.count("continuum_person_profiles"),
      identities: await this.count("continuum_external_identities"),
      identitiesByKind: {},
      notes: await this.count("continuum_source_notes"),
      projects: await this.count("continuum_project_profiles"),
      histories: await this.count("continuum_project_history"),
      reviews: await this.count("continuum_identity_reviews"),
      facts: await this.count("continuum_person_facts"),
      relationships: await this.count("continuum_relationships"),
      wishes: await this.count("continuum_wishes"),
    };
  }

  private async count(table: string): Promise<number> {
    const { count, error } = await this.client
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throwQuery(error, `count-${table}-failed`);
    return count ?? 0;
  }

  private async countEq(
    table: string,
    column: string,
    value: string,
  ): Promise<number> {
    const { count, error } = await this.client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) throwQuery(error, `count-${table}-failed`);
    return count ?? 0;
  }

  private async assertEntityKind(id: string, kind: EntityKind): Promise<void> {
    const entity = await this.getEntity(id);
    if (!entity || entity.kind !== kind) {
      throw new Error(
        kind === "person"
          ? "person-profile-requires-person-entity"
          : "project-profile-requires-project-entity",
      );
    }
  }

  private async writeIdentity(
    identity: ExternalIdentity,
  ): Promise<IdentityWriteResult<ExternalIdentity>> {
    const kind = validateIdentityKind(identity.identityKind);
    if (!kind.ok) throw new Error(kind.reason);
    if (identity.identityKind === ("hubspot_deal_id" as IdentityKind)) {
      throw new Error("hubspot_deal_id is not a person identity");
    }
    const { error } = await this.client.from("continuum_external_identities").insert({
      id: identity.id,
      entity_id: identity.entityId,
      source_system: identity.sourceSystem,
      identity_kind: identity.identityKind,
      identifier: identity.identifier,
      created_at: identity.createdAt,
      revoked_at: identity.revokedAt,
    });
    if (error && isUniqueViolation(error)) {
      const hits = await this.findActiveIdentities({
        identityKind: identity.identityKind,
        identifier: identity.identifier,
      });
      const existing =
        hits.find((row) => row.sourceSystem === identity.sourceSystem) ?? hits[0];
      if (existing && existing.entityId === identity.entityId) {
        return { status: "already-present", record: existing };
      }
      if (existing) {
        return {
          status: "conflict",
          record: existing,
          incomingEntityId: identity.entityId ?? "",
        };
      }
    }
    if (error) throwQuery(error, "insert-identity-failed");
    return { status: "inserted", record: identity };
  }
}

export function createSupabaseClientMemoryStore(
  client?: SupabaseClient | null,
): SupabaseClientMemoryStore {
  return new SupabaseClientMemoryStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}

function persistRowToFact(row: Record<string, unknown>): PersonFact {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    factType: String(row.fact_type),
    value: row.value as PersonFact["value"],
    confidence: Number(row.confidence),
    verification: row.verification == null ? null : String(row.verification),
    approvalStatus: row.approval_status as PersonFact["approvalStatus"],
    status: row.status as PersonFact["status"],
    visibility: row.visibility as PersonFact["visibility"],
    usagePermission: row.usage_permission as PersonFact["usagePermission"],
    validFrom: row.valid_from == null ? null : String(row.valid_from),
    validUntil: row.valid_until == null ? null : String(row.valid_until),
    supersedesId: row.supersedes_id == null ? null : String(row.supersedes_id),
    sourceSystem: row.source_system as PersonFact["sourceSystem"],
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
  };
}

function rpcToSetCurrentResult(
  data: unknown,
  fallback: PersonFact,
): SetCurrentPersonFactResult {
  const payload =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const status =
    payload && typeof payload.status === "string" ? payload.status : "inserted";
  const factRow =
    payload && payload.fact && typeof payload.fact === "object"
      ? persistRowToFact(payload.fact as Record<string, unknown>)
      : fallback;
  if (status === "already-present") {
    return { status: "already-present", record: factRow };
  }
  return {
    status: "inserted",
    record: factRow,
    supersededId: factRow.supersedesId,
  };
}

function rpcToNoteMutationResult(
  data: unknown,
  fallback: NoteMutationApplyInput,
): NoteMutationApplyResult {
  const payload =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const status =
    payload && payload.status === "already-present"
      ? "already-present"
      : "updated";
  const noteRow =
    payload && payload.note && typeof payload.note === "object"
      ? rowToSourceNote(payload.note as Record<string, unknown>)
      : fallback.next;
  const revisionId =
    payload && payload.revision_id != null ? String(payload.revision_id) : null;
  return { status, note: noteRow, revisionId };
}

function rowToIdentity(row: Record<string, unknown>): ExternalIdentity {
  return {
    id: String(row.id),
    entityId: row.entity_id == null ? null : String(row.entity_id),
    sourceSystem: row.source_system as ContinuumSourceSystem,
    identityKind: row.identity_kind as IdentityKind,
    identifier: String(row.identifier),
    createdAt: String(row.created_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
  };
}

function profileToRow(profile: PersonProfile) {
  return {
    person_id: profile.personId,
    display_name: profile.displayName,
    given_name: profile.givenName,
    family_name: profile.familyName,
    organization_name: profile.organizationName,
    email: profile.email,
    phone: profile.phone,
    street_address: profile.streetAddress,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    postal_code: profile.postalCode,
    roles: profile.roles,
    source_system: profile.sourceSystem,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function rowToProfile(row: Record<string, unknown>): PersonProfile {
  return {
    personId: String(row.person_id),
    displayName: String(row.display_name),
    givenName: row.given_name == null ? null : String(row.given_name),
    familyName: row.family_name == null ? null : String(row.family_name),
    organizationName:
      row.organization_name == null ? null : String(row.organization_name),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    streetAddress: row.street_address == null ? null : String(row.street_address),
    city: row.city == null ? null : String(row.city),
    state: row.state == null ? null : String(row.state),
    country: row.country == null ? null : String(row.country),
    postalCode: row.postal_code == null ? null : String(row.postal_code),
    roles: Array.isArray(row.roles) ? (row.roles as PersonProfile["roles"]) : [],
    sourceSystem: row.source_system as PersonProfile["sourceSystem"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
