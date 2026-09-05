/**
 * Internal Project Open Jobs surface.
 * App Router code must not import a browser Supabase client.
 * #10 has no founder editing UI.
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
export { InMemoryProjectJobStore, createInMemoryProjectJobStore } from "./store";
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
  OPEN_JOB_DEFERRED_LABEL,
  OPEN_JOB_KIND_LABELS,
  OPEN_JOB_SECTION_TITLE,
  OPEN_JOBS_NONE_LABEL,
  OPEN_JOBS_NOT_CONNECTED_LABEL,
  openJobActorLabel,
  openJobKindLabel,
  openJobSourceLabel,
} from "./present";
