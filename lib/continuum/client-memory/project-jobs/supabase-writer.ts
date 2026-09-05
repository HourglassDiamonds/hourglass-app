/**
 * Supabase Open Jobs founder writer.
 * Service-role only. Import from `./server`.
 * Does not write Gmail, Human Intake, CoS, or Lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "../../contracts/types";
import { createProjectJob } from "./create";
import type { CreateProjectJobInput, CreateProjectJobResult } from "./create";
import { mutateOpenJob } from "./mutate";
import type {
  ApplyOpenJobMutationInput,
  ApplyOpenJobMutationResult,
  MutateOpenJobInput,
  MutateOpenJobResult,
} from "./mutate";
import { PROJECT_JOB_COLUMNS, rowToProjectJob } from "./rows";
import { projectJobToRow } from "./write-row";
import type { ProjectJob } from "./types";
import type { PersonProfile, ProjectProfile } from "../types";
import { projectKindFromUnknown } from "../project-kind";
import type { ProjectJobWriter } from "./writer";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function writeReason(message: string): Error {
  if (message.includes("project-not-found")) return new Error("project-not-found");
  if (message.includes("job-not-found")) return new Error("job-not-found");
  if (message.includes("entity-kind-mismatch")) {
    return new Error("entity-kind-mismatch");
  }
  return new Error(message || "mutate-project-job-failed");
}

export class SupabaseProjectJobWriter implements ProjectJobWriter {
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

  private async getProjectProfile(
    projectId: string,
  ): Promise<ProjectProfile | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select(
        "project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at, project_kind",
      )
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      projectId: String(data.project_id),
      displayTitle: String(data.display_title),
      visibility: data.visibility as ProjectProfile["visibility"],
      importRowKey:
        data.import_row_key == null ? null : String(data.import_row_key),
      sourceSystem: data.source_system as ProjectProfile["sourceSystem"],
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
      projectKind: projectKindFromUnknown(data.project_kind),
    };
  }

  private async getPersonProfile(
    personId: string,
  ): Promise<PersonProfile | null> {
    const { data, error } = await this.client
      .from("continuum_person_profiles")
      .select("person_id, display_name")
      .eq("person_id", personId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      personId: String(data.person_id),
      displayName: String(data.display_name),
      givenName: null,
      familyName: null,
      organizationName: null,
      email: null,
      phone: null,
      streetAddress: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
      roles: ["client"],
      sourceSystem: "concierge-manual",
      createdAt: "",
      updatedAt: "",
    };
  }

  private async hasActiveClientProjectRelationship(
    projectId: string,
    personId: string,
  ): Promise<boolean> {
    const forward = await this.client
      .from("continuum_relationships")
      .select("id")
      .eq("kind", "client-project")
      .eq("status", "active")
      .eq("from_entity_id", personId)
      .eq("to_entity_id", projectId)
      .limit(1);
    if (forward.error) throw forward.error;
    if ((forward.data ?? []).length > 0) return true;
    const reverse = await this.client
      .from("continuum_relationships")
      .select("id")
      .eq("kind", "client-project")
      .eq("status", "active")
      .eq("from_entity_id", projectId)
      .eq("to_entity_id", personId)
      .limit(1);
    if (reverse.error) throw reverse.error;
    return (reverse.data ?? []).length > 0;
  }

  private async loadJob(jobId: string): Promise<ProjectJob | null> {
    const { data, error } = await this.client
      .from("continuum_project_jobs")
      .select(PROJECT_JOB_COLUMNS)
      .eq("job_id", jobId)
      .maybeSingle();
    if (error) throw writeReason(error.message ?? "");
    return rowToProjectJob((data ?? null) as Record<string, unknown> | null);
  }

  private async findJobByMutationId(mutationId: string): Promise<ProjectJob | null> {
    const existingMutation = await this.client
      .from("continuum_project_job_mutations")
      .select("job_id")
      .eq("mutation_id", mutationId)
      .maybeSingle();
    if (existingMutation.error) throw writeReason(existingMutation.error.message);
    if (!existingMutation.data?.job_id) return null;
    return this.loadJob(String(existingMutation.data.job_id));
  }

  async getJob(projectId: string, jobId: string): Promise<ProjectJob | null> {
    const job = await this.loadJob(jobId);
    if (!job || job.projectId !== projectId) return null;
    return job;
  }

  private async applyCreate(job: ProjectJob) {
    const existingMutation = await this.client
      .from("continuum_project_job_mutations")
      .select("job_id")
      .eq("mutation_id", job.createdMutationId)
      .maybeSingle();
    if (existingMutation.error) throw writeReason(existingMutation.error.message);
    if (existingMutation.data?.job_id) {
      const existing = await this.loadJob(String(existingMutation.data.job_id));
      if (existing) return { status: "already-present" as const, job: existing };
    }
    const inserted = await this.client
      .from("continuum_project_jobs")
      .insert(projectJobToRow(job))
      .select(PROJECT_JOB_COLUMNS)
      .maybeSingle();
    if (inserted.error) {
      if (/duplicate|unique/i.test(inserted.error.message)) {
        const existing = await this.client
          .from("continuum_project_jobs")
          .select(PROJECT_JOB_COLUMNS)
          .eq("created_mutation_id", job.createdMutationId)
          .maybeSingle();
        const mapped = rowToProjectJob(
          (existing.data ?? null) as Record<string, unknown> | null,
        );
        if (mapped) return { status: "already-present" as const, job: mapped };
      }
      throw writeReason(inserted.error.message);
    }
    const mapped = rowToProjectJob(
      (inserted.data ?? null) as Record<string, unknown> | null,
    );
    if (!mapped) throw new Error("unavailable");
    const mutation = await this.client.from("continuum_project_job_mutations").insert({
      mutation_id: job.createdMutationId,
      job_id: mapped.jobId,
      project_id: mapped.projectId,
      action: "create",
      prior_state: null,
      new_state: mapped.state,
      changed_at: mapped.createdAt,
      changed_by: mapped.createdBy,
      source_system: "concierge-manual",
    });
    if (mutation.error && !/duplicate|unique/i.test(mutation.error.message)) {
      throw writeReason(mutation.error.message);
    }
    return { status: "created" as const, job: mapped };
  }

  private async applyMutation(
    input: ApplyOpenJobMutationInput,
  ): Promise<ApplyOpenJobMutationResult> {
    const existingMutation = await this.client
      .from("continuum_project_job_mutations")
      .select("job_id")
      .eq("mutation_id", input.mutationId)
      .maybeSingle();
    if (existingMutation.error) throw writeReason(existingMutation.error.message);
    if (existingMutation.data?.job_id) {
      const existing = await this.loadJob(String(existingMutation.data.job_id));
      if (existing) return { status: "already-present", job: existing };
    }
    const updated = await this.client
      .from("continuum_project_jobs")
      .update({
        kind: input.next.kind,
        subject: input.next.subject,
        detail: input.next.detail,
        waiting_on_actor: input.next.waitingOnActor,
        associated_person_id: input.next.associatedPersonId,
        state: input.next.state,
        due_at: input.next.dueAt,
        deferred_until: input.next.deferredUntil,
        resolved_at: input.next.resolvedAt,
        cancelled_at: input.next.cancelledAt,
        updated_at: input.next.updatedAt,
      })
      .eq("job_id", input.next.jobId)
      .eq("project_id", input.next.projectId)
      .select(PROJECT_JOB_COLUMNS)
      .maybeSingle();
    if (updated.error) throw writeReason(updated.error.message);
    const mapped = rowToProjectJob(
      (updated.data ?? null) as Record<string, unknown> | null,
    );
    if (!mapped) throw new Error("job-not-found");
    const mutation = await this.client.from("continuum_project_job_mutations").insert({
      mutation_id: input.mutationId,
      job_id: mapped.jobId,
      project_id: mapped.projectId,
      action: input.action,
      prior_state: input.prior.state,
      new_state: mapped.state,
      changed_at: input.changedAt,
      changed_by: input.changedBy,
      source_system: "concierge-manual",
    });
    if (mutation.error && !/duplicate|unique/i.test(mutation.error.message)) {
      throw writeReason(mutation.error.message);
    }
    return { status: "updated", job: mapped };
  }

  createJob(input: CreateProjectJobInput): Promise<CreateProjectJobResult> {
    return createProjectJob(
      {
        nowIso: () => new Date().toISOString(),
        newJobId: () => randomUUID(),
        getEntity: (id) => this.getEntityKind(id),
        getProjectProfile: (projectId) => this.getProjectProfile(projectId),
        getPersonProfile: (personId) => this.getPersonProfile(personId),
        hasActiveClientProjectRelationship: (projectId, personId) =>
          this.hasActiveClientProjectRelationship(projectId, personId),
        applyCreate: (job) => this.applyCreate(job),
      },
      input,
    );
  }

  mutateJob(input: MutateOpenJobInput): Promise<MutateOpenJobResult> {
    return mutateOpenJob(
      {
        nowIso: () => new Date().toISOString(),
        getEntity: (id) => this.getEntityKind(id),
        getProjectProfile: (projectId) => this.getProjectProfile(projectId),
        getPersonProfile: (personId) => this.getPersonProfile(personId),
        hasActiveClientProjectRelationship: (projectId, personId) =>
          this.hasActiveClientProjectRelationship(projectId, personId),
        getJob: (jobId) => this.loadJob(jobId),
        findAppliedMutation: (mutationId) => this.findJobByMutationId(mutationId),
        applyMutation: (row) => this.applyMutation(row),
      },
      input,
    );
  }
}

export function createSupabaseProjectJobWriter(
  client?: SupabaseClient | null,
): ProjectJobWriter {
  return new SupabaseProjectJobWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
