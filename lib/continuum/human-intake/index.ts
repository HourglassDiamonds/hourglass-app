/**
 * Human Intake source adapter public surface.
 * Consumes the frozen #17 Continuum Candidate contract.
 */

export {
  CANDIDATE_PARSER_HUMAN_INTAKE_V1,
} from "@/lib/continuum/candidates/types";
export {
  applyHumanIntakeCandidateLineage,
  findExactPersonMatches,
  humanIntakeCandidateTypeLabel,
  humanIntakeProposedSummary,
  humanIntakeReviewLabel,
  ingestHumanIntakeCandidates,
  listHumanIntakeCandidatesForSource,
  looksLikeEmail,
  parseHumanIntakeEvidence,
  presentHumanIntakeCandidate,
  proposeHumanIntakeCandidates,
  sourceIdFromCandidateSourceRef,
  uniquePersonMatch,
} from "./candidates";
export type {
  HumanIntakeEvidence,
  HumanIntakePerson,
  HumanIntakeProject,
  HumanIntakeWorld,
  IngestHumanIntakeCandidatesResult,
  ProposeHumanIntakeCandidatesInput,
  ProposeHumanIntakeCandidatesResult,
} from "./candidates";
