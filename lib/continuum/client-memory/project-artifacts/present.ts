/**
 * Founder-facing Project Artifact labels. Not Gmail previews. Not CoS.
 */

import type { ProjectArtifactKind, ProjectArtifactSourceSystem } from "./types";

export const PROJECT_ARTIFACT_KIND_LABELS: Record<ProjectArtifactKind, string> = {
  render: "Render",
  cad: "CAD",
  inspiration: "Inspiration",
  finished_image: "Finished piece",
  production_image: "Production image",
  document: "Document",
  other: "Other",
};

export const PROJECT_ARTIFACT_SECTION_TITLE = "Project files";
export const PROJECT_ARTIFACTS_NONE_LABEL = "No project files stored yet.";
export const PROJECT_ARTIFACTS_NOT_CONNECTED_LABEL = "Not connected yet";
export const PROJECT_ARTIFACT_ADD_LABEL = "Add project file";
export const PROJECT_ARTIFACT_DELETION_LABEL =
  "Project files are retained. Deletion is not available yet.";

export function projectArtifactKindLabel(kind: ProjectArtifactKind): string {
  return PROJECT_ARTIFACT_KIND_LABELS[kind];
}

export function projectArtifactSourceLabel(
  source: ProjectArtifactSourceSystem,
): string {
  if (source === "concierge-manual") return "Manual";
  if (source === "continuum") return "Internal";
  return "Recorded pointer";
}
