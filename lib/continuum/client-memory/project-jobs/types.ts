/**
 * Durable Project-local Open Jobs contracts.
 * Unresolved work inside one Project. Not CoS, todos, Lifecycle, or commitments.
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

export const OPEN_JOB_SUBJECT_MAX = 160;
export const OPEN_JOB_DETAIL_MAX = 2000;
export const OPEN_JOB_SOURCE_REF_MAX = 240;
export const OPEN_JOB_CREATED_BY_MAX = 80;

export type ProjectJob = {
  jobId: string;
  projectId: string;
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
