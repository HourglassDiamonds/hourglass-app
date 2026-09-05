/**
 * In-memory Open Jobs store. Isolated from ClientMemoryStore writes
 * so Lifecycle / operating / Gmail adapters cannot create jobs by accident.
 */

import type { ProjectJob } from "./types";
import type { CreateProjectJobApplyResult } from "./create";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryProjectJobStore {
  private jobs = new Map<string, ProjectJob>();
  private mutationIds = new Map<string, string>();

  reset(): void {
    this.jobs.clear();
    this.mutationIds.clear();
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
    return { status: "created", job: clone(job) };
  }
}

export function createInMemoryProjectJobStore(): InMemoryProjectJobStore {
  return new InMemoryProjectJobStore();
}
