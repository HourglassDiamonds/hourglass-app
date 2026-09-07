/**
 * Read-only dry-run over eight-project Gmail evidence fixtures.
 * Does not mutate Projects, People, Open Jobs, lifecycle, Kind, or Gmail.
 */

import { CANDIDATE_MUTATION_BOUNDARY } from "@/lib/continuum/candidates/types";
import { presentCandidate, type CandidateReadModel } from "@/lib/continuum/candidates/present";
import { proposeGmailCandidates } from "./propose";
import {
  EIGHT_PROJECT_DRY_RUN_CREATED_AT,
  EIGHT_PROJECT_EVIDENCE,
  EIGHT_PROJECT_WORLD,
} from "./fixtures";

export const GMAIL_CANDIDATE_DEV_PATH =
  "/executive-dashboard/concierge/gmail/candidates" as const;

export const GMAIL_CANDIDATE_DEV_HEADING =
  "Gmail candidates — developer inspection" as const;

export const GMAIL_CANDIDATE_DEV_WARNING =
  "FIXTURE inspection only — not the real #16B indexed-Gmail acceptance. Internal contract inspection. Not founder review (#19). No canonical writes.";

export type EightProjectCandidateDryRun = {
  mutationBoundary: typeof CANDIDATE_MUTATION_BOUNDARY;
  liveModelCalls: false;
  candidateCount: number;
  candidates: CandidateReadModel[];
};

export function presentEightProjectCandidateDryRun(): EightProjectCandidateDryRun {
  const proposed = proposeGmailCandidates({
    evidence: EIGHT_PROJECT_EVIDENCE,
    world: EIGHT_PROJECT_WORLD,
    createdAt: EIGHT_PROJECT_DRY_RUN_CREATED_AT,
  });
  return {
    mutationBoundary: proposed.mutationBoundary,
    liveModelCalls: false,
    candidateCount: proposed.candidates.length,
    candidates: proposed.candidates.map(presentCandidate),
  };
}
