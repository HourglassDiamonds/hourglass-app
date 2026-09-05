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
  private mutations = new Map<string, OpenJobMutationRecord>();

  reset(): void {
    this.jobs.clear();
    this.mutationIds.clear();
    this.mutations.clear();
  }

  listJobs(projectId?: string): ProjectJob[] {
    return [...this.jobs.values()]
      .filter((row) => (projectId ? row.projectId === projectId : true))
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

  insertJob(job: ProjectJob): CreateProjectJobApplyResult {
    const existingMutation = this.mutationIds.get(job.createdMutationId);
    if (existingMutation) {
      const existing = this.jobs.get(existingMutation);
      if (existing) {
        return { status: "already-present", job: clone(existing) };
      }
    }
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
    });
    return { status: "created", job: clone(job) };
  }

  listMutations(jobId?: string): OpenJobMutationRecord[] {
    return [...this.mutations.values()]
      .filter((row) => (jobId ? row.jobId === jobId : true))
      .map((row) => clone(row));
  }

  applyMutation(input: ApplyOpenJobMutationInput): ApplyOpenJobMutationResult {
    const existing = this.mutations.get(input.mutationId);
    if (existing) {
      const job = this.jobs.get(existing.jobId);
      if (job) return { status: "already-present", job: clone(job) };
    }
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
    });
    return { status: "updated", job: clone(input.next) };
  }
}

export function createInMemoryProjectJobStore(): InMemoryProjectJobStore {
  return new InMemoryProjectJobStore();
}
