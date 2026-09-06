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
  private identityKeys = new Map<string, string>();
  private bytes = new Map<string, Uint8Array>();
  failNextInsert = false;
  failNextBytes = false;

  reset(): void {
    this.artifacts.clear();
    this.mutationIds.clear();
    this.identityKeys.clear();
    this.bytes.clear();
    this.failNextInsert = false;
    this.failNextBytes = false;
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

  findByIdentityKey(identityKey: string): ProjectArtifact | null {
    const artifactId = this.identityKeys.get(identityKey.trim());
    if (!artifactId) return null;
    return this.getArtifact(artifactId);
  }

  insertArtifact(
    artifact: ProjectArtifact,
    bytes: Uint8Array,
    identityKey?: string | null,
  ): CreateProjectArtifactApplyResult {
    const existingMutation = this.mutationIds.get(artifact.createdMutationId);
    if (existingMutation) {
      const existing = this.artifacts.get(existingMutation);
      if (existing) {
        return { status: "already-present", artifact: clone(existing) };
      }
    }
    const key = identityKey?.trim() || "";
    if (key) {
      const existingIdentity = this.identityKeys.get(key);
      if (existingIdentity) {
        const existing = this.artifacts.get(existingIdentity);
        if (existing) {
          return { status: "already-present", artifact: clone(existing) };
        }
      }
    }
    if (this.failNextBytes) {
      this.failNextBytes = false;
      throw new Error("storage-failed");
    }
    const storedBytes = new Uint8Array(bytes);
    this.bytes.set(artifact.artifactId, storedBytes);
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new Error("db-failed");
    }
    this.artifacts.set(artifact.artifactId, clone(artifact));
    this.mutationIds.set(artifact.createdMutationId, artifact.artifactId);
    if (key) this.identityKeys.set(key, artifact.artifactId);
    return { status: "created", artifact: clone(artifact) };
  }

  removeBytes(artifactId: string): void {
    this.bytes.delete(artifactId);
  }
}

export function createInMemoryProjectArtifactStore(): InMemoryProjectArtifactStore {
  return new InMemoryProjectArtifactStore();
}
