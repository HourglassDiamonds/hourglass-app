/**
 * Founder Project writer port and in-memory adapter.
 */

import { randomUUID } from "node:crypto";
import type { InMemoryClientMemoryStore } from "../store";
import { createInMemoryClientMemoryProjectSpecWriter } from "../project-spec/writer";
import { createInMemoryProjectJobWriter, type ProjectJobWriter } from "../project-jobs/writer";
import type { InMemoryProjectJobStore } from "../project-jobs/store";
import {
  createFounderProject,
  type CreateFounderProjectDeps,
  type CreateFounderProjectInput,
  type CreateFounderProjectResult,
  type FounderLinkedProject,
} from "./create";

export type FounderProjectWriter = {
  createProject(input: CreateFounderProjectInput): Promise<CreateFounderProjectResult>;
  listActiveClientProjects(personId: string): Promise<FounderLinkedProject[]>;
};

export async function listActiveClientProjectsFromMemory(
  store: InMemoryClientMemoryStore,
  personId: string,
): Promise<FounderLinkedProject[]> {
  const out: FounderLinkedProject[] = [];
  for (const row of store.listRelationships()) {
    if (row.kind !== "client-project" || row.status !== "active") continue;
    const projectId =
      row.fromEntityId === personId
        ? row.toEntityId
        : row.toEntityId === personId
          ? row.fromEntityId
          : null;
    if (!projectId) continue;
    const profile = await store.getProjectProfile(projectId);
    if (!profile) continue;
    out.push({
      projectId: profile.projectId,
      title: profile.displayTitle,
      projectKind: profile.projectKind ?? null,
    });
  }
  return out;
}

export function founderProjectDeps(
  memory: InMemoryClientMemoryStore,
  jobs: ProjectJobWriter,
  nowIso: () => string,
): CreateFounderProjectDeps {
  const spec = createInMemoryClientMemoryProjectSpecWriter(memory);
  return {
    nowIso,
    newRelationshipId: () => randomUUID(),
    getEntity: (id) => memory.getEntity(id),
    getPersonProfile: (personId) => memory.getPersonProfile(personId),
    getProjectProfile: (projectId) => memory.getProjectProfile(projectId),
    findProjectByImportRowKey: (input) =>
      memory.findProjectByImportRowKey({
        sourceSystem: input.sourceSystem as never,
        importRowKey: input.importRowKey,
      }),
    listActiveClientProjects: (personId) =>
      listActiveClientProjectsFromMemory(memory, personId),
    insertEntity: (input) => memory.insertEntity(input),
    insertProjectProfile: (profile) => memory.insertProjectProfile(profile),
    insertProjectHistory: (history) => memory.insertProjectHistory(history),
    insertRelationship: (row) => memory.insertRelationship(row),
    correctProjectKind: (input) => spec.correctProjectKind(input),
    setProjectLifecycle: (input) => spec.setProjectLifecycle(input),
    createProjectJob: (input) => jobs.createJob(input),
  };
}

export function createInMemoryFounderProjectWriter(
  memory: InMemoryClientMemoryStore,
  jobs: InMemoryProjectJobStore,
  nowIso: () => string = () => new Date().toISOString(),
): FounderProjectWriter {
  const jobWriter = createInMemoryProjectJobWriter(memory, jobs, nowIso);
  const deps = founderProjectDeps(memory, jobWriter, nowIso);
  return {
    createProject(input) {
      return createFounderProject(deps, input);
    },
    listActiveClientProjects(personId) {
      return listActiveClientProjectsFromMemory(memory, personId);
    },
  };
}
