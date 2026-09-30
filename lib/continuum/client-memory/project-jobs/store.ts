import { canonicalOperationKey, type AppliedOperation, type OperationRequest } from "./operation";
/**
 * In-memory Open Jobs store. Isolated from ClientMemoryStore writes
 * so Lifecycle / operating / Gmail adapters cannot create jobs by accident.
 */

import type { ProjectJob } from "./types";
import type { CreateProjectJobApplyResult } from "./create";
import type {
  ApplyOpenJobMutationResult,
  ApplyOpenJobMutationInput,
  OpenJobMutationRecord,
} from "./mutate";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryProjectJobStore {
  private jobs = new Map<string, ProjectJob>();
  private mutationIds = new Map<string, string>();
  private operations = new Map<string, { key: string; request: OperationRequest | null }>();
  private mutations = new Map<string, OpenJobMutationRecord>();

  reset(): void {
    this.operations.clear();
    this.jobs.clear();
    this.mutationIds.clear();
    this.mutations.clear();
  }

  listJobs(projectId?: string | null): ProjectJob[] {
    return [...this.jobs.values()]
      .filter((row) => (projectId === undefined || row.projectId === projectId))
      .sort((a, b) => {
        if (a.createdAt === b.createdAt) return b.jobId.localeCompare(a.jobId);
        return a.createdAt < b.createdAt ? 1 : -1;
      })
      .map((row) => clone(row));
  }

  getJob(jobId: string): ProjectJob | null {
    const row = this.jobs.get(jobId);
    return row ? clone(row) : null;
  }

  findJobByMutationId(mutationId: string): ProjectJob | null {
    const mutation = this.mutations.get(mutationId);
    if (!mutation) return null;
    return this.getJob(mutation.jobId);
  }

  findAppliedOperation(mutationId: string): AppliedOperation | null {
    const operation = this.operations.get(mutationId);
    const job = this.findJobByMutationId(mutationId);
    return job ? { request: clone(operation?.request ?? null), job } : null;
  }

  listUnresolvedJobs(projectId: string | null): ProjectJob[] {
    return this.listJobs(projectId).filter(
      (row) => row.state === "open" || row.state === "snoozed",
    );
  }

  insertJob(job: ProjectJob, request: OperationRequest | null = null): CreateProjectJobApplyResult {
    const key = canonicalOperationKey(job, null, "create", job.createdBy, request);
    const existing = this.findJobByMutationId(job.createdMutationId);
    if (existing) {
      if (this.operations.get(job.createdMutationId)?.key !== key) throw new Error("idempotency-conflict");
      return { status: "already-present", job: existing };
    }
    this.operations.set(job.createdMutationId, { key, request: clone(request) });
    this.jobs.set(job.jobId, clone(job));
    this.mutationIds.set(job.createdMutationId, job.jobId);
    this.mutations.set(job.createdMutationId, {
      mutationId: job.createdMutationId,
      jobId: job.jobId,
      projectId: job.projectId,
      action: "create",
      priorState: null,
      newState: job.state,
      changedAt: job.createdAt,
      changedBy: job.createdBy,
      operation: { prior: null, next: clone(job) },
    });
    return { status: "created", job: clone(job) };
  }

  listMutations(jobId?: string): OpenJobMutationRecord[] {
    return [...this.mutations.values()]
      .filter((row) => (jobId ? row.jobId === jobId : true))
      .map((row) => clone(row));
  }

  applyMutation(input: ApplyOpenJobMutationInput): ApplyOpenJobMutationResult {
    const request = input.request ?? null;
    const key = canonicalOperationKey(input.next, input.prior, input.action, input.changedBy, request);
    const existing = this.findJobByMutationId(input.mutationId);
    if (existing) {
      if (this.operations.get(input.mutationId)?.key !== key) throw new Error("idempotency-conflict");
      return { status: "already-present", job: existing };
    }
    this.operations.set(input.mutationId, { key, request: clone(request) });
    this.jobs.set(input.next.jobId, clone(input.next));
    this.mutations.set(input.mutationId, {
      mutationId: input.mutationId,
      jobId: input.next.jobId,
      projectId: input.next.projectId,
      action: input.action,
      priorState: input.prior.state,
      newState: input.next.state,
      changedAt: input.changedAt,
      changedBy: input.changedBy,
      operation: { prior: clone(input.prior), next: clone(input.next) },
    });
    return { status: "updated", job: clone(input.next) };
  }
}

export function createInMemoryProjectJobStore(): InMemoryProjectJobStore {
  return new InMemoryProjectJobStore();
}
