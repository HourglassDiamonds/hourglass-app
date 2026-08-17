/**
 * Client Attention — unified internal signal model for CRM / inbox / Concierge.
 * Lives under Business Intelligence (normalize) → Chief of Staff (rank / brief).
 * Not a new executive. Not a website journey module (see bi/journey).
 *
 * Internal model may retain contact refs for synthesis; founder-facing
 * recommendations must stay PII-safe (no raw email bodies, tokens, or CRM dumps).
 */

import type { Urgency } from "../../types";
import type {
  ClientAttentionDiscrepancyClass,
  ClientAttentionSourceType,
} from "./source-of-truth";

export type {
  ClientAttentionDiscrepancyClass,
  ClientAttentionOwner,
  ClientAttentionOwnedDomain,
  ClientAttentionSourceType,
} from "./source-of-truth";

export {
  CLIENT_ATTENTION_DISCREPANCY_CLASSES,
  CLIENT_ATTENTION_SOURCE_OWNERSHIP,
  CLIENT_ATTENTION_SOURCE_TYPES,
  ownerForClientAttentionDomain,
} from "./source-of-truth";

export const CLIENT_ATTENTION_SIGNAL_TYPES = [
  "new-inquiry",
  "new-inquiry-needs-review",
  "reply-overdue",
  "unanswered-inbound",
  "stalled-conversation",
  "follow-up-due",
  "proposal-date-approaching",
  "appointment-approaching",
  "deal-stage-risk",
  "missing-next-step",
  "client-milestone",
  "data-discrepancy",
  "buyer-concern-pattern",
] as const;

export type ClientAttentionSignalType =
  (typeof CLIENT_ATTENTION_SIGNAL_TYPES)[number];

export const CLIENT_ATTENTION_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
] as const;

export type ClientAttentionConfidence =
  (typeof CLIENT_ATTENTION_CONFIDENCE_LEVELS)[number];

export const CLIENT_ATTENTION_EVIDENCE_KINDS = [
  "gmail-thread-meta",
  "gmail-message-meta",
  "hubspot-contact",
  "hubspot-deal",
  "hubspot-activity",
  "hubspot-task",
  "hubspot-note",
  "concierge-submission",
  "cross-source-compare",
  "derived-pattern",
  "source-gap",
] as const;

export type ClientAttentionEvidenceKind =
  (typeof CLIENT_ATTENTION_EVIDENCE_KINDS)[number];

/**
 * Compact evidence pointer — observations only, not raw message bodies.
 * Prefer ids + timestamps + short observations over verbatim client text.
 */
export type ClientSignalEvidence = {
  id: string;
  sourceType: ClientAttentionSourceType | "derived";
  kind: ClientAttentionEvidenceKind;
  observedAt?: string;
  /** Short factual observation; never paste secrets or full email bodies. */
  observation: string;
  /** Opaque source object id (thread, contact, deal, submission) when available. */
  sourceObjectId?: string;
  reliability: "reliable" | "degraded" | "unverified" | "unavailable";
  redactionStatus: "clean" | "redacted" | "blocked";
};

/**
 * One founder-relevant client/prospect attention unit after BI normalization.
 * Multiple raw source rows may collapse into a single signal via identity keys.
 */
export type ClientAttentionSignal = {
  id: string;
  /** HubSpot contact id when known. */
  contactId?: string;
  /** HubSpot deal id when known. */
  dealId?: string;
  /**
   * Internal identity only — do not copy into founder brief copy.
   * Prefer hashing into id / subjectKey for recommendations.
   */
  email?: string;
  displayName?: string;
  /**
   * Stable non-PII subject key for ranking / recurrence
   * (e.g. hash of email or contactId).
   */
  subjectKey: string;
  sourceTypes: ClientAttentionSourceType[];
  signalType: ClientAttentionSignalType;
  urgency: Urgency;
  confidence: ClientAttentionConfidence;
  firstSeenAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastActivityAt?: string;
  nextActivityAt?: string;
  targetDate?: string;
  summary: string;
  whyItMatters: string;
  recommendedAction: string;
  evidence: ClientSignalEvidence[];
  /**
   * Whether inbound→outbound email response state is established.
   * `confirmed-awaiting-reply` requires Gmail (or equivalent) ordering evidence.
   * `unknown` when HubSpot/Concierge alone cannot prove a reply is owed.
   * `not-applicable` for CRM-task / deadline / stage signals.
   */
  responseState: "confirmed-awaiting-reply" | "unknown" | "not-applicable";
  /** Set when Gmail / HubSpot / Concierge materially disagree. */
  discrepancyClass?: ClientAttentionDiscrepancyClass;
  /** True when the signal is a recurring concern pattern, not a single contact. */
  isPattern?: boolean;
  /** Soft cap / brief eligibility — BI may suppress before CoS ranking. */
  founderRankable: boolean;
  suppressReason?: string | null;
};

export type ClientAttentionSourceAvailability = {
  gmail: "ok" | "empty" | "failed" | "not-configured" | "fixture";
  hubspot: "ok" | "empty" | "failed" | "not-configured" | "fixture";
  /** Concierge signals may arrive via HubSpot deals/notes or a future ledger. */
  concierge: "ok" | "empty" | "failed" | "not-configured" | "fixture" | "via-hubspot";
};

export type ClientAttentionDataGap = {
  id: string;
  source: ClientAttentionSourceType | "cross-cutting";
  scope: string;
  affectedAnalyses: string[];
  founderRelevance: "prerequisite" | "diagnostic" | "suppressed";
  resolutionPrerequisite: string;
  suppressFromFounderRanking: boolean;
};

/** Recurring buyer-concern pattern — typed candidate; does not alter Content ROI. */
export type BuyerConcernSignal = {
  concern: string;
  count: number;
  recencyScore: number;
  sourceTypes: Array<"gmail" | "hubspot" | "concierge">;
  confidence: "high" | "medium" | "low";
  evidenceCount: number;
};

/** Read-only backlog candidate — never auto-written to CURRENT_OPERATING_BACKLOG. */
export type ClientActionBacklogCandidate = {
  signalId: string;
  subjectKey: string;
  title: string;
  recommendedAction: string;
  urgency: Urgency;
  dueAt?: string;
  sourceTypes: Array<"gmail" | "hubspot" | "concierge">;
  confidence: "high" | "medium" | "low";
  dedupeKey: string;
};

export type ClientAttentionScoreDimensions = {
  responseDelay: number;
  deadlineProximity: number;
  stageSensitivity: number;
  conversionLikelihood: number;
  relationshipImportance: number;
  missingNextStep: number;
  explicitUrgency: number;
  reputationalRisk: number;
  easeOfResolvingToday: number;
  dataConfidence: number;
  sourceCorroboration: number;
};

export type RankedClientAttentionSignal = {
  signal: ClientAttentionSignal;
  totalScore: number;
  dimensions: ClientAttentionScoreDimensions;
  confidenceAdjustment: number;
  appliedThresholds: string[];
  evidenceSources: Array<"gmail" | "hubspot" | "concierge" | "derived">;
  outranksReason: string;
};

export type ClientAttentionAuditCounts = {
  threadsInspected: number;
  contactsInspected: number;
  dealsInspected: number;
  submissionsInspected: number;
  identitiesResolved: number;
  unresolvedIdentities: number;
  signalsByType: Partial<Record<ClientAttentionSignalType, number>>;
  suppressedSignalCount: number;
};

/**
 * BI submodule output — signals + gaps. Recommendations are produced separately
 * (mirror journeyFindingsToRecommendations) and merged into BI.recommendations.
 */
export type ClientAttentionAudit = {
  collectedAt: string;
  reportingPeriod: { start: string; end: string };
  mode: "fixture" | "live";
  sourceAvailability: ClientAttentionSourceAvailability;
  signals: ClientAttentionSignal[];
  rankedSignals: RankedClientAttentionSignal[];
  buyerConcerns: BuyerConcernSignal[];
  backlogCandidates: ClientActionBacklogCandidate[];
  dataGaps: ClientAttentionDataGap[];
  counts: ClientAttentionAuditCounts;
  /** Highest-urgency rankable signal id, if any. */
  topSignalId: string | null;
  facts: string[];
  inferences: string[];
  /** True when audit fields have been PII-stripped for persistence / CLI. */
  redacted: boolean;
  /**
   * V1 Client Ops health. UNKNOWN when HubSpot is unavailable — never
   * interpret an empty exception list as "zero clients need attention."
   */
  clientOpsHealth: "healthy" | "exceptions" | "unknown";
  clientOpsSeverityCounts: {
    critical: number;
    action: number;
    watch: number;
  };
};

/** Recommendation id prefix — stable namespace under Business Intelligence. */
export const CLIENT_ATTENTION_RECOMMENDATION_PREFIX =
  "business-intelligence:client-attention" as const;

/** Soft cap: client-attention items competing inside the daily 3-priority budget. */
export const MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES = 3;

/** Hard cap on normalized signals retained per run (JSON may keep more raw). */
export const MAX_CLIENT_ATTENTION_SIGNALS = 40;
