/**
 * Consumer surface for later Human Intake / PLAUD / reMarkable / Calendar /
 * founder review (#18, #19, #20a, #21). Types only — no writers.
 */

import {
  CANDIDATE_CONTRACT_VERSION,
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_REVIEW_ACTIONS,
  CANDIDATE_REVIEW_STATUSES,
  CANDIDATE_SOURCE_SYSTEMS,
  CANDIDATE_STATES,
  CANDIDATE_TYPES,
  type CandidateConsumerContract,
  type ContinuumCandidate,
} from "./types";

export const CANDIDATE_CONSUMER_CONTRACT: CandidateConsumerContract = {
  contractVersion: CANDIDATE_CONTRACT_VERSION,
  types: CANDIDATE_TYPES,
  states: CANDIDATE_STATES,
  reviewStatuses: CANDIDATE_REVIEW_STATUSES,
  reviewActions: CANDIDATE_REVIEW_ACTIONS,
  sourceSystems: CANDIDATE_SOURCE_SYSTEMS,
  mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
  brainGate: "pluggable-later",
  reviewOwnedBy: "founder-review",
  stateOwnedBy: "source-adapter-and-lineage",
};

export type CandidateReadModel = {
  candidateId: string;
  sourceSystem: ContinuumCandidate["sourceSystem"];
  sourceRef: string;
  sourceTimestamp: string;
  candidateType: ContinuumCandidate["candidateType"];
  candidateState: ContinuumCandidate["candidateState"];
  reviewStatus: ContinuumCandidate["reviewStatus"];
  lastReviewAction: ContinuumCandidate["lastReviewAction"];
  founderEditedPayload: ContinuumCandidate["founderEditedPayload"];
  founderEditedTarget: ContinuumCandidate["founderEditedTarget"];
  reviewedAt: ContinuumCandidate["reviewedAt"];
  confidence: ContinuumCandidate["confidence"];
  canonical: false;
  automaticApply: false;
  proposedTarget: ContinuumCandidate["proposedTarget"];
  payload: ContinuumCandidate["payload"];
  evidenceBasis: ContinuumCandidate["evidenceBasis"];
  parserVersion: string;
  createdAt: string;
  supersedesCandidateId: string | null;
  supersededByCandidateId: string | null;
};

export function presentCandidate(row: ContinuumCandidate): CandidateReadModel {
  return {
    candidateId: row.candidateId,
    sourceSystem: row.sourceSystem,
    sourceRef: row.sourceRef,
    sourceTimestamp: row.sourceTimestamp,
    candidateType: row.candidateType,
    candidateState: row.candidateState,
    reviewStatus: row.reviewStatus,
    lastReviewAction: row.lastReviewAction,
    founderEditedPayload: row.founderEditedPayload
      ? { ...row.founderEditedPayload }
      : null,
    founderEditedTarget: row.founderEditedTarget
      ? { ...row.founderEditedTarget }
      : null,
    reviewedAt: row.reviewedAt,
    confidence: row.confidence,
    canonical: false,
    automaticApply: false,
    proposedTarget: row.proposedTarget,
    payload: row.payload,
    evidenceBasis: {
      ruleIds: [...row.evidenceBasis.ruleIds],
      matchedText: row.evidenceBasis.matchedText,
    },
    parserVersion: row.parserVersion,
    createdAt: row.createdAt,
    supersedesCandidateId: row.supersedesCandidateId,
    supersededByCandidateId: row.supersededByCandidateId,
  };
}
