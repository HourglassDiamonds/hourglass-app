export type {
  HumanIntakeEvidence,
  HumanIntakePerson,
  HumanIntakeProject,
  HumanIntakeWorld,
  IntakeLocator,
  IntakeParseHit,
} from "./types";
export { parseHumanIntakeEvidence } from "./parse";
export { proposeHumanIntakeCandidates, proposeParsedHumanEvidence } from "./propose";
export type {
  HumanEvidenceAdapterSource,
  PackHumanEvidenceLocatorRef,
  ProposeHumanIntakeCandidatesInput,
  ProposeHumanIntakeCandidatesResult,
  ProposeParsedHumanEvidenceInput,
} from "./propose";
export {
  ingestHumanIntakeCandidates,
  applyHumanIntakeCandidateLineage,
  listHumanIntakeCandidatesForSource,
  listHumanSourceCandidatesForSource,
  humanIntakeSourceRefPrefix,
} from "./ingest";
export type { IngestHumanIntakeCandidatesResult } from "./ingest";
export {
  packHumanIntakeCandidateSourceRef,
  parseHumanIntakeCandidateSourceRef,
  sourceIdFromCandidateSourceRef,
  sourceIdFromHumanCandidateSourceRef,
  HUMAN_INTAKE_CANDIDATE_SOURCE_VERSION,
} from "./source-ref";
export {
  findExactPersonMatches,
  looksLikeEmail,
  uniquePersonMatch,
  uniqueProjectTitleMatch,
} from "./match";
export {
  HUMAN_INTAKE_CANDIDATE_TYPE_LABELS,
  HUMAN_INTAKE_REVIEW_LABELS,
  humanIntakeCandidateTypeLabel,
  humanIntakeProposedSummary,
  humanIntakeReviewLabel,
  presentHumanIntakeCandidate,
} from "./present";
