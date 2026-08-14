/**
 * Founder-affirmed Case Study ledger + current authority-outreach wave.
 *
 * Production inventory is founder-affirmed only. Do not scrape HubSpot,
 * filenames, or Conversations to fill this. Do not invent client identity,
 * geography, publication state, or missing-material claims.
 */

import type {
  AuthorityOutreachWave,
  CaseStudyLedgerEntry,
} from "./types";
import { AUTHORITY_OUTREACH_WAVE_ID } from "./types";

/**
 * Production Case Study inventory — P1-AUTH-2 founder-affirmed candidates.
 * lastAffirmedAt is the ledger affirmation date, not a project event date.
 *
 * Project facts below are comments only (existing schema has no facts field).
 * They must not be inferred beyond what the founder affirmed.
 */
export const PRODUCTION_CASE_STUDY_LEDGER: readonly CaseStudyLedgerEntry[] = [
  {
    // Existing Aviary Bloom ring on the Hourglass website returned for
    // coordinating wedding bands. Her band: two-tone 14k yellow and white gold,
    // black diamonds, leaf details. His band: coordinated two-tone 14k yellow
    // and white gold, bee motif, "flying" / flight-pattern detail behind the bees.
    caseStudyId: "case-study-aviary-bloom-wedding-set",
    workingTitle: "Aviary Bloom: The Wedding Set",
    status: "candidate",
    materialReadiness: "unknown",
    publicationState: "unknown",
    nextAction: null,
    blocker: null,
    themes: [
      "design continuity",
      "wedding bands",
      "two-tone jewelry",
      "botanical design",
      "black diamonds",
      "mens wedding band",
      "bespoke design language",
    ],
    lastAffirmedAt: "2026-08-14",
  },
  {
    // Sapphire center; diamonds in a bypass-style design; modern "vintage"
    // direction; platinum-ruthenium. No stone origin, treatment, carat, or client facts.
    caseStudyId: "case-study-modern-vintage-sapphire-bypass",
    workingTitle: "Modern Vintage Sapphire Bypass",
    status: "candidate",
    materialReadiness: "unknown",
    publicationState: "unknown",
    nextAction: null,
    blocker: null,
    themes: [
      "sapphire engagement ring",
      "modern vintage",
      "bypass design",
      "platinum ruthenium",
      "colored gemstone",
      "diamond accents",
    ],
    lastAffirmedAt: "2026-08-14",
  },
  {
    // Approximately 2.5ct pear-shaped center; small halo; more traditional
    // design direction; 14k white gold. No grading or client facts.
    caseStudyId: "case-study-pear-small-halo",
    workingTitle: "2.5ct Pear with Small Halo",
    status: "candidate",
    materialReadiness: "unknown",
    publicationState: "unknown",
    nextAction: null,
    blocker: null,
    themes: [
      "pear diamond",
      "halo",
      "traditional engagement ring",
      "restrained detailing",
      "white gold",
    ],
    lastAffirmedAt: "2026-08-14",
  },
  {
    // Oval center approaching 4ct; hidden halo; plain shank; 14k white gold.
    // Exact carat weight and diamond grading are unknown.
    caseStudyId: "case-study-large-oval-hidden-halo",
    workingTitle: "Nearly 4ct Oval with Hidden Halo",
    status: "candidate",
    materialReadiness: "unknown",
    publicationState: "unknown",
    nextAction: null,
    blocker: null,
    themes: [
      "oval diamond",
      "hidden halo",
      "plain shank",
      "restrained design",
      "visual presence",
      "white gold",
    ],
    lastAffirmedAt: "2026-08-14",
  },
  {
    // Potential sale pending. Moval center; three round brilliant-cut diamonds
    // clustered on either side of the head. Sale is not closed.
    caseStudyId: "case-study-moval-rbc-cluster",
    workingTitle: "Moval with Clustered Round Sides",
    status: "paused",
    materialReadiness: "unknown",
    publicationState: "unknown",
    nextAction: null,
    blocker:
      "Potential sale pending. Do not advance as an active Case Study unless the project becomes a confirmed sale and management updates its status.",
    themes: [
      "moval",
      "mixed diamond shapes",
      "clustered side stones",
      "engagement ring",
    ],
    lastAffirmedAt: "2026-08-14",
  },
  {
    // Potential sale pending. Marquise center; additional marquise-shaped
    // diamonds set east-west; accent marquises flush-set into the band. Sale is not closed.
    caseStudyId: "case-study-marquise-east-west-band",
    workingTitle: "Marquise with East-West Marquise Band",
    status: "paused",
    materialReadiness: "unknown",
    publicationState: "unknown",
    nextAction: null,
    blocker:
      "Potential sale pending. Do not advance as an active Case Study unless the project becomes a confirmed sale and management updates its status.",
    themes: [
      "marquise",
      "east-west setting",
      "flush-set diamonds",
      "engagement ring",
      "mixed orientation",
    ],
    lastAffirmedAt: "2026-08-14",
  },
];

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
