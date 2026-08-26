/**
 * Continuum Chief of Staff 2.0 — canonical attention contracts.
 * Founder-facing copy may name people. Do not write this into kernel observations.
 */

export const CHIEF_OF_STAFF_CONTRACT_VERSION = "2.0.0-phase1b" as const;

export const ATTENTION_KINDS = [
  "founder-action",
  "relationship-follow-through",
  "commitment-due",
  "project-blocked",
  "material-risk",
  "calendar-prep",
  "milestone",
  "specialist-opportunity",
] as const;

export type AttentionKind = (typeof ATTENTION_KINDS)[number];

export const ATTENTION_URGENCIES = ["now", "today", "this-week", "watch"] as const;

export type AttentionUrgency = (typeof ATTENTION_URGENCIES)[number];

export const ATTENTION_IMPORTANCES = ["high", "medium", "low"] as const;

export type AttentionImportance = (typeof ATTENTION_IMPORTANCES)[number];

export const ATTENTION_AUDIENCES = [
  "urgent-founder-action",
  "founder-action",
  "watch",
  "fyi",
  "delegate",
] as const;

export type AttentionAudience = (typeof ATTENTION_AUDIENCES)[number];

export const ATTENTION_CONFIDENCES = ["high", "medium", "low"] as const;

export type AttentionConfidence = (typeof ATTENTION_CONFIDENCES)[number];

export const ATTENTION_EPISTEMIC_CLASSES = [
  "observed",
  "derived",
  "inferred",
  "recommendation",
] as const;

export type AttentionEpistemicClass = (typeof ATTENTION_EPISTEMIC_CLASSES)[number];

export const ATTENTION_STATUSES = [
  "new",
  "seen",
  "acknowledged",
  "snoozed",
  "resolved",
  "expired",
] as const;

export type AttentionStatus = (typeof ATTENTION_STATUSES)[number];

export const OBSERVATION_CHANGE_CLASSES = [
  "novel",
  "unchanged",
  "worsened",
] as const;

export type ObservationChangeClass = (typeof OBSERVATION_CHANGE_CLASSES)[number];

export const SPECIALIST_IDS = [
  "founder-focus",
  "client-memory",
  "client-attention",
  "website-qa",
  "concierge-sla",
  "gmail",
  "calendar",
  "search",
  "content",
  "opportunity",
  "plaud",
  "remarkable",
] as const;

export type SpecialistId = (typeof SPECIALIST_IDS)[number];

export type SpecialistObservationSubject = {
  personId?: string;
  projectId?: string;
  focusId?: string;
};

/**
 * Provider-neutral specialist input. Specialists suggest; CoS decides.
 * Not a database table in Phase 1A.
 */
export type SpecialistObservation = {
  specialist: SpecialistId;
  kind: string;
  subject: SpecialistObservationSubject;
  summary: string;
  whyItMatters?: string;
  recommendedAction?: string;
  epistemicClass: AttentionEpistemicClass;
  importanceHint: AttentionImportance;
  urgencyHint: AttentionUrgency;
  audienceHint: AttentionAudience;
  confidence: AttentionConfidence;
  evidenceIds: string[];
  observationIds: string[];
  observedAt: string;
  expiresAt?: string;
  dedupeKey: string;
  changeClass: ObservationChangeClass;
};

export type AttentionItem = {
  id: string;
  dedupeKey: string;
  kind: AttentionKind;
  headline: string;
  whyItMatters: string;
  recommendedAction: string;
  urgency: AttentionUrgency;
  importance: AttentionImportance;
  audience: AttentionAudience;
  confidence: AttentionConfidence;
  epistemicClass: AttentionEpistemicClass;
  personId?: string;
  projectId?: string;
  observationIds: string[];
  evidenceIds: string[];
  dueAt?: string;
  status: AttentionStatus;
  snoozedUntil?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
  reasonCodes: string[];
};

export type WorthKnowingItem = {
  headline: string;
  personId?: string;
  projectId?: string;
  reasonCodes?: string[];
};

export type ChiefOfStaffBrief = {
  id: string;
  localDate: string;
  generatedAt: string;
  attentionItemIds: string[];
  worthKnowing: WorthKnowingItem[];
  silenceReason?: string;
};

export type ChiefOfStaffCommandCenterItem = {
  id: string;
  headline: string;
  why: string;
  href?: string;
};

export type ChiefOfStaffCommandCenterView = {
  status: "quiet" | "active";
  heading: string;
  items: ChiefOfStaffCommandCenterItem[];
  worthKnowing: WorthKnowingItem[];
};

export type ChiefOfStaffEmailView = {
  subject: string;
  text: string;
};
