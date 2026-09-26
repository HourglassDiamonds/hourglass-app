/**
 * Project Book V1 read model.
 * SOURCE EVENT → existing interpretation → existing work-loop reducer → this view.
 * Not a fifth truth store. Not a task engine. Not Today.
 */

import type {
  SourceCommunicationActor,
  SourceCommunicationDirection,
  SourceCommunicationEventClass,
} from "@/lib/continuum/source-events/types";
import type { WorkLoopSemanticClass } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";

export const PROJECT_BOOK_SOURCE_TYPES = [
  "gmail",
  "sms",
  "calendar",
  "plaud",
  "founder_note",
  "artifact",
  "concierge_form",
] as const;

export type ProjectBookSourceType = (typeof PROJECT_BOOK_SOURCE_TYPES)[number];

export const PROJECT_BOOK_FUTURE_SOURCE_TYPES = [
  "sms",
  "calendar",
  "plaud",
  "founder_note",
  "artifact",
  "concierge_form",
] as const satisfies readonly ProjectBookSourceType[];

export type ProjectBookAssociation = "exact" | "unassigned" | "ambiguous";

export type ProjectBookInterpretation = "interpreted" | "source_only" | "needs_review";

/**
 * Source-agnostic input. Gmail maps into this shape.
 * Future channels map here without changing the projector.
 * Quoted thread history is not a field.
 */
export type ProjectBookSourceRecord = {
  sourceType: ProjectBookSourceType;
  sourceRef: string;
  timestamp: string;
  actor: SourceCommunicationActor;
  direction: SourceCommunicationDirection | null;
  semanticClass: SourceCommunicationEventClass | null;
  subject: string | null;
  authorOwnedText: string;
  attachmentFilenames: readonly string[];
  personLabel: string | null;
  projectId: string | null;
  association: ProjectBookAssociation;
  plausibleProjectIds: readonly string[];
  cadIds: readonly string[];
  provenance: string;
};

export type ProjectBookEvidence = {
  channel: string;
  timestamp: string;
  subject: string | null;
  attachmentNames: readonly string[];
  classification: string;
  interpretation: ProjectBookInterpretation;
};

export type ProjectBookMilestone = {
  timestamp: string;
  semanticClass: SourceCommunicationEventClass;
  label: string;
  summary: string;
  actor: SourceCommunicationActor;
  sourceRefs: readonly string[];
  evidence: readonly ProjectBookEvidence[];
  attachmentLabels: readonly string[];
  personLabel: string | null;
};

export type ProjectBookTimelineEntry = {
  timestamp: string;
  sourceType: ProjectBookSourceType;
  actor: SourceCommunicationActor;
  direction: SourceCommunicationDirection | null;
  semanticClass: SourceCommunicationEventClass | null;
  summary: string;
  excerpt: string | null;
  sourceRefs: readonly string[];
  evidence: ProjectBookEvidence;
  attachmentLabels: readonly string[];
  personLabel: string | null;
  milestone: boolean;
};

export type ProjectBookUnresolved = {
  holder: "founder" | "client" | "vendor_shop";
  label: string;
};

export type ProjectBookCurrentState = {
  semanticClass: WorkLoopSemanticClass;
  headline: string;
  lastMeaningfulChange: {
    label: string;
    summary: string;
    timestamp: string;
  } | null;
  nextCheckpoint: {
    summary: string;
    basis: "work_loop";
  } | null;
};

export type ProjectBookSourceCoverage = {
  represented: readonly ProjectBookSourceType[];
  future: readonly ProjectBookSourceType[];
};

export type ProjectBookAssociationReview = {
  status: "needs_review";
  summary: string;
  count: number;
};

export type ProjectBookRead = {
  projectId: string;
  projectLabel: string;
  currentState: ProjectBookCurrentState;
  milestones: readonly ProjectBookMilestone[];
  evidenceTimeline: readonly ProjectBookTimelineEntry[];
  evidenceOmittedCount: number;
  unresolved: readonly ProjectBookUnresolved[];
  sourceCoverage: ProjectBookSourceCoverage;
  associationReview: ProjectBookAssociationReview | null;
  generatedAt: string;
};

export const PROJECT_BOOK_TIMELINE_LIMIT = 200;
export const PROJECT_BOOK_MILESTONE_LIMIT = 80;
