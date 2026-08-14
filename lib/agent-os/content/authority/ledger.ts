/**
 * Founder-affirmed Case Study ledger + current authority-outreach wave.
 *
 * Production inventory is EMPTY until the founder affirms real Case Studies.
 * Do not scrape HubSpot, filenames, or Conversations to fill this.
 */

import type {
  AuthorityOutreachWave,
  CaseStudyLedgerEntry,
} from "./types";
import { AUTHORITY_OUTREACH_WAVE_ID } from "./types";

/**
 * Production Case Study inventory.
 * Empty by design — no founder-affirmed entries exist in the repository yet.
 */
export const PRODUCTION_CASE_STUDY_LEDGER: readonly CaseStudyLedgerEntry[] = [];

/**
 * Current authority outreach wave — management-affirmed.
 * Original send date is unknown; do not invent one.
 * Follow-up is NOT DUE until explicitly affirmed.
 */
export const PRODUCTION_AUTHORITY_OUTREACH_WAVE: AuthorityOutreachWave = {
  id: AUTHORITY_OUTREACH_WAVE_ID,
  status: "waiting-for-follow-up-window",
  followUpEligibility: "not-due",
  originalSendDate: null,
  sendDateEpistemicClass: "unknown",
  followUpWindowNote:
    "5–7 business-day follow-up window. Eligibility is management-affirmed; original send date is unknown.",
  lastAffirmedAt: "2026-08-14",
};

export function isFixtureOnlyCaseStudyId(caseStudyId: string): boolean {
  return caseStudyId.startsWith("fixture-");
}

/**
 * Production runs must never receive fixture-only ledger rows.
 */
export function assertProductionLedgerSafe(
  entries: readonly CaseStudyLedgerEntry[],
): void {
  for (const entry of entries) {
    if (isFixtureOnlyCaseStudyId(entry.caseStudyId)) {
      throw new Error(
        "Fixture-only Case Study entries cannot be used in production Authority runs",
      );
    }
  }
}
