/**
 * Founder-facing Project Book copy and the client view model.
 * Strips source refs and keeps conclusions in front.
 */

import { civilDateInZone, formatDateOnlyShort } from "@/lib/continuum/date-only";
import {
  meaningfulAttachmentNames,
  normalizedSubject,
  PROJECT_FILE_RECEIVED,
  safeFounderCopy,
} from "./admit";
import type { ProjectEvidenceReview } from "@/lib/continuum/project-evidence/types";
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

export type ProjectBookEvidenceReviewItem = {
  reviewKey: string;
  channel: "Gmail";
  dateLabel: string;
  subject: string | null;
  attachmentNames: readonly string[];
  reason: string;
  possibleMatches: readonly string[];
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
  evidenceReview: {
    possible: {
      heading: string;
      summary: string;
      items: readonly ProjectBookEvidenceReviewItem[];
    } | null;
    ambiguous: {
      heading: string;
      summary: string;
      items: readonly ProjectBookEvidenceReviewItem[];
    } | null;
  } | null;
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

function classificationLabel(value: string, summary: string): string {
  if (summary === PROJECT_FILE_RECEIVED) return "Project file";
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
    default:
      return "Project file";
  }
}

export function projectBookDisplayDate(timestamp: string): string {
  const day = civilDateInZone(timestamp);
  if (!day) return "Date unknown";
  return formatDateOnlyShort(day);
}

function viewEvidence(
  evidence: ProjectBookEvidence,
  summary: string,
): ProjectBookViewEvidence {
  return {
    channel: evidence.channel,
    displayDate: projectBookDisplayDate(evidence.timestamp),
    subject: normalizedSubject(evidence.subject),
    attachmentNames: meaningfulAttachmentNames(evidence.attachmentNames),
    classification: classificationLabel(evidence.classification, summary),
    interpretation: evidence.interpretation,
  };
}

function reviewDateLabel(earliest: string | null, latest: string | null): string {
  const start = earliest ? projectBookDisplayDate(earliest) : null;
  const end = latest ? projectBookDisplayDate(latest) : null;
  if (start && end && start !== end) return `${start} – ${end}`;
  return start ?? end ?? "Date unknown";
}

function presentReview(
  review: ProjectEvidenceReview | null,
): ProjectBookView["evidenceReview"] {
  if (!review) return null;
  const items = (rows: ProjectEvidenceReview["possible"]) =>
    rows.map((row) => ({
      reviewKey: row.reviewKey,
      channel: row.channel,
      dateLabel: reviewDateLabel(row.earliest, row.latest),
      subject: normalizedSubject(row.subject),
      attachmentNames: meaningfulAttachmentNames(row.attachmentNames).slice(0, 8),
      reason: safeFounderCopy(row.reason) ?? "Possible project evidence.",
      possibleMatches: row.possibleMatches
        .map((match) => safeFounderCopy(match))
        .filter((match): match is string => Boolean(match))
        .slice(0, 6),
    }));
  const possible = items(review.possible);
  const ambiguous = items(review.ambiguous);
  if (possible.length === 0 && ambiguous.length === 0) return null;
  return {
    possible:
      possible.length === 0
        ? null
        : {
            heading: "Possible project evidence",
            summary: `${possible.length} Gmail ${possible.length === 1 ? "thread" : "threads"} may belong to this project.`,
            items: possible,
          },
    ambiguous:
      ambiguous.length === 0
        ? null
        : {
            heading: "Project evidence needs review",
            summary: "Possible matches are listed below. No project is selected automatically.",
            items: ambiguous,
          },
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
      evidence: row.evidence.map((item) => viewEvidence(item, row.summary)),
    })),
    evidenceTimeline: book.evidenceTimeline.map((row) => ({
      displayDate: projectBookDisplayDate(row.timestamp),
      summary: safeFounderCopy(row.summary) ?? row.summary,
      excerpt: null,
      actor: row.actor,
      attachmentLabels: row.attachmentLabels,
      milestone: row.milestone,
      evidence: viewEvidence(row.evidence, row.summary),
    })),
    evidenceOmittedCount: book.evidenceOmittedCount,
    representedLabels: book.sourceCoverage.represented.map((sourceType) => FUTURE_LABEL[sourceType]),
    futureLabels: book.sourceCoverage.future.map((sourceType) => FUTURE_LABEL[sourceType]),
    associationReview: book.associationReview,
    evidenceReview: presentReview(book.evidenceReview),
    historyState: book.historyState,
    empty: book.historyState === "none",
  };
}
