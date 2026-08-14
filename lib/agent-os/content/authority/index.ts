/**
 * Content Authority specialist — Case Study pipeline + current outreach wave.
 * Under Content. Not a sixth executive. GREEN / read-only in P1-AUTH-1.
 */

import {
  isFounderNowItem,
  isNonTerminalBacklogStatus,
} from "../../operating-backlog/surface-policy";
import { CURRENT_OPERATING_BACKLOG } from "../../operating-backlog/current-sprint";
import type { OperatingBacklog } from "../../operating-backlog/types";
import { buildCaseStudyEvidence, buildOutreachEvidence } from "./evidence";
import {
  assertProductionLedgerSafe,
  PRODUCTION_AUTHORITY_OUTREACH_WAVE,
  PRODUCTION_CASE_STUDY_LEDGER,
} from "./ledger";
import { authoritySnapshotToOpportunities } from "./recommendations";
import { CASE_STUDY_PRODUCTION_BACKLOG_ID } from "./types";
import type {
  AuthorityOutreachWave,
  AuthoritySnapshot,
  CaseStudyLedgerEntry,
} from "./types";

export type RunAuthorityOptions = {
  ledger?: readonly CaseStudyLedgerEntry[];
  outreachWave?: AuthorityOutreachWave;
  operatingBacklog?: OperatingBacklog | null;
  caseStudyFounderNow?: boolean;
  /**
   * Allow fixture-prefixed Case Study IDs. Production / default runs omit this.
   */
  allowFixtureLedger?: boolean;
};

export function isCaseStudyProductionFounderNow(
  backlog: OperatingBacklog | null | undefined,
): boolean {
  if (!backlog) return false;
  const items = [...backlog.masterSprint.items, ...backlog.deferred];
  return items.some(
    (i) =>
      i.id === CASE_STUDY_PRODUCTION_BACKLOG_ID &&
      isNonTerminalBacklogStatus(i.status) &&
      isFounderNowItem(i),
  );
}

export function emptyAuthoritySnapshot(
  caseStudyFounderNow = false,
): AuthoritySnapshot {
  return runAuthoritySpecialist({
    ledger: [],
    outreachWave: PRODUCTION_AUTHORITY_OUTREACH_WAVE,
    caseStudyFounderNow,
    allowFixtureLedger: true,
  });
}

export function runAuthoritySpecialist(
  options: RunAuthorityOptions = {},
): AuthoritySnapshot {
  const ledger = options.ledger ?? PRODUCTION_CASE_STUDY_LEDGER;
  if (options.allowFixtureLedger !== true) {
    assertProductionLedgerSafe(ledger);
  }

  const wave = options.outreachWave ?? PRODUCTION_AUTHORITY_OUTREACH_WAVE;
  const backlog =
    options.operatingBacklog === undefined
      ? CURRENT_OPERATING_BACKLOG
      : options.operatingBacklog;
  const caseStudyFounderNow =
    options.caseStudyFounderNow ?? isCaseStudyProductionFounderNow(backlog);

  const caseStudies = buildCaseStudyEvidence(ledger);
  const outreach = buildOutreachEvidence(wave);

  const facts: string[] = [
    `Founder-affirmed Case Studies: ${caseStudies.founderAffirmedCount} (${caseStudies.inventoryState})`,
    `Actionable next Case Study: ${caseStudies.nextCaseStudy ? caseStudies.nextCaseStudy.workingTitle : "none"}`,
    `Authority outreach wave: ${outreach.status}; follow-up=${outreach.followUpEligibility}`,
  ];

  const inferences: string[] = [
    "Case Study publication state is ledger-explicit — never inferred from titles or Conversations",
    outreach.sendDateEpistemicClass === "unknown"
      ? "Authority outreach send date is unknown — follow-up eligibility is management-controlled"
      : "Authority outreach send date is founder-affirmed",
  ];

  return {
    status: caseStudies.inventoryState === "empty" ? "empty-inventory" : "ok",
    caseStudyFounderNow,
    caseStudies,
    outreach,
    facts,
    inferences,
  };
}

export {
  PRODUCTION_CASE_STUDY_LEDGER,
  PRODUCTION_AUTHORITY_OUTREACH_WAVE,
} from "./ledger";
export { selectNextCaseStudy } from "./select";
export {
  authoritySnapshotToOpportunities,
  isOrdinaryEditorialOpportunityType,
  isAuthorityOwnedOpportunityType,
} from "./recommendations";
export {
  classifyAuthorityPermissionTier,
  authorityMayExecute,
  AUTHORITY_GREEN_CAPABILITIES,
  AUTHORITY_YELLOW_CAPABILITIES,
  AUTHORITY_RED_CAPABILITIES,
} from "./permissions";
export {
  AUTHORITY_CASE_STUDY_INVENTORY_ID,
  AUTHORITY_OUTREACH_FOLLOW_UP_ID,
  buildNextCaseStudyOpportunityId,
  authorityIdLooksSafe,
} from "./ids";
export {
  AUTHORITY_OUTREACH_WAVE_ID,
  CASE_STUDY_PRODUCTION_BACKLOG_ID,
  CASE_STUDY_STATUSES,
} from "./types";
export type {
  AuthoritySnapshot,
  AuthorityOutreachWave,
  CaseStudyLedgerEntry,
  CaseStudyStatus,
  NextCaseStudySelection,
} from "./types";
