/**
 * Internal Project Open Jobs surface.
 * App Router writer must import the Supabase adapter from `./server`.
 * Never import from client components or public routes.
 */

export type {
  OpenJobActor,
  AttentionMetadata,
  AttentionMetadataV1,
  AttentionMode,
  AttentionTimingPrecision,
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
  ATTENTION_MODES,
  ATTENTION_TIMING_PRECISIONS,
} from "./types";
export {
  attentionModeOf,
  canonicalAttentionOf,
  exactAttentionIdentity,
  parseAttention,
  parseAttentionMetadata,
} from "./attention";
export { evaluateAttentionEligibility } from "./attention-eligibility";
export type {
  AttentionEligibility,
  AttentionEligibilityReason,
  AttentionTargetAssessment,
} from "./attention-eligibility";
export {
  attentionBoundaryJobFromRow,
  attentionBoundaryState,
  nextAttentionBoundary,
} from "./attention-boundary";
export { FOUNDER_DEFAULT_TIMEZONE, normalizeAttentionTime } from "./attention-time";
export type {
  AttentionTimeFailure,
  AttentionTimeInput,
  AttentionTimeProposal,
} from "./attention-time";
export {
  reminderDispositionMutation,
  watchingDispositionMutation,
} from "./attention-disposition";
export type { ReminderDisposition, WatchingDisposition } from "./attention-disposition";
export { applyAttentionDisposition } from "./attention-application";
export type { AttentionDispositionInput } from "./attention-application";
export { assessAttentionTarget } from "./attention-evidence";
export {
  ATTENTION_CREATION_PREREQUISITES,
  PHASE_1_ATTENTION_CREATION_ENABLED,
  attentionCreationEnabled,
} from "./attention-creation-gate";
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
export {
  findUnresolvedJobByActionIdentity,
  jobsShareActionIdentity,
  openJobActionIdentityKey,
} from "./identity";
export { mutateOpenJob } from "./mutate";
export type { MutateOpenJobInput, MutateOpenJobResult } from "./mutate";
export { summarizeProjectWork, disconnectedProjectWork } from "./intelligence";
export type { ProjectWorkSummary } from "./intelligence";
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
  projectWorkFacts,
} from "./present";
