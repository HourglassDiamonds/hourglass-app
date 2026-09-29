import type { AppliedOperation, OperationRequest } from "./operation";
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
    if (error) throw writeReason(error.message);
    return rowToProjectJob((data ?? null) as Record<string, unknown> | null);
  }

  private async listUnresolvedJobs(projectId: string | null): Promise<ProjectJob[]> {
    let query = this.client.from("continuum_project_jobs")
      .select(PROJECT_JOB_COLUMNS).in("state", ["open", "snoozed"]);
    query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw writeReason(error.message);
    return (data ?? []).flatMap((row) => {
      const mapped = rowToProjectJob(row as Record<string, unknown>);
      return mapped ? [mapped] : [];
    });
  }

  private async findAppliedOperation(mutationId: string): Promise<AppliedOperation | null> {
    const existingMutation = await this.client
      .from("continuum_project_job_mutations")
      .select("job_id, operation")
      .eq("mutation_id", mutationId)
      .maybeSingle();
    if (existingMutation.error) throw writeReason(existingMutation.error.message);
    if (!existingMutation.data?.job_id) return null;
    const job = await this.loadJob(String(existingMutation.data.job_id));
    if (!job) throw new Error("unavailable");
    return { job, request: existingMutation.data.operation?.request ?? null };
  }

  async getJob(projectId: string | null, jobId: string): Promise<ProjectJob | null> {
    const job = await this.loadJob(jobId);
    if (!job || job.projectId !== projectId) return null;
    return job;
  }

  private async atomicWrite(args: {
    p_job: Record<string, unknown>;
    p_mutation_id: string;
    p_action: string;
    p_changed_by: string;
    p_prior: Record<string, unknown> | null;
    p_request: OperationRequest | null;
  }): Promise<{ status: "created" | "updated" | "already-present"; job: ProjectJob }> {
    const { data, error } = await this.client.rpc("continuum_write_project_job", args);
    if (error) throw writeReason(error.message);
    const job = rowToProjectJob(data?.job);
    if (!job || !["created", "updated", "already-present"].includes(data?.status)) {
      throw new Error("unavailable");
    }
    return { status: data.status, job };
  }

  private async applyCreate(job: ProjectJob, request?: OperationRequest) {
    const result = await this.atomicWrite({
      p_job: projectJobToRow(job), p_mutation_id: job.createdMutationId,
      p_action: "create", p_changed_by: job.createdBy, p_prior: null, p_request: request ?? null,
    });
    if (result.status === "updated") throw new Error("unavailable");
    return { ...result, status: result.status };
  }

  private async applyMutation(input: ApplyOpenJobMutationInput): Promise<ApplyOpenJobMutationResult> {
    const result = await this.atomicWrite({
      p_job: projectJobToRow(input.next), p_mutation_id: input.mutationId,
      p_action: input.action, p_changed_by: input.changedBy,
      p_prior: projectJobToRow(input.prior), p_request: input.request ?? null,
    });
    if (result.status === "created") throw new Error("unavailable");
    return { ...result, status: result.status };
  }

  createJob(input: CreateProjectJobInput): Promise<CreateProjectJobResult> {
    return createProjectJob(
      {
        findAppliedOperation: (id) => this.findAppliedOperation(id),
        nowIso: () => new Date().toISOString(),
        newJobId: () => randomUUID(),
        getEntity: (id) => this.getEntityKind(id),
        getProjectProfile: (projectId) => this.getProjectProfile(projectId),
        getPersonProfile: (personId) => this.getPersonProfile(personId),
        hasActiveClientProjectRelationship: (projectId, personId) =>
          this.hasActiveClientProjectRelationship(projectId, personId),
        listUnresolvedJobs: (projectId) => this.listUnresolvedJobs(projectId),
        applyCreate: (job, request) => this.applyCreate(job, request),
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
        findAppliedOperation: (mutationId) => this.findAppliedOperation(mutationId),
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
