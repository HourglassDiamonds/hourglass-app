/**
 * Gmail → Candidate adapter. Evidence in, proposals out.
 * Does not fetch Gmail or write canonical Client Memory.
 */

export {
  proposeGmailCandidates,
} from "./propose";
export type {
  ProposeGmailCandidatesInput,
  ProposeGmailCandidatesResult,
} from "./propose";
export { ingestGmailCandidates, applyCandidateLineage } from "./ingest";
export type { IngestGmailCandidatesResult } from "./ingest";
export {
  packGmailCandidateSourceRef,
  parseGmailCandidateSourceRef,
  GMAIL_CANDIDATE_SOURCE_VERSION,
} from "./source-ref";
export {
  evidenceFromExactMessage,
  evidenceFromIndexed,
} from "./types";
export type {
  GmailCandidateEvidence,
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "./types";
export {
  presentEightProjectCandidateDryRun,
  GMAIL_CANDIDATE_DEV_HEADING,
  GMAIL_CANDIDATE_DEV_PATH,
  GMAIL_CANDIDATE_DEV_WARNING,
} from "./dry-run";
export {
  presentIndexedGmailCandidateDryRun,
  presentIndexedEightProjectAcceptance,
  INDEXED_EIGHT_KNOWN_MESSAGE_IDS,
  INDEXED_EIGHT_KNOWN_MESSAGE_IDS_BY_PROJECT,
  INDEXED_EIGHT_PROJECT_KEYS,
  INDEX_ONLY_BODY_DEPENDENT_PARSER_RULES,
  INDEX_LIMITATION_BODY_TEXT_NOT_AVAILABLE,
} from "./indexed-dry-run";
export type {
  IndexedCandidateDryRunRow,
  IndexedEightProjectAcceptance,
  IndexedEightProjectCandidateDryRun,
  IndexedEightProjectKey,
  IndexedProjectAcceptanceRow,
} from "./indexed-dry-run";
export {
  EIGHT_PROJECT_EVIDENCE,
  EIGHT_PROJECT_IDS,
  EIGHT_PROJECT_WORLD,
} from "./fixtures";
