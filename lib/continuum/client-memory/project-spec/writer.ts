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
import type { ProjectHistory } from "../types";

export type ClientMemoryProjectSpecWriter = {
  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult>;
  getProjectHistory(projectId: string): Promise<ProjectHistory | null>;
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

export class InMemoryClientMemoryProjectSpecWriter
  implements ClientMemoryProjectSpecWriter
{
  constructor(private readonly store: InMemoryClientMemoryStore) {}

  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult> {
    return correctProjectSpec(correctDeps(this.store), input);
  }

  getProjectHistory(projectId: string): Promise<ProjectHistory | null> {
    return this.store.getProjectHistory(projectId);
  }
}

export function createInMemoryClientMemoryProjectSpecWriter(
  store: InMemoryClientMemoryStore,
): InMemoryClientMemoryProjectSpecWriter {
  return new InMemoryClientMemoryProjectSpecWriter(store);
}
