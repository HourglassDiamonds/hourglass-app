/**
 * Founder-facing Project Book copy and the client view model.
 * Strips source refs and keeps conclusions in front.
 */

import { civilDateInZone, formatDateOnlyShort } from "@/lib/continuum/date-only";
import { meaningfulAttachmentNames, safeFounderCopy } from "./admit";
import type {
  ProjectBookEvidence,
  ProjectBookRead,
  ProjectBookSourceType,
} from "./types";

export type ProjectBookViewEvidence = {
  channel: string;
  displayDate: string;
  subject: string | null;
  attachmentNames: readonly string[];
  classification: string;
  interpretation: ProjectBookEvidence["interpretation"];
};

export type ProjectBookViewMilestone = {
  displayDate: string;
  label: string;
  summary: string;
  actor: ProjectBookRead["milestones"][number]["actor"];
  attachmentLabels: readonly string[];
  evidence: readonly ProjectBookViewEvidence[];
};

export type ProjectBookViewEntry = {
  displayDate: string;
  summary: string;
  excerpt: string | null;
  actor: ProjectBookRead["evidenceTimeline"][number]["actor"];
  attachmentLabels: readonly string[];
  milestone: boolean;
  evidence: ProjectBookViewEvidence;
};

export type ProjectBookView = {
  projectId: string;
  projectLabel: string;
  currentState: {
    headline: string;
    lastMeaningfulChange: {
      label: string;
      summary: string;
      displayDate: string;
    } | null;
    nextCheckpoint: {
      summary: string;
      basisLabel: string;
    } | null;
  };
  unresolved: ProjectBookRead["unresolved"];
  milestones: readonly ProjectBookViewMilestone[];
  evidenceTimeline: readonly ProjectBookViewEntry[];
  evidenceOmittedCount: number;
  representedLabels: readonly string[];
  futureLabels: readonly string[];
  associationReview: ProjectBookRead["associationReview"];
  historyState: ProjectBookRead["historyState"];
  empty: boolean;
};

const FUTURE_LABEL: Record<ProjectBookSourceType, string> = {
  gmail: "Gmail",
  sms: "SMS",
  calendar: "Calendar",
  plaud: "PLAUD",
  founder_note: "Notes",
  artifact: "Artifacts",
  concierge_form: "Concierge forms",
};

function classificationLabel(value: string): string {
  switch (value) {
    case "client_requests":
      return "Client request";
    case "client_approves":
      return "Client approved";
    case "founder_fulfills_commitment":
      return "Founder fulfillment";
    case "founder_requests_vendor":
      return "Sent to shop";
    case "founder_updates_client":
      return "Client follow-up";
    case "vendor_promises":
      return "Shop promise";
    case "vendor_delivers_artifact":
      return "Shop delivered";
    case "vendor_order_confirmation":
      return "Order confirmation";
    case "workshop_started":
      return "Workshop started";
    case "client_replies_nonblocking":
      return "Client reply";
    case "vendor_acknowledges":
      return "Shop acknowledgement";
    default:
      return "Source note";
  }
}

export function projectBookDisplayDate(timestamp: string): string {
  const day = civilDateInZone(timestamp);
  if (!day) return "Date unknown";
  return formatDateOnlyShort(day);
}

function viewEvidence(evidence: ProjectBookEvidence): ProjectBookViewEvidence {
  return {
    channel: evidence.channel,
    displayDate: projectBookDisplayDate(evidence.timestamp),
    subject: safeFounderCopy(evidence.subject),
    attachmentNames: meaningfulAttachmentNames(evidence.attachmentNames),
    classification: classificationLabel(evidence.classification),
    interpretation: evidence.interpretation,
  };
}

export function presentProjectBook(book: ProjectBookRead): ProjectBookView {
  return {
    projectId: book.projectId,
    projectLabel: book.projectLabel,
    currentState: {
      headline: book.currentState.headline,
      lastMeaningfulChange: book.currentState.lastMeaningfulChange
        ? {
            label: book.currentState.lastMeaningfulChange.label,
            summary: safeFounderCopy(book.currentState.lastMeaningfulChange.summary) ?? book.currentState.lastMeaningfulChange.label,
            displayDate: projectBookDisplayDate(book.currentState.lastMeaningfulChange.timestamp),
          }
        : null,
      nextCheckpoint: book.currentState.nextCheckpoint
        ? {
            summary: book.currentState.nextCheckpoint.summary,
            basisLabel: "From current work-loop state",
          }
        : null,
    },
    unresolved: book.unresolved,
    milestones: book.milestones.map((row) => ({
      displayDate: projectBookDisplayDate(row.timestamp),
      label: row.label,
      summary: safeFounderCopy(row.summary) ?? row.label,
      actor: row.actor,
      attachmentLabels: row.attachmentLabels,
      evidence: row.evidence.map(viewEvidence),
    })),
    evidenceTimeline: book.evidenceTimeline.map((row) => ({
      displayDate: projectBookDisplayDate(row.timestamp),
      summary: safeFounderCopy(row.summary) ?? "Source note",
      excerpt: safeFounderCopy(row.excerpt),
      actor: row.actor,
      attachmentLabels: row.attachmentLabels,
      milestone: row.milestone,
      evidence: viewEvidence(row.evidence),
    })),
    evidenceOmittedCount: book.evidenceOmittedCount,
    representedLabels: book.sourceCoverage.represented.map((sourceType) => FUTURE_LABEL[sourceType]),
    futureLabels: book.sourceCoverage.future.map((sourceType) => FUTURE_LABEL[sourceType]),
    associationReview: book.associationReview,
    historyState: book.historyState,
    empty: book.historyState === "none",
  };
}
