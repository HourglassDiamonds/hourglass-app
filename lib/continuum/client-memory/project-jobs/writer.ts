/**
 * Founder Open Jobs writer port.
 * App Router code must import the Supabase adapter from `./server`.
 */

import { randomUUID } from "node:crypto";
import type { InMemoryClientMemoryStore } from "../store";
import { createProjectJob } from "./create";
import type { CreateProjectJobInput, CreateProjectJobResult } from "./create";
import { mutateOpenJob } from "./mutate";
import type { MutateOpenJobInput, MutateOpenJobResult } from "./mutate";
import type { InMemoryProjectJobStore } from "./store";
import type { ProjectJob } from "./types";

export type ProjectJobWriter = {
  createJob(input: CreateProjectJobInput): Promise<CreateProjectJobResult>;
  mutateJob(input: MutateOpenJobInput): Promise<MutateOpenJobResult>;
  getJob(projectId: string | null, jobId: string): Promise<ProjectJob | null>;
};

export function createInMemoryProjectJobWriter(
  memory: InMemoryClientMemoryStore,
  jobs: InMemoryProjectJobStore,
  nowIso: () => string = () => new Date().toISOString(),
): ProjectJobWriter {
  return {
    createJob(input) {
      return createProjectJob(
        {
          findAppliedOperation: async (id) => jobs.findAppliedOperation(id),
          nowIso,
          newJobId: () => randomUUID(),
          getEntity: (id) => memory.getEntity(id),
          getProjectProfile: (projectId) => memory.getProjectProfile(projectId),
          getPersonProfile: (personId) => memory.getPersonProfile(personId),
          hasActiveClientProjectRelationship: (projectId, personId) =>
            memory.hasActiveClientProjectLink(personId, projectId),
          listUnresolvedJobs: async (projectId) => jobs.listUnresolvedJobs(projectId),
          applyCreate: (row, request) => Promise.resolve(jobs.insertJob(row, request)),
        },
        input,
      );
    },
    mutateJob(input) {
      return mutateOpenJob(
        {
          nowIso,
          getEntity: (id) => memory.getEntity(id),
          getProjectProfile: (projectId) => memory.getProjectProfile(projectId),
          getPersonProfile: (personId) => memory.getPersonProfile(personId),
          hasActiveClientProjectRelationship: (projectId, personId) =>
            memory.hasActiveClientProjectLink(personId, projectId),
          getJob: async (jobId) => jobs.getJob(jobId),
          findAppliedOperation: async (mutationId) => jobs.findAppliedOperation(mutationId),
          applyMutation: (row) => Promise.resolve(jobs.applyMutation(row)),
        },
        input,
      );
    },
    async getJob(projectId, jobId) {
      const job = jobs.getJob(jobId);
      if (!job || job.projectId !== projectId) return null;
      return job;
    },
  };
}
