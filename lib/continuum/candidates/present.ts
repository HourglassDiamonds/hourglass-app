/**
 * Consumer surface for later Human Intake / PLAUD / reMarkable / Calendar /
 * founder review (#18, #19, #20a, #21). Types only — no writers.
 */

import {
  CANDIDATE_CONTRACT_VERSION,
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_STATUSES,
  CANDIDATE_TYPES,
  type CandidateConsumerContract,
  type ContinuumCandidate,
} from "./types";

export const CANDIDATE_CONSUMER_CONTRACT: CandidateConsumerContract = {
  contractVersion: CANDIDATE_CONTRACT_VERSION,
  types: CANDIDATE_TYPES,
  statuses: CANDIDATE_STATUSES,
  mutationBoundary: CANDIDATE_MUTATION_BOUNDARY,
  brainGate: "pluggable-later",
};

export type CandidateReadModel = {
  candidateId: string;
  sourceSystem: ContinuumCandidate["sourceSystem"];
  sourceRef: string;
  sourceTimestamp: string;
  candidateType: ContinuumCandidate["candidateType"];
  status: ContinuumCandidate["status"];
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
    status: row.status,
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
