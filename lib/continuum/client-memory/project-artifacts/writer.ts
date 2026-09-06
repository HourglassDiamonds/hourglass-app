/**
 * Founder Project Artifacts writer port.
 * App Router code must import the Supabase adapter from `./server`.
 */

import { randomUUID } from "node:crypto";
import type { InMemoryClientMemoryStore } from "../store";
import { createProjectArtifact } from "./create";
import type {
  CreateProjectArtifactApplyResult,
  CreateProjectArtifactInput,
  CreateProjectArtifactResult,
} from "./create";
import type { InMemoryProjectArtifactStore } from "./store";
import type { ProjectArtifact } from "./types";
import { ProjectArtifactWriteError } from "./write-error";

export type ProjectArtifactBytes = {
  artifact: ProjectArtifact;
  bytes: Uint8Array;
};

export type ProjectArtifactWriter = {
  createArtifact(
    input: CreateProjectArtifactInput,
  ): Promise<CreateProjectArtifactResult>;
  getArtifact(
    projectId: string,
    artifactId: string,
  ): Promise<ProjectArtifact | null>;
  getArtifactBytes(
    projectId: string,
    artifactId: string,
  ): Promise<ProjectArtifactBytes | null>;
  findByIdentityKey(identityKey: string): Promise<ProjectArtifact | null>;
  applyPreparedCreate(
    artifact: ProjectArtifact,
    bytes: Uint8Array,
    identityKey?: string | null,
  ): Promise<CreateProjectArtifactApplyResult>;
  removeStoredObject(storagePath: string): Promise<void>;
};

export function createInMemoryProjectArtifactWriter(
  memory: InMemoryClientMemoryStore,
  artifacts: InMemoryProjectArtifactStore,
  nowIso: () => string = () => new Date().toISOString(),
): ProjectArtifactWriter {
  return {
    createArtifact(input) {
      return createProjectArtifact(
        {
          nowIso,
          newArtifactId: () => randomUUID(),
          getEntity: (id) => memory.getEntity(id),
          getProjectProfile: (projectId) => memory.getProjectProfile(projectId),
          applyCreate: (artifact, bytes) =>
            Promise.resolve(artifacts.insertArtifact(artifact, bytes)),
        },
        input,
      );
    },
    async getArtifact(projectId, artifactId) {
      const row = artifacts.getArtifact(artifactId);
      if (!row || row.projectId !== projectId) return null;
      return row;
    },
    async getArtifactBytes(projectId, artifactId) {
      const artifact = artifacts.getArtifact(artifactId);
      if (!artifact || artifact.projectId !== projectId) return null;
      const bytes = artifacts.getBytes(artifactId);
      if (!bytes) return null;
      return { artifact, bytes };
    },
    async findByIdentityKey(identityKey) {
      return artifacts.findByIdentityKey(identityKey);
    },
    async applyPreparedCreate(artifact, bytes, identityKey) {
      try {
        return artifacts.insertArtifact(artifact, bytes, identityKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "storage-failed") {
          throw new ProjectArtifactWriteError(
            "storage",
            message,
            artifact.storagePath,
          );
        }
        if (message === "db-failed") {
          artifacts.removeBytes(artifact.artifactId);
          throw new ProjectArtifactWriteError("db", message, artifact.storagePath);
        }
        throw error;
      }
    },
    async removeStoredObject(storagePath) {
      for (const row of artifacts.listArtifacts()) {
        if (row.storagePath === storagePath) {
          artifacts.removeBytes(row.artifactId);
        }
      }
    },
  };
}
