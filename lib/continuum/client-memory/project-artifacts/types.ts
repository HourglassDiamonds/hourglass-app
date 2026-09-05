/**
 * Hourglass-owned durable Project Artifacts.
 * Canonical Project files. Not Gmail attachments, Shape Studio captures,
 * DI archives, or reconstruction evidence objects.
 * Deletion is not available in this foundation: rows and objects are retained.
 */

export const PROJECT_ARTIFACT_KINDS = [
  "render",
  "cad",
  "inspiration",
  "finished_image",
  "production_image",
  "document",
  "other",
] as const;

export type ProjectArtifactKind = (typeof PROJECT_ARTIFACT_KINDS)[number];

export const PROJECT_ARTIFACT_SOURCE_SYSTEMS = [
  "concierge-manual",
  "gmail",
  "continuum",
] as const;

export type ProjectArtifactSourceSystem =
  (typeof PROJECT_ARTIFACT_SOURCE_SYSTEMS)[number];

export const PROJECT_ARTIFACT_TITLE_MAX = 160;
export const PROJECT_ARTIFACT_FILENAME_MAX = 180;
export const PROJECT_ARTIFACT_SOURCE_REF_MAX = 240;
export const PROJECT_ARTIFACT_CREATED_BY_MAX = 80;
export const PROJECT_ARTIFACT_MAX_BYTES = 25 * 1024 * 1024;

export const PROJECT_ARTIFACTS_BUCKET = "continuum-project-artifacts";

export type ProjectArtifact = {
  artifactId: string;
  projectId: string;
  kind: ProjectArtifactKind;
  title: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  storageBucket: string;
  storagePath: string;
  createdAt: string;
  createdBy: string;
  sourceSystem: ProjectArtifactSourceSystem;
  sourceRef: string | null;
  createdMutationId: string;
};

export type ProjectDeskArtifact = {
  artifactId: string;
  kind: ProjectArtifactKind;
  title: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  sourceSystem: ProjectArtifactSourceSystem;
  href: string;
};

export type ProjectDeskArtifacts =
  | { connected: false }
  | {
      connected: true;
      items: ProjectDeskArtifact[];
      count: number;
    };
