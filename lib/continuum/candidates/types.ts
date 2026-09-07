/**
 * Canonical Continuum Candidate contract (#17).
 * Candidate ≠ truth. Cross-source: Gmail, Human Intake, PLAUD, reMarkable, Calendar.
 * Does not write Persons, specs, lifecycle, Kind, Open Jobs, or Gmail.
 */

import type { ContinuumSourceSystem } from "../contracts/types";
import type { OpenJobActor, OpenJobKind } from "../client-memory/project-jobs/types";
import type { EditableProjectSpecField } from "../client-memory/project-spec/types";
import type { RelationshipContextLayer } from "../client-memory/types";

export const CANDIDATE_CONTRACT_VERSION = "continuum-candidates-v1" as const;

export const CANDIDATE_PARSER_GMAIL_V1 =
  "gmail-candidates-deterministic-v1" as const;

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

export const CANDIDATE_STATUSES = [
  "pending",
  "conflict_review_required",
  "superseded",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

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
  sourceSystem: ContinuumSourceSystem;
  sourceRef: string;
  sourceTimestamp: string;
  candidateType: CandidateType;
  proposedTarget: ProposedCanonicalTarget;
  payload: CandidatePayload;
  confidence: CandidateConfidence;
  evidenceBasis: CandidateEvidenceBasis;
  status: CandidateStatus;
  createdAt: string;
  canonical: false;
  automaticApply: false;
  parserVersion: string;
  supersedesCandidateId: string | null;
  supersededByCandidateId: string | null;
};

export type ContinuumCandidateDraft = Omit<
  ContinuumCandidate,
  "createdAt" | "supersedesCandidateId" | "supersededByCandidateId"
> & {
  createdAt?: string;
  supersedesCandidateId?: string | null;
  supersededByCandidateId?: string | null;
};

export type CandidateIdentityKey = {
  sourceSystem: ContinuumSourceSystem;
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

export type CandidateStore = {
  put(row: ContinuumCandidate): Promise<PutCandidateResult>;
  get(candidateId: string): Promise<ContinuumCandidate | null>;
  list(): Promise<ContinuumCandidate[]>;
};

export type CandidateConsumerContract = {
  contractVersion: typeof CANDIDATE_CONTRACT_VERSION;
  types: typeof CANDIDATE_TYPES;
  statuses: typeof CANDIDATE_STATUSES;
  mutationBoundary: CandidateMutationBoundary;
  brainGate: "pluggable-later";
};
