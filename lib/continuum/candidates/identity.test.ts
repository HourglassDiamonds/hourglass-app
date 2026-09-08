import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignCandidateId,
  candidateIdFromIdentity,
  candidateIdentityKey,
} from "./identity";
import { CANDIDATE_CONTRACT_VERSION, type ContinuumCandidateDraft } from "./types";

function draft(
  input: Pick<
    ContinuumCandidateDraft,
    "sourceRef" | "proposedTarget" | "payload"
  > &
    Partial<Pick<ContinuumCandidateDraft, "sourceSystem">>,
): ContinuumCandidateDraft {
  return {
    candidateId: "",
    sourceSystem: "gmail",
    sourceTimestamp: "2026-08-01T00:00:00.000Z",
    candidateType: input.payload.kind,
    confidence: "high",
    evidenceBasis: { ruleIds: ["test"], matchedText: null },
    candidateState: "active",
    createdAt: "2026-08-01T00:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_CONTRACT_VERSION,
    ...input,
  };
}

describe("candidate identity", () => {
  it("keeps the same evidence + proposal as one id", () => {
    const left = assignCandidateId(
      draft({
        sourceRef: "gc1|aaaaaaaaaa|msg-1",
        proposedTarget: { kind: "project", projectId: "p1" },
        payload: {
          kind: "project_association",
          title: "Pennock",
          token: null,
          match: "exact",
        },
      }),
    );
    const right = assignCandidateId(
      draft({
        sourceRef: "gc1|aaaaaaaaaa|msg-1",
        proposedTarget: { kind: "project", projectId: "p1" },
        payload: {
          kind: "project_association",
          title: "Pennock",
          token: null,
          match: "exact",
        },
      }),
    );
    assert.equal(left.candidateId, right.candidateId);
  });

  it("separates the same evidence proposed at two Projects", () => {
    const left = candidateIdFromIdentity(
      candidateIdentityKey(
        draft({
          sourceRef: "gc1|aaaaaaaaaa|msg-1",
          proposedTarget: { kind: "project", projectId: "p1" },
          payload: {
            kind: "project_association",
            title: "One",
            token: "CR5001024",
            match: "ambiguous",
          },
        }),
      ),
    );
    const right = candidateIdFromIdentity(
      candidateIdentityKey(
        draft({
          sourceRef: "gc1|aaaaaaaaaa|msg-1",
          proposedTarget: { kind: "project", projectId: "p2" },
          payload: {
            kind: "project_association",
            title: "Two",
            token: "CR5001024",
            match: "ambiguous",
          },
        }),
      ),
    );
    assert.notEqual(left, right);
  });

  it("does not collide Calendar cal1 refs with Gmail gc1 refs", () => {
    const calendar = candidateIdFromIdentity(
      candidateIdentityKey(
        draft({
          sourceSystem: "google_calendar",
          sourceRef: "cal1|primary|evt-1",
          proposedTarget: { kind: "project", projectId: "p1" },
          payload: {
            kind: "project_association",
            title: "One",
            token: "CR5001024",
            match: "exact",
          },
        }),
      ),
    );
    const gmail = candidateIdFromIdentity(
      candidateIdentityKey(
        draft({
          sourceRef: "gc1|primary|evt-1",
          proposedTarget: { kind: "project", projectId: "p1" },
          payload: {
            kind: "project_association",
            title: "One",
            token: "CR5001024",
            match: "exact",
          },
        }),
      ),
    );
    assert.notEqual(calendar, gmail);
  });
});
