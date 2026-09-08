/**
 * Founder-facing apply preview for Calendar association Candidates.
 * Approval writes a Calendar source link only. Email is not identity.
 */

import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { humanIntakeProposedSummary } from "@/lib/continuum/human-intake/candidates/present";
import type { HumanIntakeApplyPreview } from "@/lib/continuum/human-intake/review/preview";

export type CalendarAssociationPreviewContext = {
  candidate: ContinuumCandidate;
  personName: string | null;
  projectTitle: string | null;
};

export function previewCalendarAssociationApply(
  ctx: CalendarAssociationPreviewContext,
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
      applyKind: "source_link",
      currentValue: null,
      proposedValue: null,
      conflict: false,
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
          "Approve would associate this Calendar event with an existing Person. Choose a known Person first. Continuum will not mint a Person. Email is supporting evidence only, never identity.",
        canApply: false,
        blockers: ["person-required"],
        applyKind: "source_link",
        currentValue: null,
        proposedValue: payload.displayName,
        conflict: false,
      };
    }
    return {
      summary: `Approve will confirm this Calendar event is associated with ${personLabel}. No Person will be created or merged. Email is not identity.`,
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
          "Approve would associate this Calendar event with an existing Project. Choose a known Project first. Continuum will not create a Project, Open Job, or change Kind or lifecycle.",
        canApply: false,
        blockers: ["project-required"],
        applyKind: "source_link",
        currentValue: null,
        proposedValue: payload.title,
        conflict: false,
      };
    }
    return {
      summary: `Approve will confirm this Calendar event is associated with ${projectLabel}. No Project will be created. Kind, lifecycle, and Open Jobs will not change.`,
      canApply: true,
      blockers: [],
      applyKind: "source_link",
      currentValue: null,
      proposedValue: payload.title,
      conflict: false,
    };
  }

  return {
    summary: `Approve records your decision on this ${payload.kind.replace(/_/g, " ")} (${humanIntakeProposedSummary(candidate)}). Calendar association has no authorized writer for this type, so nothing else will be written.`,
    canApply: true,
    blockers: [],
    applyKind: "none",
    currentValue: null,
    proposedValue: humanIntakeProposedSummary(candidate),
    conflict: false,
  };
}
