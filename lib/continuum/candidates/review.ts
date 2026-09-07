/**
 * Founder review actions for #19.
 * Does not write canonical Person/Project/spec/job state.
 * Does not change candidate_state (conflict remains conflict).
 * Edit is an action: it records edited payload/target plus audit provenance.
 */

import type {
  ContinuumCandidate,
  FounderReviewInput,
  ProposedCanonicalTarget,
} from "./types";

export function applyFounderReview(
  row: ContinuumCandidate,
  input: FounderReviewInput,
  reviewedAt: string,
): ContinuumCandidate {
  const at = reviewedAt.trim() || row.reviewedAt || row.createdAt;
  if (input.action === "edit") {
    return {
      ...row,
      canonical: false,
      automaticApply: false,
      founderEditedPayload: input.payload,
      founderEditedTarget: input.proposedTarget ?? row.founderEditedTarget,
      lastReviewAction: "edit",
      reviewedAt: at,
    };
  }
  if (input.action === "approve") {
    return {
      ...row,
      canonical: false,
      automaticApply: false,
      reviewStatus: "approved",
      lastReviewAction: "approve",
      founderEditedPayload: input.payload ?? row.founderEditedPayload,
      reviewedAt: at,
    };
  }
  if (input.action === "discard") {
    return {
      ...row,
      canonical: false,
      automaticApply: false,
      reviewStatus: "discarded",
      lastReviewAction: "discard",
      reviewedAt: at,
    };
  }
  return {
    ...row,
    canonical: false,
    automaticApply: false,
    reviewStatus: "deferred",
    lastReviewAction: "defer",
    reviewedAt: at,
  };
}

export function effectiveCandidatePayload(
  row: ContinuumCandidate,
): ContinuumCandidate["payload"] {
  return row.founderEditedPayload ?? row.payload;
}

export function effectiveCandidateTarget(
  row: ContinuumCandidate,
): ProposedCanonicalTarget {
  return row.founderEditedTarget ?? row.proposedTarget;
}
