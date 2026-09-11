/**
 * Canonical Continuum Candidate contract (#17).
 * Candidate ≠ truth. Cross-source: Gmail, Human Intake, PLAUD, reMarkable, Calendar.
 * Does not write Persons, specs, lifecycle, Kind, Open Jobs, or Gmail.
 *
 * Option B: evidence lineage (candidate_state) is separate from founder
 * review_status. Source adapters never own approve/edit/discard/defer.
 */

import type { OpenJobActor, OpenJobKind } from "../client-memory/project-jobs/types";
import type { EditableProjectSpecField } from "../client-memory/project-spec/types";
import type { RelationshipContextLayer } from "../client-memory/types";

export const CANDIDATE_CONTRACT_VERSION = "continuum-candidates-v1" as const;

export const CANDIDATE_PARSER_GMAIL_V1 =
  "gmail-candidates-deterministic-v1" as const;

export const CANDIDATE_PARSER_HUMAN_INTAKE_V1 =
  "human-intake-candidates-deterministic-v1" as const;

export const CANDIDATE_PARSER_GOOGLE_CALENDAR_V1 =
  "google-calendar-association-deterministic-v1" as const;

export const CANDIDATE_TYPES = [
  "person_association",
  "project_association",
  "project_context",
  "note",
  "structured_spec",
  "open_job",
  "date",
  "follow_up",
] as const;

export type CandidateType = (typeof CANDIDATE_TYPES)[number];

export const CANDIDATE_CONFIDENCES = [
  "high",
  "medium",
  "low",
  "ambiguous",
] as const;

export type CandidateConfidence = (typeof CANDIDATE_CONFIDENCES)[number];

/**
 * Evidence / lineage state. Owned by source adapters + idempotent ingest.
 * Conflict remains even after founder review.
 */
export const CANDIDATE_STATES = ["active", "conflict", "superseded"] as const;

export type CandidateState = (typeof CANDIDATE_STATES)[number];

/**
 * Founder review lifecycle for #19. Persistable. Not owned by source adapters.
 * `edit` is an action, not a status: it stores founderEditedPayload /
 * founderEditedTarget and audit provenance. It does not write canonical state.
 */
export const CANDIDATE_REVIEW_STATUSES = [
  "pending",
  "approved",
  "discarded",
  "deferred",
] as const;

export type CandidateReviewStatus = (typeof CANDIDATE_REVIEW_STATUSES)[number];

export const CANDIDATE_REVIEW_ACTIONS = [
  "approve",
  "edit",
  "discard",
  "defer",
] as const;

export type CandidateReviewAction = (typeof CANDIDATE_REVIEW_ACTIONS)[number];

/**
 * Allow-list for Candidate provenance. Invalid values are not representable
 * in TypeScript and are rejected by the UNAPPLIED SQL CHECK.
 * Do not implement Calendar association in #17.
 */
export const CANDIDATE_SOURCE_SYSTEMS = [
  "gmail",
  "human-intake",
  "plaud",
  "remarkable",
  "google_calendar",
] as const;

export type CandidateSourceSystem = (typeof CANDIDATE_SOURCE_SYSTEMS)[number];

export function isCandidateSourceSystem(
  value: string,
): value is CandidateSourceSystem {
  return (CANDIDATE_SOURCE_SYSTEMS as readonly string[]).includes(value);
}

export const CANDIDATE_SOURCE_REF_MAX = 2048;

export const CANDIDATE_MUTATION_BOUNDARY = {
  canonical: false,
  automaticApply: false,
  writesPersons: false,
  writesProjectSpecs: false,
  writesLifecycle: false,
  writesProjectKind: false,
  createsOpenJobs: false,
  mutatesGmail: false,
  callsSpecWriter: false,
  proposedCanonicalWrites: [] as const,
} as const;

export type CandidateMutationBoundary = typeof CANDIDATE_MUTATION_BOUNDARY;

export type CandidateEvidenceBasis = {
  ruleIds: readonly string[];
  matchedText: string | null;
  /**
   * Observed real Gmail sourceRefs that support a generated operating-mail
   * restatement. Never guessed. Generated Brief sourceRef stays on sourceRef.
   */
  supportingSourceRefs?: readonly string[];
};

export type ProposedCanonicalTarget =
  | { kind: "none" }
  | { kind: "person"; personId: string | null }
  | { kind: "project"; projectId: string | null }
  | {
      kind: "project_spec";
      projectId: string | null;
      fieldName: EditableProjectSpecField;
    }
  | { kind: "open_job"; projectId: string | null };

export type PersonAssociationPayload = {
  kind: "person_association";
  displayName: string | null;
  emailHash: string | null;
  mintPerson: false;
  mergePersons: false;
};

export type ProjectAssociationPayload = {
  kind: "project_association";
  title: string | null;
  token: string | null;
  match: "exact" | "ambiguous";
};

export type ProjectContextPayload = {
  kind: "project_context";
  topic: string;
  value: string;
};

export type NotePayload = {
  kind: "note";
  text: string;
  contextLayer: RelationshipContextLayer | null;
};

export type StructuredSpecPayload = {
  kind: "structured_spec";
  fieldName: EditableProjectSpecField;
  proposedValue: string;
  currentValue: string | null;
  conflict: boolean;
};

export type OpenJobPayload = {
  kind: "open_job";
  jobKind: OpenJobKind;
  subject: string;
  detail: string | null;
  waitingOnActor: OpenJobActor;
  dueAt: string | null;
  createJob: false;
};

export type DatePayload = {
  kind: "date";
  raw: string;
  isoDate: string | null;
  precision: "day" | "unresolved";
  role: "deadline" | "mentioned" | "relative";
  sourceTimestamp: string;
  resolutionCalendar: "source-timestamp-utc-date" | null;
};

export type FollowUpPayload = {
  kind: "follow_up";
  text: string;
  dueAt: string | null;
  sourceTimestamp: string;
};

export type CandidatePayload =
  | PersonAssociationPayload
  | ProjectAssociationPayload
  | ProjectContextPayload
  | NotePayload
  | StructuredSpecPayload
  | OpenJobPayload
  | DatePayload
  | FollowUpPayload;

export type ContinuumCandidate = {
  candidateId: string;
  sourceSystem: CandidateSourceSystem;
  sourceRef: string;
  sourceTimestamp: string;
  candidateType: CandidateType;
  proposedTarget: ProposedCanonicalTarget;
  payload: CandidatePayload;
  confidence: CandidateConfidence;
  evidenceBasis: CandidateEvidenceBasis;
  candidateState: CandidateState;
  reviewStatus: CandidateReviewStatus;
  lastReviewAction: CandidateReviewAction | null;
  founderEditedPayload: CandidatePayload | null;
  founderEditedTarget: ProposedCanonicalTarget | null;
  reviewedAt: string | null;
  createdAt: string;
  canonical: false;
  automaticApply: false;
  parserVersion: string;
  supersedesCandidateId: string | null;
  supersededByCandidateId: string | null;
};

export type ContinuumCandidateDraft = Omit<
  ContinuumCandidate,
  | "createdAt"
  | "supersedesCandidateId"
  | "supersededByCandidateId"
  | "reviewStatus"
  | "lastReviewAction"
  | "founderEditedPayload"
  | "founderEditedTarget"
  | "reviewedAt"
> & {
  createdAt?: string;
  supersedesCandidateId?: string | null;
  supersededByCandidateId?: string | null;
};

export type CandidateIdentityKey = {
  sourceSystem: CandidateSourceSystem;
  sourceRef: string;
  candidateType: CandidateType;
  targetKind: ProposedCanonicalTarget["kind"];
  targetId: string | null;
  targetField: string | null;
  proposalKey: string;
};

export type PutCandidateResult =
  | { status: "inserted"; record: ContinuumCandidate }
  | { status: "duplicate"; record: ContinuumCandidate };

export type FounderReviewInput =
  | { action: "approve"; payload?: CandidatePayload }
  | {
      action: "edit";
      payload: CandidatePayload;
      proposedTarget?: ProposedCanonicalTarget;
    }
  | { action: "discard" }
  | { action: "defer"; until?: string | null };

export type ApplyReviewResult =
  | { ok: true; record: ContinuumCandidate }
  | { ok: false; reason: "not-found" };

export type CandidateStore = {
  put(row: ContinuumCandidate): Promise<PutCandidateResult>;
  get(candidateId: string): Promise<ContinuumCandidate | null>;
  list(): Promise<ContinuumCandidate[]>;
  replace(row: ContinuumCandidate): Promise<ContinuumCandidate>;
  applyReview(
    candidateId: string,
    input: FounderReviewInput,
    reviewedAt: string,
  ): Promise<ApplyReviewResult>;
};

export type CandidateConsumerContract = {
  contractVersion: typeof CANDIDATE_CONTRACT_VERSION;
  types: typeof CANDIDATE_TYPES;
  states: typeof CANDIDATE_STATES;
  reviewStatuses: typeof CANDIDATE_REVIEW_STATUSES;
  reviewActions: typeof CANDIDATE_REVIEW_ACTIONS;
  sourceSystems: typeof CANDIDATE_SOURCE_SYSTEMS;
  mutationBoundary: CandidateMutationBoundary;
  brainGate: "pluggable-later";
  reviewOwnedBy: "founder-review";
  stateOwnedBy: "source-adapter-and-lineage";
};
