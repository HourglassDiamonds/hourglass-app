/**
 * #23 Calendar association world and analysis contracts.
 * Consumes frozen #22 CalendarEventEvidence. Does not mutate it.
 * Email is supporting evidence only. Never identity by itself.
 */

import type { CalendarEventEvidence } from "../types";

export const CALENDAR_ASSOCIATION_PARSER =
  "google-calendar-association-deterministic-v1" as const;

export type CalendarAssociationPerson = {
  personId: string;
  displayName: string;
  emailHash: string | null;
  projectIds: readonly string[];
};

export type CalendarAssociationProject = {
  projectId: string;
  title: string;
  cadJobNumber: string | null;
  orderNumber: string | null;
  personIds: readonly string[];
  founderApprovedCurrent: boolean;
};

export type CalendarConfirmedSourceLink = {
  sourceRef: string;
  calendarId: string;
  calendarEventId: string;
  entityId: string;
  entityKind: "person" | "project";
  participantEmailHash: string | null;
};

export type CalendarConfirmedParticipantMapping = {
  emailHash: string;
  personId: string;
};

export type CalendarAssociationWorld = {
  people: readonly CalendarAssociationPerson[];
  projects: readonly CalendarAssociationProject[];
  confirmedLinks: readonly CalendarConfirmedSourceLink[];
  confirmedParticipantMappings: readonly CalendarConfirmedParticipantMapping[];
  internalEmailHashes: readonly string[];
};

export type CalendarPersonAssociationHit = {
  personId: string | null;
  displayName: string | null;
  emailHash: string | null;
  mintPerson: false;
  mergePersons: false;
  ambiguous: boolean;
  confidence: "high" | "medium" | "low" | "ambiguous";
  ruleIds: readonly string[];
  matchedText: string | null;
};

export type CalendarProjectAssociationHit = {
  projectId: string;
  title: string | null;
  token: string | null;
  match: "exact" | "ambiguous";
  ruleIds: readonly string[];
  matchedText: string | null;
};

export type CalendarAssociationAnalysis = {
  evidence: CalendarEventEvidence;
  sourceRef: string | null;
  personHits: readonly CalendarPersonAssociationHit[];
  projectHits: readonly CalendarProjectAssociationHit[];
  skipped: boolean;
  skipReason: "cancelled" | "identity-too-long" | null;
};
