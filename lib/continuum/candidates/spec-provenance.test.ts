import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "./types";
import {
  isExactStructuredSpecGmailSource,
  structuredSpecSourceProvenanceOf,
  withStructuredSpecProvenance,
} from "./spec-provenance";

function specCandidate(
  extras?: Partial<ContinuumCandidate> & {
    sourceProvenance?: ContinuumCandidate["payload"] extends { kind: "structured_spec" }
      ? ContinuumCandidate["payload"]["sourceProvenance"]
      : never;
  },
): ContinuumCandidate {
  return {
    candidateId: "e2f3673c23480009fc75c14eacf0ff2410794092feb9219364598cbda690af53",
    sourceSystem: "gmail",
    sourceRef: "gc1|19ffcce49298efeb|1a08c4df80609947",
    sourceTimestamp: "2026-09-10T12:00:00.000Z",
    candidateType: "structured_spec",
    proposedTarget: {
      kind: "project_spec",
      projectId: "proj-travis",
      fieldName: "finger_size",
    },
    payload: {
      kind: "structured_spec",
      fieldName: "finger_size",
      proposedValue: "11",
      currentValue: "12.5",
      conflict: true,
      sourceProvenance: extras?.payload?.kind === "structured_spec"
        ? extras.payload.sourceProvenance
        : undefined,
    },
    confidence: "ambiguous",
    evidenceBasis: {
      ruleIds: ["explicit_finger_size", "spec_conflict_review_required"],
      matchedText: "finger size 11",
    },
    candidateState: "conflict",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-09-10T12:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "gmail-v1",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
    ...extras,
  };
}

describe("structured_spec provenance metadata", () => {
  it("treats legacy Gmail rows without provenance as EXACT", () => {
    const row = specCandidate();
    assert.equal(structuredSpecSourceProvenanceOf(row), "EXACT");
    assert.equal(isExactStructuredSpecGmailSource(row), true);
  });

  it("repairs UNKNOWN without changing review state or proposed value", () => {
    const row = specCandidate();
    const next = withStructuredSpecProvenance(row, "UNKNOWN");
    assert.equal(next.reviewStatus, "pending");
    assert.equal(next.candidateState, "conflict");
    assert.equal(next.sourceRef, row.sourceRef);
    assert.equal(next.payload.kind, "structured_spec");
    if (next.payload.kind !== "structured_spec") return;
    assert.equal(next.payload.proposedValue, "11");
    assert.equal(next.payload.currentValue, "12.5");
    assert.equal(next.payload.sourceProvenance, "UNKNOWN");
    assert.equal(isExactStructuredSpecGmailSource(next), false);
  });

  it("can restamp an exact sourceRef without approving the candidate", () => {
    const next = withStructuredSpecProvenance(specCandidate(), "EXACT", {
      sourceRef: "gc1|19fdca0abe1a7e3e|19fdca0abe1a7e3e",
    });
    assert.equal(next.reviewStatus, "pending");
    assert.equal(next.candidateState, "conflict");
    assert.equal(next.sourceRef, "gc1|19fdca0abe1a7e3e|19fdca0abe1a7e3e");
    assert.equal(isExactStructuredSpecGmailSource(next), true);
  });
});
