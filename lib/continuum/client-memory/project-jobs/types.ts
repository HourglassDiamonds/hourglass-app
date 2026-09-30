/**
 * Durable Open Jobs with optional Project context.
 * A null projectId is founder work without Project context, never an authorization bypass.
 */

export const OPEN_JOB_KINDS = [
  "request",
  "commitment",
  "question",
  "required_action",
  "approval",
  "blocked_issue",
] as const;

export type OpenJobKind = (typeof OPEN_JOB_KINDS)[number];

export const OPEN_JOB_ACTORS = [
  "founder",
  "hourglass",
  "client",
  "vendor",
  "unknown",
] as const;

export type OpenJobActor = (typeof OPEN_JOB_ACTORS)[number];

export const OPEN_JOB_STATES = [
  "open",
  "snoozed",
  "resolved",
  "cancelled",
] as const;

export type OpenJobState = (typeof OPEN_JOB_STATES)[number];

export const UNRESOLVED_OPEN_JOB_STATES = ["open", "snoozed"] as const;

export type UnresolvedOpenJobState = (typeof UNRESOLVED_OPEN_JOB_STATES)[number];

export const OPEN_JOB_SOURCE_SYSTEMS = [
  "concierge-manual",
  "gmail",
  "plaud",
  "remarkable",
  "human-intake",
  "calendar",
  "messages",
  "continuum",
] as const;

export type OpenJobSourceSystem = (typeof OPEN_JOB_SOURCE_SYSTEMS)[number];

export const ATTENTION_MODES = ["action", "reminder", "watching"] as const;
export type AttentionMode = (typeof ATTENTION_MODES)[number];

export const ATTENTION_TIMING_PRECISIONS = [
  "date-only",
  "exact-instant",
] as const;
export type AttentionTimingPrecision =
  (typeof ATTENTION_TIMING_PRECISIONS)[number];

/** Closed, bounded v1 metadata. It contains interpretation provenance, never bodies or events. */
export type AttentionMetadataV1 = {
  version: 1;
  timingPrecision: AttentionTimingPrecision;
  timezone: string;
  originalWording: string;
  referenceInstant: string;
  originalLocalDateTime: string;
  conditionPolicy: "review-only";
  conditionText?: string;
  targetIdentity?: string;
  workstreamIdentity?: string;
  obligationIdentity?: string;
  sourceReference?: string;
  revisionReference?: string;
  commitmentReference?: string;
  assumptions: string[];
  /** Required when a Watching item intentionally has no checkpoint. */
  unscheduledConfirmed?: true;
};

export type AttentionMetadata = AttentionMetadataV1;

export const OPEN_JOB_SUBJECT_MAX = 160;
export const OPEN_JOB_DETAIL_MAX = 2000;
export const OPEN_JOB_SOURCE_REF_MAX = 240;
export const OPEN_JOB_CREATED_BY_MAX = 80;
export const ATTENTION_METADATA_MAX_BYTES = 8 * 1024;
export const ATTENTION_WORDING_MAX = 500;
export const ATTENTION_CONDITION_MAX = 500;
export const ATTENTION_ASSUMPTIONS_MAX = 8;
export const ATTENTION_REFERENCE_MAX = 240;

export type ProjectJob = {
  jobId: string;
  projectId: string | null;
  kind: OpenJobKind;
  subject: string;
  detail: string | null;
  waitingOnActor: OpenJobActor;
  associatedPersonId: string | null;
  state: OpenJobState;
  dueAt: string | null;
  deferredUntil: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  sourceSystem: OpenJobSourceSystem;
  sourceRef: string | null;
  createdMutationId: string;
  /** Missing only on legacy in-memory fixtures/rows; readers normalize it to action. */
  attentionMode?: AttentionMode;
  activationAt?: string | null;
  checkpointAt?: string | null;
  attentionMetadata?: AttentionMetadata | null;
};

export type ProjectDeskOpenJob = {
  jobId: string;
  kind: OpenJobKind;
  subject: string;
  detail: string | null;
  waitingOnActor: OpenJobActor;
  associatedPersonId: string | null;
  associatedPersonName: string | null;
  state: UnresolvedOpenJobState;
  dueAt: string | null;
  deferredUntil: string | null;
  createdAt: string;
  sourceSystem: OpenJobSourceSystem;
};

export type ProjectDeskOpenJobs =
  | { connected: false }
  | {
      connected: true;
      unresolved: ProjectDeskOpenJob[];
      unresolvedCount: number;
    };
