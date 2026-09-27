/**
 * Project evidence membership.
 * Answers only: does this source belong to this existing project, and how certain are we?
 * Not a truth store, message store, project table, or work loop.
 */

export const PROJECT_EVIDENCE_TABLE = "continuum_project_evidence_associations" as const;

/** Exact identifier lookup. Unapplied until the attachment-number migration exists. */
export const PROJECT_EVIDENCE_THREAD_LOOKUP_RPC =
  "continuum_gmail_thread_ids_for_project_number" as const;

export const PROJECT_EVIDENCE_SOURCE_TYPES = ["gmail"] as const;
export type ProjectEvidenceSourceType = (typeof PROJECT_EVIDENCE_SOURCE_TYPES)[number];

export const PROJECT_EVIDENCE_STATUSES = [
  "candidate",
  "trusted",
  "rejected",
  "ambiguous",
] as const;
export type ProjectEvidenceStatus = (typeof PROJECT_EVIDENCE_STATUSES)[number];

export const PROJECT_EVIDENCE_BASIS_FLAGS = [
  "exact_stored_gmail_thread",
  "founder_approval",
  "founder_rejection",
  "exact_attachment_project_number",
  "known_person_commercial",
  "conflicting_project_numbers",
  "multiple_projects",
  "unresolved_identity",
] as const;
export type ProjectEvidenceBasisFlag = (typeof PROJECT_EVIDENCE_BASIS_FLAGS)[number];

/** Explicit provenance. Not a confidence score. */
export type ProjectEvidenceBasis = {
  flags: readonly ProjectEvidenceBasisFlag[];
  projectNumbers: readonly string[];
  conflictingProjectNumbers: readonly string[];
  attachmentNames: readonly string[];
};

export type ProjectEvidenceCatalogProject = {
  projectId: string;
  label: string;
  cadJobNumber: string | null;
  orderNumber: string | null;
};

export type ProjectEvidenceThread = {
  threadId: string;
  subjects: readonly string[];
  attachmentFilenames: readonly string[];
  earliest: string | null;
  latest: string | null;
};

export type ProjectEvidenceTarget = {
  projectId: string;
  label: string;
  cadJobNumber: string | null;
  orderNumber: string | null;
  storedThreadId: string | null;
  matchJudgment: string | null;
  distrust: boolean;
  linkedPersonLabels: readonly string[];
};

export type ReviewedProjectEvidence = {
  sourceIdentity: string;
  status: ProjectEvidenceStatus;
  basis: ProjectEvidenceBasis;
};

export type DiscoveredProjectEvidence = {
  projectId: string;
  sourceType: ProjectEvidenceSourceType;
  sourceIdentity: string;
  sourceThreadId: string;
  status: ProjectEvidenceStatus;
  basis: ProjectEvidenceBasis;
  earliest: string | null;
  latest: string | null;
  subject: string | null;
  attachmentNames: readonly string[];
  reason: string;
  possibleMatches: readonly string[];
};

export type ProjectEvidenceReviewItem = {
  reviewKey: string;
  channel: "Gmail";
  earliest: string | null;
  latest: string | null;
  subject: string | null;
  attachmentNames: readonly string[];
  reason: string;
  possibleMatches: readonly string[];
};

export type ProjectEvidenceReview = {
  possible: readonly ProjectEvidenceReviewItem[];
  ambiguous: readonly ProjectEvidenceReviewItem[];
};

export const PROJECT_EVIDENCE_ATTACHMENT_LOOKUP_LIMIT = 32;
export const PROJECT_EVIDENCE_THREAD_LIMIT = 8;
export const PROJECT_EVIDENCE_MESSAGE_LIMIT = 80;
