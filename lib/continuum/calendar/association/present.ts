/**
 * Shared founder-review views for Calendar association Candidates.
 * Reuses the #19 review surface. No Calendar-specific inbox.
 */

import { candidateReviewMutationId } from "@/lib/continuum/candidates/identity";
import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { humanIntakeProposedSummary } from "@/lib/continuum/human-intake/candidates/present";
import type { HumanIntakeCandidateReviewView } from "@/lib/continuum/human-intake/review/preview";
import { previewCalendarAssociationApply } from "./preview";

function personIdOf(row: ContinuumCandidate): string | null {
  const target = effectiveCandidateTarget(row);
  return target.kind === "person" ? target.personId : null;
}

function projectIdOf(row: ContinuumCandidate): string | null {
  const target = effectiveCandidateTarget(row);
  return target.kind === "project" ? target.projectId : null;
}

export function presentCalendarAssociationReviewViews(input: {
  candidates: readonly ContinuumCandidate[];
  personNames: ReadonlyMap<string, string>;
  projectTitles: ReadonlyMap<string, string>;
}): HumanIntakeCandidateReviewView[] {
  return input.candidates.map((row) => {
    const personId = personIdOf(row);
    const projectId = projectIdOf(row);
    const preview = previewCalendarAssociationApply({
      candidate: row,
      personName: personId ? input.personNames.get(personId) ?? null : null,
      projectTitle: projectId ? input.projectTitles.get(projectId) ?? null : null,
    });
    return {
      candidateId: row.candidateId,
      candidateType: row.candidateType,
      candidateState: row.candidateState,
      reviewStatus: row.reviewStatus,
      lastReviewAction: row.lastReviewAction,
      confidence: row.confidence,
      sourceRef: row.sourceRef,
      sourceSystem: row.sourceSystem,
      summary: humanIntakeProposedSummary(row),
      evidenceRuleIds: row.evidenceBasis.ruleIds,
      matchedText: row.evidenceBasis.matchedText,
      preview,
      personName: personId ? input.personNames.get(personId) ?? null : null,
      projectTitle: projectId ? input.projectTitles.get(projectId) ?? null : null,
      mutationId: candidateReviewMutationId(row),
      payload: effectiveCandidatePayload(row),
      proposedTarget: effectiveCandidateTarget(row),
      suggestedPersonId: personId,
      suggestedProjectId: projectId,
    };
  });
}
