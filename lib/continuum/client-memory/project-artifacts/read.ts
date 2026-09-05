/**
 * Deterministic Project Artifact read helpers for Project Desk.
 * Does not invent files from Gmail, Shape Studio, or reconstruction.
 */

import { conciergeProjectArtifactFilePath } from "../read/presentation";
import type {
  ProjectArtifact,
  ProjectDeskArtifact,
  ProjectDeskArtifacts,
} from "./types";

export function disconnectedProjectArtifacts(): ProjectDeskArtifacts {
  return { connected: false };
}

export function sortProjectArtifacts(
  rows: readonly ProjectArtifact[],
): ProjectArtifact[] {
  return [...rows].sort((a, b) => {
    if (a.createdAt === b.createdAt) return b.artifactId.localeCompare(a.artifactId);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function artifactsForProject(
  artifacts: readonly ProjectArtifact[] | null | undefined,
  projectId: string,
): ProjectArtifact[] | null {
  if (artifacts == null) return null;
  return sortProjectArtifacts(
    artifacts.filter((row) => row.projectId === projectId),
  );
}

export function deskArtifactsFromCanonical(
  artifacts: readonly ProjectArtifact[],
): ProjectDeskArtifact[] {
  return artifacts.map((row) => ({
    artifactId: row.artifactId,
    kind: row.kind,
    title: row.title,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    sourceSystem: row.sourceSystem,
    href: conciergeProjectArtifactFilePath(row.projectId, row.artifactId),
  }));
}

export function projectArtifactsReadModel(
  artifacts: readonly ProjectArtifact[] | null | undefined,
  projectId: string,
): ProjectDeskArtifacts {
  const rows = artifactsForProject(artifacts, projectId);
  if (rows == null) return disconnectedProjectArtifacts();
  const items = deskArtifactsFromCanonical(rows);
  return { connected: true, items, count: items.length };
}

export function artifactsCoverageLevel(
  artifacts: ProjectDeskArtifacts,
): "not-connected" | "available" | "none" {
  if (!artifacts.connected) return "not-connected";
  return artifacts.count > 0 ? "available" : "none";
}
