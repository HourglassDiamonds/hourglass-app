/**
 * Internal Project Artifact create primitive.
 * Founder-owned bytes only. Does not copy Gmail attachments or Shape Studio captures.
 */

import { createHash } from "node:crypto";
import type { ClientMemoryEntity, ProjectProfile } from "../types";
import {
  PROJECT_ARTIFACTS_BUCKET,
  type ProjectArtifact,
  type ProjectArtifactKind,
  type ProjectArtifactSourceSystem,
} from "./types";
import { projectArtifactObjectPath } from "./storage";
import {
  isAllowedArtifactMime,
  isProjectArtifactKind,
  isProjectArtifactUuid,
  parseArtifactBytes,
  parseArtifactCreatedBy,
  parseArtifactSourceRef,
  parseArtifactTitle,
  parseOriginalFilename,
} from "./validate";

const MANUAL_SOURCE: ProjectArtifactSourceSystem = "concierge-manual";

export type CreateProjectArtifactInvalidCode =
  | "invalid-id"
  | "invalid-kind"
  | "invalid-title"
  | "invalid-filename"
  | "invalid-mime"
  | "invalid-bytes"
  | "invalid-source";

export type CreateProjectArtifactResult =
  | {
      ok: true;
      status: "created" | "already-present";
      artifact: ProjectArtifact;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "project-not-found"
        | "entity-kind-mismatch"
        | "unavailable";
      code?: CreateProjectArtifactInvalidCode;
    };

export type CreateProjectArtifactInput = {
  mutationId: string;
  projectId: string;
  kind: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
  actor: string;
  sourceSystem?: string | null;
  sourceRef?: string | null;
};

export type CreateProjectArtifactApplyResult = {
  status: "created" | "already-present";
  artifact: ProjectArtifact;
};

export type CreateProjectArtifactDeps = {
  nowIso: () => string;
  newArtifactId: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  applyCreate: (
    artifact: ProjectArtifact,
    bytes: Uint8Array,
    contentSha256: string,
  ) => Promise<CreateProjectArtifactApplyResult>;
};

function invalid(
  code: CreateProjectArtifactInvalidCode,
): Extract<CreateProjectArtifactResult, { ok: false }> {
  return { ok: false, reason: "invalid-input", code };
}

export function artifactContentSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function createProjectArtifact(
  deps: CreateProjectArtifactDeps,
  input: CreateProjectArtifactInput,
): Promise<CreateProjectArtifactResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isProjectArtifactUuid(mutationId) || !isProjectArtifactUuid(projectId)) {
    return invalid("invalid-id");
  }
  if (!isProjectArtifactKind(input.kind)) return invalid("invalid-kind");
  const title = parseArtifactTitle(input.title);
  if (!title.ok) return invalid("invalid-title");
  const filename = parseOriginalFilename(input.originalFilename);
  if (!filename.ok) return invalid("invalid-filename");
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!isAllowedArtifactMime(mimeType)) return invalid("invalid-mime");
  const parsedBytes = parseArtifactBytes(input.bytes);
  if (!parsedBytes.ok) return invalid("invalid-bytes");
  const createdBy = parseArtifactCreatedBy(input.actor);
  if (!createdBy.ok) return invalid("invalid-id");
  const sourceRef = parseArtifactSourceRef(input.sourceRef);
  if (!sourceRef.ok) return invalid("invalid-source");
  const sourceSystem = input.sourceSystem?.trim() || MANUAL_SOURCE;
  if (sourceSystem !== MANUAL_SOURCE && sourceSystem !== "continuum") {
    return invalid("invalid-source");
  }

  try {
    const entity = await deps.getEntity(projectId);
    if (!entity) return { ok: false, reason: "project-not-found" };
    if (entity.kind !== "project") {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    const profile = await deps.getProjectProfile(projectId);
    if (!profile || profile.projectId !== projectId) {
      return { ok: false, reason: "project-not-found" };
    }
    const artifactId = deps.newArtifactId();
    const storagePath = projectArtifactObjectPath(projectId, artifactId, mimeType);
    if (!storagePath) return invalid("invalid-mime");
    const now = deps.nowIso();
    const artifact: ProjectArtifact = {
      artifactId,
      projectId,
      kind: input.kind as ProjectArtifactKind,
      title: title.title,
      originalFilename: filename.filename,
      mimeType,
      byteSize: parsedBytes.bytes.byteLength,
      storageBucket: PROJECT_ARTIFACTS_BUCKET,
      storagePath,
      createdAt: now,
      createdBy: createdBy.createdBy,
      sourceSystem,
      sourceRef: sourceRef.sourceRef,
      createdMutationId: mutationId,
    };
    const result = await deps.applyCreate(
      artifact,
      parsedBytes.bytes,
      artifactContentSha256(parsedBytes.bytes),
    );
    return { ok: true, status: result.status, artifact: result.artifact };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
