import { createHash } from "node:crypto";
import type { SterlingTodayProposal, SterlingTodayWorkingSet } from "./types";

export type SterlingEvidenceHandleMap = {
  requestWorkingSet: SterlingTodayWorkingSet;
  evidenceIdToHandle: ReadonlyMap<string, string>;
  handleToEvidenceId: ReadonlyMap<string, string>;
};

/** Give the model short request-local citations while retaining source IDs only in trusted code. */
export function createSterlingEvidenceHandleMap(workingSet: SterlingTodayWorkingSet): SterlingEvidenceHandleMap {
  const evidenceIdToHandle = new Map<string, string>();
  const handleToEvidenceId = new Map<string, string>();
  const orderedEvidenceIds = [...workingSet.evidence].map(row => row.evidenceId).sort();
  orderedEvidenceIds.forEach((evidenceId, index) => {
    const handle = `E${String(index + 1).padStart(4, "0")}`;
    evidenceIdToHandle.set(evidenceId, handle);
    handleToEvidenceId.set(handle, evidenceId);
  });
  const handle = (evidenceId: string): string => {
    const value = evidenceIdToHandle.get(evidenceId);
    if (!value) throw new Error("sterling-today-evidence-handle-missing");
    return value;
  };

  return {
    requestWorkingSet: {
      ...workingSet,
      evidence: workingSet.evidence.map(row => ({ ...row, evidenceId: handle(row.evidenceId) })),
      workUnits: workingSet.workUnits.map(row => ({ ...row, evidenceRefs: row.evidenceRefs.map(handle) })),
      calendar: workingSet.calendar.map(row => ({ ...row, evidenceId: handle(row.evidenceId) })),
    },
    evidenceIdToHandle,
    handleToEvidenceId,
  };
}

/** Resolve known model citations; replace every unknown value with a safe token that provenance validation rejects. */
export function resolveSterlingEvidenceHandles(
  proposal: SterlingTodayProposal,
  handleToEvidenceId: ReadonlyMap<string, string>,
): SterlingTodayProposal {
  const resolve = (ref: string): string => handleToEvidenceId.get(ref) ??
    `invalid-evidence-handle:${createHash("sha256").update(ref).digest("hex").slice(0, 16)}`;
  const resolveRefs = (refs: readonly string[]): string[] => refs.map(resolve);
  const resolveObligations = (obligations: SterlingTodayProposal["portfolioAssessments"][number]["obligations"]) =>
    obligations.map(obligation => ({ ...obligation, evidenceRefs: resolveRefs(obligation.evidenceRefs) }));

  return {
    ...proposal,
    portfolioAssessments: proposal.portfolioAssessments.map(assessment => ({
      ...assessment,
      currentStage: { ...assessment.currentStage, evidenceRefs: resolveRefs(assessment.currentStage.evidenceRefs) },
      obligations: resolveObligations(assessment.obligations),
      evidenceRefs: resolveRefs(assessment.evidenceRefs),
    })),
    recommendations: proposal.recommendations.map(recommendation => ({
      ...recommendation,
      obligations: resolveObligations(recommendation.obligations),
      evidenceRefs: resolveRefs(recommendation.evidenceRefs),
    })),
    relationshipProposals: proposal.relationshipProposals.map(relationship => ({
      ...relationship,
      evidenceRefs: resolveRefs(relationship.evidenceRefs),
    })),
    proposedCanonicalMutations: proposal.proposedCanonicalMutations.map(mutation => ({
      ...mutation,
      evidenceRefs: resolveRefs(mutation.evidenceRefs),
    })),
  };
}
