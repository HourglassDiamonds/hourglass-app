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
import {
  correctProjectOperatingDetail,
  type CorrectOperatingDetailDeps,
  type CorrectOperatingDetailInput,
  type CorrectOperatingDetailResult,
} from "../project-operating/correct";
import {
  setProjectLifecycle,
  type SetProjectLifecycleDeps,
  type SetProjectLifecycleInput,
  type SetProjectLifecycleResult,
} from "../project-lifecycle/set";
import type {
  ProjectCustomDetails,
  ProjectHistory,
  ProjectLifecycleState,
  ProjectProfile,
  ProjectRepairDetails,
} from "../types";
import type { LifecycleKind } from "../project-lifecycle";

export type ClientMemoryProjectSpecWriter = {
  correctProjectSpec(
    input: CorrectProjectSpecInput,
  ): Promise<CorrectProjectSpecResult>;
  correctProjectKind(
    input: CorrectProjectKindInput,
  ): Promise<CorrectProjectKindResult>;
  correctProjectOperatingDetail(
    input: CorrectOperatingDetailInput,
  ): Promise<CorrectOperatingDetailResult>;
  setProjectLifecycle(
    input: SetProjectLifecycleInput,
  ): Promise<SetProjectLifecycleResult>;
  getProjectHistory(projectId: string): Promise<ProjectHistory | null>;
  getProjectProfile(projectId: string): Promise<ProjectProfile | null>;
  getProjectCustomDetails(projectId: string): Promise<ProjectCustomDetails | null>;
  getProjectRepairDetails(projectId: string): Promise<ProjectRepairDetails | null>;
  getProjectLifecycleState(
    projectId: string,
    projectKind: LifecycleKind,
  ): Promise<ProjectLifecycleState | null>;
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

function operatingDeps(
  store: InMemoryClientMemoryStore,
): CorrectOperatingDetailDeps {
  return {
    nowIso: () => new Date().toISOString(),
    newRevisionId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getProjectProfile: (projectId) => store.getProjectProfile(projectId),
    getProjectHistory: (projectId) => store.getProjectHistory(projectId),
    getCustomDetails: (projectId) => store.getProjectCustomDetails(projectId),
    getRepairDetails: (projectId) => store.getProjectRepairDetails(projectId),
    applyCorrection: (input) =>
      store.applyProjectOperatingDetailCorrection(input),
  };
}

function lifecycleDeps(store: InMemoryClientMemoryStore): SetProjectLifecycleDeps {
  return {
    nowIso: () => new Date().toISOString(),
    newEventId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getProjectProfile: (projectId) => store.getProjectProfile(projectId),
    getLifecycleState: (projectId, projectKind) =>
      store.getProjectLifecycleState(projectId, projectKind),
    applyMutation: (input) => store.applyProjectLifecycleMutation(input),
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

  correctProjectOperatingDetail(
    input: CorrectOperatingDetailInput,
  ): Promise<CorrectOperatingDetailResult> {
    return correctProjectOperatingDetail(operatingDeps(this.store), input);
  }

  setProjectLifecycle(
    input: SetProjectLifecycleInput,
  ): Promise<SetProjectLifecycleResult> {
    return setProjectLifecycle(lifecycleDeps(this.store), input);
  }

  getProjectHistory(projectId: string): Promise<ProjectHistory | null> {
    return this.store.getProjectHistory(projectId);
  }

  getProjectProfile(projectId: string): Promise<ProjectProfile | null> {
    return this.store.getProjectProfile(projectId);
  }

  getProjectCustomDetails(
    projectId: string,
  ): Promise<ProjectCustomDetails | null> {
    return this.store.getProjectCustomDetails(projectId);
  }

  getProjectRepairDetails(
    projectId: string,
  ): Promise<ProjectRepairDetails | null> {
    return this.store.getProjectRepairDetails(projectId);
  }

  getProjectLifecycleState(
    projectId: string,
    projectKind: LifecycleKind,
  ): Promise<ProjectLifecycleState | null> {
    return this.store.getProjectLifecycleState(projectId, projectKind);
  }
}

export function createInMemoryClientMemoryProjectSpecWriter(
  store: InMemoryClientMemoryStore,
): InMemoryClientMemoryProjectSpecWriter {
  return new InMemoryClientMemoryProjectSpecWriter(store);
}
