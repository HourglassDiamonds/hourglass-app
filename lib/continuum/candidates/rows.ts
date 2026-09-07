/**
 * continuum_candidates row mapping for the frozen #17 schema.
 * Used by the durable store. Does not apply SQL.
 */

import {
  CANDIDATE_CONFIDENCES,
  CANDIDATE_REVIEW_ACTIONS,
  CANDIDATE_REVIEW_STATUSES,
  CANDIDATE_SOURCE_SYSTEMS,
  CANDIDATE_STATES,
  CANDIDATE_TYPES,
  type CandidateConfidence,
  type CandidatePayload,
  type CandidateReviewAction,
  type CandidateReviewStatus,
  type CandidateSourceSystem,
  type CandidateState,
  type CandidateType,
  type ContinuumCandidate,
  type ProposedCanonicalTarget,
} from "./types";

export type ContinuumCandidateRow = {
  candidate_id: string;
  source_system: string;
  source_ref: string;
  source_timestamp: string;
  candidate_type: string;
  proposed_target: ProposedCanonicalTarget;
  payload: CandidatePayload;
  confidence: string;
  evidence_basis: ContinuumCandidate["evidenceBasis"];
  candidate_state: string;
  review_status: string;
  last_review_action: string | null;
  founder_edited_payload: CandidatePayload | null;
  founder_edited_target: ProposedCanonicalTarget | null;
  reviewed_at: string | null;
  created_at: string;
  canonical: false;
  automatic_apply: false;
  parser_version: string;
  supersedes_candidate_id: string | null;
  superseded_by_candidate_id: string | null;
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function asIso(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value;
}

function asOptionalIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

export function candidateToRow(row: ContinuumCandidate): ContinuumCandidateRow {
  return {
    candidate_id: row.candidateId,
    source_system: row.sourceSystem,
    source_ref: row.sourceRef,
    source_timestamp: row.sourceTimestamp,
    candidate_type: row.candidateType,
    proposed_target: row.proposedTarget,
    payload: row.payload,
    confidence: row.confidence,
    evidence_basis: {
      ruleIds: [...row.evidenceBasis.ruleIds],
      matchedText: row.evidenceBasis.matchedText,
    },
    candidate_state: row.candidateState,
    review_status: row.reviewStatus,
    last_review_action: row.lastReviewAction,
    founder_edited_payload: row.founderEditedPayload,
    founder_edited_target: row.founderEditedTarget,
    reviewed_at: row.reviewedAt,
    created_at: row.createdAt,
    canonical: false,
    automatic_apply: false,
    parser_version: row.parserVersion,
    supersedes_candidate_id: row.supersedesCandidateId,
    superseded_by_candidate_id: row.supersededByCandidateId,
  };
}

export function rowToCandidate(row: Record<string, unknown>): ContinuumCandidate {
  if (!isOneOf(row.source_system, CANDIDATE_SOURCE_SYSTEMS)) {
    throw new Error("invalid-source-system");
  }
  if (!isOneOf(row.candidate_type, CANDIDATE_TYPES)) {
    throw new Error("invalid-candidate-type");
  }
  if (!isOneOf(row.confidence, CANDIDATE_CONFIDENCES)) {
    throw new Error("invalid-confidence");
  }
  if (!isOneOf(row.candidate_state, CANDIDATE_STATES)) {
    throw new Error("invalid-candidate-state");
  }
  if (!isOneOf(row.review_status, CANDIDATE_REVIEW_STATUSES)) {
    throw new Error("invalid-review-status");
  }
  const lastReviewAction = row.last_review_action;
  if (
    lastReviewAction != null &&
    !isOneOf(lastReviewAction, CANDIDATE_REVIEW_ACTIONS)
  ) {
    throw new Error("invalid-review-action");
  }
  const evidence = row.evidence_basis as ContinuumCandidate["evidenceBasis"] | null;
  if (!evidence || !Array.isArray(evidence.ruleIds)) {
    throw new Error("invalid-evidence-basis");
  }
  const createdAt = asIso(row.created_at, new Date(0).toISOString());
  return {
    candidateId: String(row.candidate_id),
    sourceSystem: row.source_system as CandidateSourceSystem,
    sourceRef: String(row.source_ref),
    sourceTimestamp: asIso(row.source_timestamp, createdAt),
    candidateType: row.candidate_type as CandidateType,
    proposedTarget: row.proposed_target as ProposedCanonicalTarget,
    payload: row.payload as CandidatePayload,
    confidence: row.confidence as CandidateConfidence,
    evidenceBasis: {
      ruleIds: [...evidence.ruleIds],
      matchedText: evidence.matchedText ?? null,
    },
    candidateState: row.candidate_state as CandidateState,
    reviewStatus: row.review_status as CandidateReviewStatus,
    lastReviewAction: (lastReviewAction as CandidateReviewAction | null) ?? null,
    founderEditedPayload: (row.founder_edited_payload as CandidatePayload | null) ?? null,
    founderEditedTarget:
      (row.founder_edited_target as ProposedCanonicalTarget | null) ?? null,
    reviewedAt: asOptionalIso(row.reviewed_at),
    createdAt,
    canonical: false,
    automaticApply: false,
    parserVersion: String(row.parser_version),
    supersedesCandidateId:
      row.supersedes_candidate_id == null ? null : String(row.supersedes_candidate_id),
    supersededByCandidateId:
      row.superseded_by_candidate_id == null
        ? null
        : String(row.superseded_by_candidate_id),
  };
}

export function preserveReviewOnReplace(
  existing: ContinuumCandidate | null,
  incoming: ContinuumCandidate,
): ContinuumCandidate {
  if (!existing) {
    return { ...incoming, canonical: false, automaticApply: false };
  }
  return {
    ...incoming,
    canonical: false,
    automaticApply: false,
    reviewStatus: existing.reviewStatus,
    lastReviewAction: existing.lastReviewAction,
    founderEditedPayload: existing.founderEditedPayload,
    founderEditedTarget: existing.founderEditedTarget,
    reviewedAt: existing.reviewedAt,
  };
}

export function snapshotCandidateRows(
  rows: Iterable<ContinuumCandidateRow>,
): ContinuumCandidateRow[] {
  return [...rows].map((row) => JSON.parse(JSON.stringify(row)) as ContinuumCandidateRow);
}
