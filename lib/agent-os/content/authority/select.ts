/**
 * Deterministic next-Case-Study selector.
 * Only uses explicit ledger nextAction — never invents generic content work.
 */

import {
  ACTIVE_CASE_STUDY_STATUSES,
  type CaseStudyLedgerEntry,
  type CaseStudyStatus,
  type NextCaseStudySelection,
} from "./types";

const ACTIONABLE_STATUS_RANK: Record<CaseStudyStatus, number> = {
  "in-production": 0,
  "ready-to-produce": 1,
  "ready-to-publish": 2,
  "gathering-material": 3,
  candidate: 4,
  paused: 5,
  published: 99,
};

function isActionable(entry: CaseStudyLedgerEntry): boolean {
  if (entry.status === "published" || entry.status === "paused") return false;
  if (!ACTIVE_CASE_STUDY_STATUSES.includes(entry.status)) return false;
  if (!entry.nextAction?.trim()) return false;
  return true;
}

/**
 * One actionable founder-affirmed Case Study, or null.
 * Tie-break: status rank, then lastAffirmedAt desc, then caseStudyId.
 */
export function selectNextCaseStudy(
  entries: readonly CaseStudyLedgerEntry[],
): NextCaseStudySelection | null {
  const actionable = entries.filter(isActionable);
  if (actionable.length === 0) return null;

  const sorted = [...actionable].sort((a, b) => {
    const rank =
      ACTIONABLE_STATUS_RANK[a.status] - ACTIONABLE_STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    const date = b.lastAffirmedAt.localeCompare(a.lastAffirmedAt);
    if (date !== 0) return date;
    return a.caseStudyId.localeCompare(b.caseStudyId);
  });

  const pick = sorted[0];
  return {
    caseStudyId: pick.caseStudyId,
    workingTitle: pick.workingTitle,
    status: pick.status,
    nextAction: pick.nextAction!.trim(),
    blocker: pick.blocker,
    publicationState: pick.publicationState,
    epistemicClass: "observed",
  };
}
