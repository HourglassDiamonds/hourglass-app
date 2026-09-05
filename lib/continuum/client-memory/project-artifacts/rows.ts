/**
 * Row mappers for continuum_project_artifacts.
 * Drops invalid rows instead of inferring missing fields.
 */

import { PROJECT_ARTIFACTS_BUCKET, type ProjectArtifact } from "./types";
import {
  isAllowedArtifactMime,
  isProjectArtifactKind,
  isProjectArtifactSourceSystem,
  parseArtifactCreatedBy,
  parseArtifactSourceRef,
  parseArtifactTitle,
  parseOriginalFilename,
} from "./validate";
import { isProjectArtifactsBucket, projectArtifactObjectPath } from "./storage";

export const PROJECT_ARTIFACT_COLUMNS =
  "artifact_id, project_id, kind, title, original_filename, mime_type, byte_size, storage_bucket, storage_path, created_at, created_by, source_system, source_ref, created_mutation_id";

export function rowToProjectArtifact(
  row: Record<string, unknown> | null | undefined,
): ProjectArtifact | null {
  if (!row || row.artifact_id == null || row.project_id == null) return null;
  if (!isProjectArtifactKind(row.kind)) return null;
  if (!isProjectArtifactSourceSystem(row.source_system)) return null;
  const title = parseArtifactTitle(row.title == null ? null : String(row.title));
  const filename = parseOriginalFilename(
    row.original_filename == null ? null : String(row.original_filename),
  );
  const createdBy = parseArtifactCreatedBy(
    row.created_by == null ? null : String(row.created_by),
  );
  const sourceRef = parseArtifactSourceRef(
    row.source_ref == null ? null : String(row.source_ref),
  );
  const mimeType = String(row.mime_type ?? "").trim().toLowerCase();
  const storageBucket = String(row.storage_bucket ?? "").trim();
  const storagePath = String(row.storage_path ?? "").trim();
  const byteSize = Number(row.byte_size);
  if (!title.ok || !filename.ok || !createdBy.ok || !sourceRef.ok) return null;
  if (!isAllowedArtifactMime(mimeType)) return null;
  if (!isProjectArtifactsBucket(storageBucket)) return null;
  if (!Number.isInteger(byteSize) || byteSize < 1) return null;
  const expectedPath = projectArtifactObjectPath(
    String(row.project_id),
    String(row.artifact_id),
    mimeType,
  );
  if (!expectedPath || storagePath !== expectedPath) return null;
  if (storageBucket !== PROJECT_ARTIFACTS_BUCKET) return null;
  return {
    artifactId: String(row.artifact_id),
    projectId: String(row.project_id),
    kind: row.kind,
    title: title.title,
    originalFilename: filename.filename,
    mimeType,
    byteSize,
    storageBucket,
    storagePath,
    createdAt: String(row.created_at),
    createdBy: createdBy.createdBy,
    sourceSystem: row.source_system,
    sourceRef: sourceRef.sourceRef,
    createdMutationId: String(row.created_mutation_id),
  };
}

export function projectArtifactToRow(
  artifact: ProjectArtifact,
): Record<string, unknown> {
  return {
    artifact_id: artifact.artifactId,
    project_id: artifact.projectId,
    kind: artifact.kind,
    title: artifact.title,
    original_filename: artifact.originalFilename,
    mime_type: artifact.mimeType,
    byte_size: artifact.byteSize,
    storage_bucket: artifact.storageBucket,
    storage_path: artifact.storagePath,
    created_at: artifact.createdAt,
    created_by: artifact.createdBy,
    source_system: artifact.sourceSystem,
    source_ref: artifact.sourceRef,
    created_mutation_id: artifact.createdMutationId,
  };
}
