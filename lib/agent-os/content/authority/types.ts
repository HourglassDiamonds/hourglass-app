/**
 * Content Authority specialist — typed contracts.
 * Lives under Content. Not a sixth executive.
 */

export const CASE_STUDY_STATUSES = [
  "candidate",
  "gathering-material",
  "ready-to-produce",
  "in-production",
  "ready-to-publish",
  "published",
  "paused",
] as const;

export type CaseStudyStatus = (typeof CASE_STUDY_STATUSES)[number];

export const CASE_STUDY_MATERIAL_READINESS = [
  "ready",
  "incomplete",
  "unknown",
] as const;

export type CaseStudyMaterialReadiness =
  (typeof CASE_STUDY_MATERIAL_READINESS)[number];

export const CASE_STUDY_PUBLICATION_STATES = [
  "unknown",
  "verified-unpublished",
  "verified-published",
] as const;

export type CaseStudyPublicationState =
  (typeof CASE_STUDY_PUBLICATION_STATES)[number];

export const AUTHORITY_EPISTEMIC_CLASSES = [
  "observed",
  "derived",
  "unknown",
] as const;

export type AuthorityEpistemicClass =
  (typeof AUTHORITY_EPISTEMIC_CLASSES)[number];

/**
 * Founder-affirmed Case Study row. No client PII, no inferred geography.
 * Publication state must be explicit — never inferred from titles.
 */
export type CaseStudyLedgerEntry = {
  caseStudyId: string;
  workingTitle: string;
  status: CaseStudyStatus;
  materialReadiness: CaseStudyMaterialReadiness;
  publicationState: CaseStudyPublicationState;
  /** Explicit next action from the ledger — never invented from generic strategy. */
  nextAction: string | null;
  blocker: string | null;
  themes: readonly string[];
  lastAffirmedAt: string;
};

export const AUTHORITY_OUTREACH_WAVE_STATUSES = [
  "waiting-for-follow-up-window",
  "follow-up-due",
  "closed",
] as const;

export type AuthorityOutreachWaveStatus =
  (typeof AUTHORITY_OUTREACH_WAVE_STATUSES)[number];

export const FOLLOW_UP_ELIGIBILITY_STATES = [
  "not-due",
  "due",
  "unknown",
] as const;

export type FollowUpEligibility = (typeof FOLLOW_UP_ELIGIBILITY_STATES)[number];

/**
 * Current editorial authority-outreach wave.
 * No contacts, no send dates invented, no new list.
 */
export type AuthorityOutreachWave = {
  id: "authority:current-outreach-wave";
  status: AuthorityOutreachWaveStatus;
  followUpEligibility: FollowUpEligibility;
  /** Observed only when founder-affirmed. Never invented. */
  originalSendDate: string | null;
  sendDateEpistemicClass: AuthorityEpistemicClass;
  followUpWindowNote: string;
  lastAffirmedAt: string;
};

export type NextCaseStudySelection = {
  caseStudyId: string;
  workingTitle: string;
  status: CaseStudyStatus;
  nextAction: string;
  blocker: string | null;
  publicationState: CaseStudyPublicationState;
  epistemicClass: "observed";
};

export type AuthorityCaseStudyEvidence = {
  founderAffirmedCount: number;
  activeCount: number;
  blockedCount: number;
  readyToProduceCount: number;
  readyToPublishCount: number;
  publishedCount: number;
  inventoryState: "empty" | "has-entries";
  needsFounderInput: boolean;
  nextCaseStudy: NextCaseStudySelection | null;
  founderInputReason: string | null;
  epistemicNotes: string[];
};

export type AuthorityOutreachEvidence = {
  waveId: AuthorityOutreachWave["id"];
  status: AuthorityOutreachWaveStatus;
  followUpEligibility: FollowUpEligibility;
  originalSendDate: string | null;
  sendDateEpistemicClass: AuthorityEpistemicClass;
  founderTask: "none" | "follow-up-readiness";
  watchLine: string;
};

export type AuthoritySnapshot = {
  status: "ok" | "empty-inventory";
  caseStudyFounderNow: boolean;
  caseStudies: AuthorityCaseStudyEvidence;
  outreach: AuthorityOutreachEvidence;
  facts: string[];
  inferences: string[];
};

export const AUTHORITY_OUTREACH_WAVE_ID =
  "authority:current-outreach-wave" as const;

export const CASE_STUDY_PRODUCTION_BACKLOG_ID =
  "sprint-case-study-production" as const;

export const ACTIVE_CASE_STUDY_STATUSES: readonly CaseStudyStatus[] = [
  "candidate",
  "gathering-material",
  "ready-to-produce",
  "in-production",
  "ready-to-publish",
];
