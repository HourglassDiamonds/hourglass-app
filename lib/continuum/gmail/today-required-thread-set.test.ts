import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type {
  CosDocketItemView,
  CosWatchingItem,
} from "@/lib/continuum/chief-of-staff/operating-loop/types";
import { requiredTodayLiveThreadIds } from "./today-required-thread-set";

function candidate(
  candidateId: string,
  threadId: string,
  messageId: string,
): ContinuumCandidate {
  return {
    candidateId,
    sourceSystem: "gmail",
    sourceRef: `gc1|${threadId}|${messageId}`,
    sourceTimestamp: "2026-10-01T12:00:00.000Z",
    candidateType: "note",
    proposedTarget: { kind: "none" },
    payload: { kind: "note", text: candidateId, contextLayer: null },
    confidence: "high",
    evidenceBasis: { ruleIds: ["test"], matchedText: candidateId },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "test",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("Today required live Gmail thread set", () => {
  it("includes the full actionable frontier, its project context, and unresolved identity", () => {
    const upNext = [
      {
        briefingPacket: {
          projectId: "project-current",
          sourceRefs: ["gc1|current-thread|current-message"],
          sourceEvents: [
            {
              threadId: "event-thread",
              sourceRef: "gc1|event-thread|event-message",
            },
          ],
        },
        job: { sourceRef: "gc1|job-thread|job-message" },
        brief: null,
        decision: null,
      } as unknown as CosDocketItemView,
    ];
    const watching = [
      {
        projectId: "project-watching",
        candidateIds: ["candidate-current"],
        briefingPacket: {
          projectId: "project-watching",
          sourceRefs: [],
        },
      } as unknown as CosWatchingItem,
    ];
    const result = requiredTodayLiveThreadIds({
      upNext,
      watching,
      candidates: [
        candidate("candidate-current", "candidate-thread", "candidate-message"),
        candidate("candidate-historical", "historical-thread", "old-message"),
      ],
      associatedGmailThreadsByProject: new Map([
        ["project-current", ["current-thread", "changed-relevant-thread"]],
        ["project-watching", ["watching-related-thread"]],
        ["project-historical", ["unrelated-project-thread"]],
      ]),
      unresolvedIdentityThreadIds: ["unresolved-thread"],
    });

    assert.deepEqual(result, [
      "candidate-thread",
      "changed-relevant-thread",
      "current-thread",
      "event-thread",
      "job-thread",
      "unresolved-thread",
      "watching-related-thread",
    ]);
    assert.equal(result.includes("historical-thread"), false);
    assert.equal(result.includes("unrelated-project-thread"), false);
  });

  it("returns a stable sorted set when references overlap", () => {
    const result = requiredTodayLiveThreadIds({
      upNext: [
        {
          briefingPacket: {
            projectId: "project-a",
            sourceRefs: [
              "gc1|thread-b|message-1",
              "https://mail.google.com/mail/u/0/#inbox/thread-a",
            ],
          },
          job: null,
          brief: null,
          decision: null,
        } as unknown as CosDocketItemView,
      ],
      watching: [],
      candidates: [],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["thread-b", "thread-a"]],
      ]),
    });

    assert.deepEqual(result, ["thread-a", "thread-b"]);
  });
});
