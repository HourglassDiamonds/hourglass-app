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
  listHumanSourceCandidatesForSource,
  looksLikeEmail,
  parseHumanIntakeEvidence,
  presentHumanIntakeCandidate,
  proposeHumanIntakeCandidates,
  proposeParsedHumanEvidence,
  sourceIdFromCandidateSourceRef,
  sourceIdFromHumanCandidateSourceRef,
  uniquePersonMatch,
} from "./candidates";
export type {
  HumanEvidenceAdapterSource,
  HumanIntakeEvidence,
  HumanIntakePerson,
  HumanIntakeProject,
  HumanIntakeWorld,
  IngestHumanIntakeCandidatesResult,
  PackHumanEvidenceLocatorRef,
  ProposeHumanIntakeCandidatesInput,
  ProposeHumanIntakeCandidatesResult,
  ProposeParsedHumanEvidenceInput,
} from "./candidates";
