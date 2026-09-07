/**
 * Canonical Continuum Candidate contract (#17).
 * Later source adapters and founder review consume this surface.
 */

export {
  CANDIDATE_CONFIDENCES,
  CANDIDATE_CONTRACT_VERSION,
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_PARSER_GMAIL_V1,
  CANDIDATE_SOURCE_REF_MAX,
  CANDIDATE_STATUSES,
  CANDIDATE_TYPES,
} from "./types";
export type {
  CandidateConfidence,
  CandidateConsumerContract,
  CandidateEvidenceBasis,
  CandidateMutationBoundary,
  CandidatePayload,
  CandidateStatus,
  CandidateStore,
  CandidateType,
  ContinuumCandidate,
  ContinuumCandidateDraft,
  DatePayload,
  FollowUpPayload,
  NotePayload,
  OpenJobPayload,
  PersonAssociationPayload,
  ProjectAssociationPayload,
  ProjectContextPayload,
  ProposedCanonicalTarget,
  PutCandidateResult,
  StructuredSpecPayload,
} from "./types";
export {
  CANDIDATE_CONSUMER_CONTRACT,
  presentCandidate,
} from "./present";
export type { CandidateReadModel } from "./present";
export {
  DETERMINISTIC_CANDIDATE_BRAIN_GATE,
  DETERMINISTIC_CANDIDATE_BRAIN_GATE_ID,
  isLiveCandidateReasoningEnabled,
} from "./brain-gate";
export type {
  CandidateBrainGate,
  CandidateReasoner,
  CandidateReasonerInput,
} from "./brain-gate";
export { InMemoryCandidateStore, persistCandidates } from "./store";
export {
  assignCandidateId,
  candidateIdFromIdentity,
  candidateIdentityKey,
  clipMatchedText,
  logicalProposalKey,
  proposalKeyOf,
} from "./identity";
