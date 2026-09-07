/**
 * Canonical Continuum Candidate contract (#17).
 * Later source adapters and founder review consume this surface.
 */

export {
  CANDIDATE_CONFIDENCES,
  CANDIDATE_CONTRACT_VERSION,
  CANDIDATE_MUTATION_BOUNDARY,
  CANDIDATE_PARSER_GMAIL_V1,
  CANDIDATE_PARSER_HUMAN_INTAKE_V1,
  CANDIDATE_REVIEW_ACTIONS,
  CANDIDATE_REVIEW_STATUSES,
  CANDIDATE_SOURCE_REF_MAX,
  CANDIDATE_SOURCE_SYSTEMS,
  CANDIDATE_STATES,
  CANDIDATE_TYPES,
  isCandidateSourceSystem,
} from "./types";
export type {
  ApplyReviewResult,
  CandidateConfidence,
  CandidateConsumerContract,
  CandidateEvidenceBasis,
  CandidateMutationBoundary,
  CandidatePayload,
  CandidateReviewAction,
  CandidateReviewStatus,
  CandidateSourceSystem,
  CandidateState,
  CandidateStore,
  CandidateType,
  ContinuumCandidate,
  ContinuumCandidateDraft,
  DatePayload,
  FollowUpPayload,
  FounderReviewInput,
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
export { InMemoryCandidateStore, persistCandidates, adapterInsert } from "./store";
export {
  CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE,
  CONTINUUM_CANDIDATES_TABLE,
  candidateStorageStateFromError,
  probeCandidateStorage,
} from "./activation";
export type { CandidateStorageActivation } from "./activation";
export { candidateToRow, rowToCandidate, preserveReviewOnReplace } from "./rows";
export type { ContinuumCandidateRow } from "./rows";
export { SqlMappedCandidateStore } from "./sql-mapped-store";
export {
  assignCandidateId,
  candidateIdFromIdentity,
  candidateIdentityKey,
  candidateReviewMutationId,
  clipMatchedText,
  logicalProposalKey,
  proposalKeyOf,
} from "./identity";
export {
  applyFounderReview,
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "./review";
