/**
 * Case Study + outreach-wave evidence from explicit ledger state only.
 */

import { selectNextCaseStudy } from "./select";
import {
  ACTIVE_CASE_STUDY_STATUSES,
  type AuthorityCaseStudyEvidence,
  type AuthorityOutreachEvidence,
  type AuthorityOutreachWave,
  type CaseStudyLedgerEntry,
} from "./types";

export function buildCaseStudyEvidence(
  entries: readonly CaseStudyLedgerEntry[],
): AuthorityCaseStudyEvidence {
  const founderAffirmedCount = entries.length;
  const activeCount = entries.filter((e) =>
    ACTIVE_CASE_STUDY_STATUSES.includes(e.status),
  ).length;
  const blockedCount = entries.filter(
    (e) => Boolean(e.blocker?.trim()) || !e.nextAction?.trim(),
  ).length;
  const readyToProduceCount = entries.filter(
    (e) => e.status === "ready-to-produce",
  ).length;
  const readyToPublishCount = entries.filter(
    (e) => e.status === "ready-to-publish",
  ).length;
  const publishedCount = entries.filter((e) => e.status === "published").length;
  const nextCaseStudy = selectNextCaseStudy(entries);

  const inventoryState = founderAffirmedCount === 0 ? "empty" : "has-entries";
  const needsFounderInput = nextCaseStudy === null;

  let founderInputReason: string | null = null;
  if (inventoryState === "empty") {
    founderInputReason =
      "No founder-affirmed Case Study inventory exists yet. Do not invent a Case Study or substitute a Conversation.";
  } else if (!nextCaseStudy) {
    const firstBlocker = entries.find((e) => e.blocker?.trim())?.blocker ?? null;
    founderInputReason =
      firstBlocker ??
      "Case Studies exist but none have an explicit next action. Founder input is required.";
  }

  const epistemicNotes = [
    "OBSERVED: explicit ledger rows only",
    "DERIVED: counts and next-Case-Study selection from ledger fields",
    "UNKNOWN: client facts, geography, and unpublished send dates not on the ledger",
  ];

  return {
    founderAffirmedCount,
    activeCount,
    blockedCount,
    readyToProduceCount,
    readyToPublishCount,
    publishedCount,
    inventoryState,
    needsFounderInput,
    nextCaseStudy,
    founderInputReason,
    epistemicNotes,
  };
}

export function buildOutreachEvidence(
  wave: AuthorityOutreachWave,
): AuthorityOutreachEvidence {
  const eligibility = wave.followUpEligibility;
  const founderTask: AuthorityOutreachEvidence["founderTask"] =
    eligibility === "due" ? "follow-up-readiness" : "none";

  const watchLine =
    eligibility === "due"
      ? "Current authority outreach — follow-up window due (do not send from Agent OS)"
      : eligibility === "unknown"
        ? "Current authority outreach — follow-up eligibility unknown; waiting (management-controlled)"
        : "Current authority outreach — waiting for follow-up window";

  return {
    waveId: wave.id,
    status: wave.status,
    followUpEligibility: eligibility,
    originalSendDate: wave.originalSendDate,
    sendDateEpistemicClass: wave.sendDateEpistemicClass,
    founderTask,
    watchLine,
  };
}
