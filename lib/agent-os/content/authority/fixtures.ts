/**
 * Fixture-only Case Study rows for tests.
 * Impossible to surface in production: IDs are fixture- prefixed and
 * production ledger + live/fixture Agent OS runs do not import this module.
 */

import type { AuthorityOutreachWave, CaseStudyLedgerEntry } from "./types";
import { AUTHORITY_OUTREACH_WAVE_ID } from "./types";
import { PRODUCTION_AUTHORITY_OUTREACH_WAVE } from "./ledger";

export const FIXTURE_CASE_STUDY_READY: CaseStudyLedgerEntry = {
  caseStudyId: "fixture-case-study-alpha",
  workingTitle: "Fixture Case Study Alpha",
  status: "ready-to-produce",
  materialReadiness: "ready",
  publicationState: "unknown",
  nextAction: "Draft the opening narrative from affirmed material",
  blocker: null,
  themes: ["sales-proof"],
  lastAffirmedAt: "2026-08-01",
};

export const FIXTURE_CASE_STUDY_BLOCKED: CaseStudyLedgerEntry = {
  caseStudyId: "fixture-case-study-blocked",
  workingTitle: "Fixture Case Study Blocked",
  status: "gathering-material",
  materialReadiness: "incomplete",
  publicationState: "unknown",
  nextAction: null,
  blocker: "Affirmed material is incomplete",
  themes: [],
  lastAffirmedAt: "2026-08-01",
};

export const FIXTURE_OUTREACH_WAVE_DUE: AuthorityOutreachWave = {
  id: AUTHORITY_OUTREACH_WAVE_ID,
  status: "follow-up-due",
  followUpEligibility: "due",
  originalSendDate: null,
  sendDateEpistemicClass: "unknown",
  followUpWindowNote:
    "Fixture-only: follow-up eligibility forced due. No send dates invented.",
  lastAffirmedAt: "2026-08-14",
};

export const FIXTURE_OUTREACH_WAVE_NOT_DUE: AuthorityOutreachWave =
  PRODUCTION_AUTHORITY_OUTREACH_WAVE;
