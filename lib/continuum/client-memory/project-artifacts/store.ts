/**
 * In-memory Project Artifacts store. Isolated from Shape Studio, DI, and Gmail.
 * Deletion is not implemented: rows are retained.
 */

import type { ProjectArtifact } from "./types";
import type { CreateProjectArtifactApplyResult } from "./create";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryProjectArtifactStore {
  private artifacts = new Map<string, ProjectArtifact>();
  private mutationIds = new Map<string, string>();
  private bytes = new Map<string, Uint8Array>();

  reset(): void {
    this.artifacts.clear();
    this.mutationIds.clear();
    this.bytes.clear();
  }

  listArtifacts(projectId?: string): ProjectArtifact[] {
    return [...this.artifacts.values()]
      .filter((row) => (projectId ? row.projectId === projectId : true))
      .sort((a, b) => {
        if (a.createdAt === b.createdAt) return b.artifactId.localeCompare(a.artifactId);
        return a.createdAt < b.createdAt ? 1 : -1;
      })
      .map((row) => clone(row));
  }

  getArtifact(artifactId: string): ProjectArtifact | null {
    const row = this.artifacts.get(artifactId);
    return row ? clone(row) : null;
  }

  getBytes(artifactId: string): Uint8Array | null {
    const row = this.bytes.get(artifactId);
    return row ? new Uint8Array(row) : null;
  }

  insertArtifact(
    artifact: ProjectArtifact,
    bytes: Uint8Array,
  ): CreateProjectArtifactApplyResult {
    const existingMutation = this.mutationIds.get(artifact.createdMutationId);
    if (existingMutation) {
      const existing = this.artifacts.get(existingMutation);
      if (existing) {
        return { status: "already-present", artifact: clone(existing) };
      }
    }
    this.artifacts.set(artifact.artifactId, clone(artifact));
    this.mutationIds.set(artifact.createdMutationId, artifact.artifactId);
    this.bytes.set(artifact.artifactId, new Uint8Array(bytes));
    return { status: "created", artifact: clone(artifact) };
  }
}

export function createInMemoryProjectArtifactStore(): InMemoryProjectArtifactStore {
  return new InMemoryProjectArtifactStore();
}
