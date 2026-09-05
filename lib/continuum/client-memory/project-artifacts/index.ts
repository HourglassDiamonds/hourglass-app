/**
 * Internal Project Artifacts surface.
 * App Router writer must import the Supabase adapter from `./server`.
 */

export type {
  ProjectArtifact,
  ProjectArtifactKind,
  ProjectArtifactSourceSystem,
  ProjectDeskArtifact,
  ProjectDeskArtifacts,
} from "./types";
export {
  PROJECT_ARTIFACT_KINDS,
  PROJECT_ARTIFACT_MAX_BYTES,
  PROJECT_ARTIFACTS_BUCKET,
} from "./types";
export { createProjectArtifact } from "./create";
export { InMemoryProjectArtifactStore, createInMemoryProjectArtifactStore } from "./store";
export { createInMemoryProjectArtifactWriter } from "./writer";
export type { ProjectArtifactWriter } from "./writer";
export {
  artifactsCoverageLevel,
  disconnectedProjectArtifacts,
  projectArtifactsReadModel,
} from "./read";
export {
  PROJECT_ARTIFACT_ADD_LABEL,
  PROJECT_ARTIFACT_DELETION_LABEL,
  PROJECT_ARTIFACT_KIND_LABELS,
  PROJECT_ARTIFACT_SECTION_TITLE,
  PROJECT_ARTIFACTS_NONE_LABEL,
  PROJECT_ARTIFACTS_NOT_CONNECTED_LABEL,
  projectArtifactKindLabel,
  projectArtifactSourceLabel,
} from "./present";
