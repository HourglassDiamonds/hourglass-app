/**
 * Founder-facing Human Intake candidate labels and summaries.
 * Shows evidenceBasis, not hidden reasoning.
 */

import type { CandidateReadModel } from "@/lib/continuum/candidates/present";
import { presentCandidate } from "@/lib/continuum/candidates/present";
import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type {
  CandidateReviewStatus,
  CandidateType,
  ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { PROJECT_SPEC_FIELD_LABELS } from "@/lib/continuum/client-memory/project-spec/types";

export const HUMAN_INTAKE_CANDIDATE_TYPE_LABELS: Record<CandidateType, string> = {
  person_association: "Possible person",
  project_association: "Possible project",
  project_context: "Project context",
  note: "Note",
  structured_spec: "Project spec",
  open_job: "Possible Open Job",
  date: "Date",
  follow_up: "Follow-up",
};

export const HUMAN_INTAKE_REVIEW_LABELS: Record<CandidateReviewStatus, string> = {
  pending: "Needs review",
  approved: "Approved",
  discarded: "Discarded",
  deferred: "Later",
};

export function humanIntakeCandidateTypeLabel(type: CandidateType): string {
  return HUMAN_INTAKE_CANDIDATE_TYPE_LABELS[type];
}

export function humanIntakeReviewLabel(status: CandidateReviewStatus): string {
  return HUMAN_INTAKE_REVIEW_LABELS[status];
}

export function humanIntakeProposedSummary(row: ContinuumCandidate): string {
  const payload = effectiveCandidatePayload(row);
  switch (payload.kind) {
    case "person_association":
      return payload.displayName ?? "Unknown person";
    case "project_association":
      return payload.token ? `${payload.title} (${payload.token})` : payload.title ?? "Project";
    case "project_context":
      return `${payload.topic}: ${payload.value}`;
    case "note":
      return payload.text;
    case "structured_spec":
      return `${PROJECT_SPEC_FIELD_LABELS[payload.fieldName]}: ${payload.proposedValue}`;
    case "open_job":
      return `${payload.jobKind}: ${payload.subject}`;
    case "date":
      return payload.isoDate ?? payload.raw;
    case "follow_up":
      return payload.text;
  }
}

export function presentHumanIntakeCandidate(row: ContinuumCandidate): CandidateReadModel & {
  summary: string;
  effectivePayload: ContinuumCandidate["payload"];
  effectiveTarget: ContinuumCandidate["proposedTarget"];
} {
  return {
    ...presentCandidate(row),
    summary: humanIntakeProposedSummary(row),
    effectivePayload: effectiveCandidatePayload(row),
    effectiveTarget: effectiveCandidateTarget(row),
  };
}
