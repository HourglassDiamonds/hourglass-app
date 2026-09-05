/**
 * Internal Project Open Jobs surface.
 * App Router writer must import the Supabase adapter from `./server`.
 * Never import from client components or public routes.
 */

export type {
  OpenJobActor,
  OpenJobKind,
  OpenJobSourceSystem,
  OpenJobState,
  ProjectDeskOpenJob,
  ProjectDeskOpenJobs,
  ProjectJob,
  UnresolvedOpenJobState,
} from "./types";
export {
  OPEN_JOB_ACTORS,
  OPEN_JOB_KINDS,
  OPEN_JOB_SOURCE_SYSTEMS,
  OPEN_JOB_STATES,
  UNRESOLVED_OPEN_JOB_STATES,
} from "./types";
export {
  isOpenJobActor,
  isOpenJobKind,
  isOpenJobSourceSystem,
  isOpenJobState,
  isUnresolvedOpenJobState,
} from "./validate";
export { createProjectJob } from "./create";
export type {
  CreateProjectJobDeps,
  CreateProjectJobInput,
  CreateProjectJobResult,
} from "./create";
export { mutateOpenJob } from "./mutate";
export type { MutateOpenJobInput, MutateOpenJobResult } from "./mutate";
export { InMemoryProjectJobStore, createInMemoryProjectJobStore } from "./store";
export { createInMemoryProjectJobWriter } from "./writer";
export type { ProjectJobWriter } from "./writer";
export {
  deskJobsFromCanonical,
  disconnectedOpenJobs,
  jobsCoverageLevel,
  openJobsReadModel,
  unresolvedJobsForProject,
} from "./read";
export {
  OPEN_JOB_ACTOR_FIELD_LABEL,
  OPEN_JOB_ACTOR_LABELS,
  OPEN_JOB_ADD_LABEL,
  OPEN_JOB_DEFERRED_LABEL,
  OPEN_JOB_EDIT_LABEL,
  OPEN_JOB_KIND_LABELS,
  OPEN_JOB_SECTION_TITLE,
  OPEN_JOBS_NONE_LABEL,
  OPEN_JOBS_NOT_CONNECTED_LABEL,
  openJobActorLabel,
  openJobKindLabel,
  openJobSourceLabel,
} from "./present";
