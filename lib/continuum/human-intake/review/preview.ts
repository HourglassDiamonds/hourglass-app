/**
 * Founder-facing apply preview. States what approval will do.
 * Does not write. Candidate ≠ truth until approve.
 */

import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { PROJECT_SPEC_FIELD_LABELS } from "@/lib/continuum/client-memory/project-spec/types";
import { humanIntakeProposedSummary } from "../candidates/present";
import { sourceIdFromCandidateSourceRef } from "../candidates/source-ref";

export type HumanIntakeApplyKind =
  | "source_note"
  | "project_job"
  | "source_link"
  | "project_spec"
  | "none";

export type HumanIntakeApplyPreview = {
  summary: string;
  canApply: boolean;
  blockers: string[];
  applyKind: HumanIntakeApplyKind;
  currentValue: string | null;
  proposedValue: string | null;
  conflict: boolean;
};

export type HumanIntakeCandidateReviewView = {
  candidateId: string;
  candidateType: ContinuumCandidate["candidateType"];
  candidateState: ContinuumCandidate["candidateState"];
  reviewStatus: ContinuumCandidate["reviewStatus"];
  lastReviewAction: ContinuumCandidate["lastReviewAction"];
  confidence: ContinuumCandidate["confidence"];
  sourceRef: string;
  sourceSystem: ContinuumCandidate["sourceSystem"];
  summary: string;
  evidenceRuleIds: readonly string[];
  matchedText: string | null;
  preview: HumanIntakeApplyPreview;
  personName: string | null;
  projectTitle: string | null;
  mutationId: string;
  payload: ContinuumCandidate["payload"];
  proposedTarget: ContinuumCandidate["proposedTarget"];
  suggestedPersonId: string | null;
  suggestedProjectId: string | null;
};

export type HumanIntakePreviewContext = {
  candidate: ContinuumCandidate;
  personName: string | null;
  projectTitle: string | null;
  personOnProject: boolean | null;
};

export function sourceIdOfCandidate(row: ContinuumCandidate): string | null {
  return sourceIdFromCandidateSourceRef(row.sourceRef);
}

export function previewHumanIntakeCandidateApply(
  ctx: HumanIntakePreviewContext,
): HumanIntakeApplyPreview {
  const { candidate } = ctx;
  const payload = effectiveCandidatePayload(candidate);
  const target = effectiveCandidateTarget(candidate);
  const personLabel = ctx.personName ?? "the selected person";
  const projectLabel = ctx.projectTitle ?? "the selected project";

  if (candidate.reviewStatus === "approved") {
    return {
      summary: "Already approved. Nothing more will be written.",
      canApply: false,
      blockers: ["already-approved"],
      applyKind: "none",
      currentValue: payload.kind === "structured_spec" ? payload.currentValue : null,
      proposedValue: payload.kind === "structured_spec" ? payload.proposedValue : null,
      conflict: payload.kind === "structured_spec" ? payload.conflict : false,
    };
  }
  if (candidate.reviewStatus === "discarded") {
    return {
      summary: "Discarded. Approval will not write memory.",
      canApply: false,
      blockers: ["discarded"],
      applyKind: "none",
      currentValue: null,
      proposedValue: null,
      conflict: false,
    };
  }

  if (payload.kind === "person_association") {
    const personId = target.kind === "person" ? target.personId : null;
    if (!personId) {
      return {
        summary:
          "Approve would associate this source with an existing Person. Choose a known Person first. Continuum will not mint a Person from this transcript. Name or email is not identity proof.",
        canApply: false,
        blockers: ["person-required"],
        applyKind: "source_link",
        currentValue: null,
        proposedValue: payload.displayName,
        conflict: false,
      };
    }
    return {
      summary: `Approve will confirm this source is associated with ${personLabel}. No Person will be created. Name or email in the transcript is not identity proof.`,
      canApply: true,
      blockers: [],
      applyKind: "source_link",
      currentValue: null,
      proposedValue: payload.displayName,
      conflict: false,
    };
  }

  if (payload.kind === "project_association") {
    const projectId = target.kind === "project" ? target.projectId : null;
    if (!projectId) {
      return {
        summary:
          "Approve would associate this source with an existing Project. Choose a known Project first.",
        canApply: false,
        blockers: ["project-required"],
        applyKind: "source_link",
        currentValue: null,
        proposedValue: payload.title,
        conflict: false,
      };
    }
    return {
      summary: `Approve will confirm this source is associated with ${projectLabel}. No Project will be created.`,
      canApply: true,
      blockers: [],
      applyKind: "source_link",
      currentValue: null,
      proposedValue: payload.title,
      conflict: false,
    };
  }

  if (payload.kind === "note") {
    const personId = target.kind === "person" ? target.personId : null;
    const projectId = target.kind === "project" ? target.projectId : null;
    if (!personId) {
      return {
        summary:
          "Approve would save a kept note. Choose an existing Person first. Continuum will not mint a Person.",
        canApply: false,
        blockers: ["person-required"],
        applyKind: "source_note",
        currentValue: null,
        proposedValue: payload.text,
        conflict: false,
      };
    }
    return {
      summary: `Approve will save a kept note on ${personLabel}${projectId ? ` / ${projectLabel}` : ""}. It will not write kernel observations or Facts.`,
      canApply: true,
      blockers: [],
      applyKind: "source_note",
      currentValue: null,
      proposedValue: payload.text,
      conflict: false,
    };
  }

  if (payload.kind === "structured_spec") {
    const projectId = target.kind === "project_spec" ? target.projectId : null;
    const field = PROJECT_SPEC_FIELD_LABELS[payload.fieldName];
    if (!projectId) {
      return {
        summary: `Approve would set ${field} on a Project. Choose a known Project first. Continuum will not move this onto a Person.`,
        canApply: false,
        blockers: ["project-required"],
        applyKind: "project_spec",
        currentValue: payload.currentValue,
        proposedValue: payload.proposedValue,
        conflict: payload.conflict,
      };
    }
    const conflictLine = payload.conflict
      ? ` Current canonical value is “${payload.currentValue ?? ""}”. Proposed value is “${payload.proposedValue}”. Approving will overwrite the current value using the Project spec writer.`
      : ` There is no current conflict. Approving will set ${field} to “${payload.proposedValue}” using the Project spec writer.`;
    return {
      summary: `Approve will change ${field} on ${projectLabel}.${conflictLine} It will not silently overwrite without this explicit approval.`,
      canApply: true,
      blockers: [],
      applyKind: "project_spec",
      currentValue: payload.currentValue,
      proposedValue: payload.proposedValue,
      conflict: payload.conflict,
    };
  }

  if (payload.kind === "open_job") {
    const projectId = target.kind === "open_job" ? target.projectId : null;
    if (!projectId) {
      return {
        summary:
          "Approve would create a Project-local Open Job. Choose a known Project first. Continuum will not create a second job contract. The candidate remains createJob:false until this explicit approval.",
        canApply: false,
        blockers: ["project-required"],
        applyKind: "project_job",
        currentValue: null,
        proposedValue: payload.subject,
        conflict: false,
      };
    }
    if (ctx.personOnProject === false) {
      return {
        summary:
          "Approve would create an Open Job, but that person is not linked to this project. Continuum will not mint a Person or invent a relationship.",
        canApply: false,
        blockers: ["person-not-on-project"],
        applyKind: "project_job",
        currentValue: null,
        proposedValue: payload.subject,
        conflict: false,
      };
    }
    return {
      summary: `Approve will create an Open Job (${payload.jobKind}) on ${projectLabel}${ctx.personName ? ` linked to ${personLabel}` : ""}. The candidate stays createJob:false; only this explicit approval writes the job.`,
      canApply: true,
      blockers: [],
      applyKind: "project_job",
      currentValue: null,
      proposedValue: payload.subject,
      conflict: false,
    };
  }

  return {
    summary: `Approve records your decision on this ${payload.kind.replace(/_/g, " ")} (${humanIntakeProposedSummary(candidate)}). Continuum has no authorized canonical writer for this type, so nothing else will be written.`,
    canApply: true,
    blockers: [],
    applyKind: "none",
    currentValue: null,
    proposedValue: humanIntakeProposedSummary(candidate),
    conflict: false,
  };
}
