/**
 * Client Memory project-spec writer port and in-memory adapter.
 * Separate from the note writer. Do not add writes to ClientMemoryReader.
 */

import { randomUUID } from "node:crypto";
import type { InMemoryClientMemoryStore } from "../store";
import {
  correctProjectSpec,
  type CorrectProjectSpecDeps,
  type CorrectProjectSpecInput,
  type CorrectProjectSpecResult,
} from "./correct";
import {
  correctProjectKind,
  type CorrectProjectKindDeps,
  type CorrectProjectKindInput,
  type CorrectProjectKindResult,
} from "./correct-kind";
import type { ProjectHistory, ProjectProfile } from "../types";

export type ClientMemoryProjectSpecWriter = {
  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult>;
  correctProjectKind(
    input: CorrectProjectKindInput,
  ): Promise<CorrectProjectKindResult>;
  getProjectHistory(projectId: string): Promise<ProjectHistory | null>;
  getProjectProfile(projectId: string): Promise<ProjectProfile | null>;
};

function correctDeps(store: InMemoryClientMemoryStore): CorrectProjectSpecDeps {
  return {
    nowIso: () => new Date().toISOString(),
    newRevisionId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getProjectHistory: (projectId) => store.getProjectHistory(projectId),
    applyCorrection: (input) => store.applyProjectSpecCorrection(input),
  };
}

function kindDeps(store: InMemoryClientMemoryStore): CorrectProjectKindDeps {
  return {
    nowIso: () => new Date().toISOString(),
    newRevisionId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getProjectProfile: (projectId) => store.getProjectProfile(projectId),
    getProjectHistory: (projectId) => store.getProjectHistory(projectId),
    applyCorrection: (input) => store.applyProjectKindCorrection(input),
  };
}

export class InMemoryClientMemoryProjectSpecWriter
  implements ClientMemoryProjectSpecWriter
{
  constructor(private readonly store: InMemoryClientMemoryStore) {}

  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult> {
    return correctProjectSpec(correctDeps(this.store), input);
  }

  correctProjectKind(
    input: CorrectProjectKindInput,
  ): Promise<CorrectProjectKindResult> {
    return correctProjectKind(kindDeps(this.store), input);
  }

  getProjectHistory(projectId: string): Promise<ProjectHistory | null> {
    return this.store.getProjectHistory(projectId);
  }

  getProjectProfile(projectId: string): Promise<ProjectProfile | null> {
    return this.store.getProjectProfile(projectId);
  }
}

export function createInMemoryClientMemoryProjectSpecWriter(
  store: InMemoryClientMemoryStore,
): InMemoryClientMemoryProjectSpecWriter {
  return new InMemoryClientMemoryProjectSpecWriter(store);
}
