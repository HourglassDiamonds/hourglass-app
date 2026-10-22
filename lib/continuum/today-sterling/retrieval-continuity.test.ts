import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planSterlingThreadVerificationContinuity,
  sterlingIndexedThreadFingerprint,
  sterlingThreadKeyDigest,
  type SterlingThreadVerificationMetadata,
} from "./retrieval-continuity";
import { STERLING_TODAY_WORKING_SET_VERSION, type SterlingTodayWorkingSet } from "./types";

function workingSet(threadIds: readonly string[]): SterlingTodayWorkingSet {
  return {
    contractVersion: STERLING_TODAY_WORKING_SET_VERSION,
    runId: "continuity-run",
    evidenceSnapshotId: "continuity-snapshot",
    sourceWatermark: "continuity-watermark",
    generatedAt: "2026-10-21T12:00:00.000Z",
    mutationMode: "shadow_read_only",
    people: [],
    projects: [],
    jobs: [],
    evidence: threadIds.map((threadId, index) => ({
      evidenceId: `evidence-${index}`,
      sourceType: "gmail" as const,
      sourceRef: `gmail:opaque:${index}`,
      timestamp: `2026-10-21T${String(index).padStart(2, "0")}:00:00.000Z`,
      direction: "inbound" as const,
      subject: "private",
      excerpt: "private",
      attachmentFilenames: [],
      messageId: `message-${index}`,
      threadId,
      projectIds: [],
      personIds: [],
      provenance: "indexed",
    })),
    workUnits: threadIds.map((threadId, index) => ({
      workUnitId: `provisional:${index}`,
      kind: "provisional_evidence" as const,
      identityBasis: "source_thread" as const,
      projectId: null,
      label: "private label",
      observedIdentifiers: [],
      typedIdentifiers: [],
      threadIds: [threadId],
      sourceRefs: [`gmail:opaque:${index}`],
      evidenceRefs: [`evidence-${index}`],
    })),
    calendarAvailability: { status: "unavailable", reason: "not-configured" },
    calendar: [],
    previousToday: [],
  };
}

function checkpoint(set: SterlingTodayWorkingSet, threadId: string): SterlingThreadVerificationMetadata {
  const current = sterlingIndexedThreadFingerprint(set, threadId);
  return {
    threadKeyDigest: sterlingThreadKeyDigest(threadId),
    indexedFingerprint: current.fingerprint,
    verifiedAt: "2026-10-21T12:05:00.000Z",
    latestIndexedMessageAt: current.latestIndexedMessageAt,
    indexedMessageCount: current.indexedMessageCount,
    outcome: "complete_live",
  };
}

describe("Sterling bounded retrieval continuity planning", () => {
  it("does not request an unchanged recently verified thread again", () => {
    const set = workingSet(["thread-a", "thread-b"]);
    const plan = planSterlingThreadVerificationContinuity({
      workingSet: set,
      priorVerifications: [checkpoint(set, "thread-a")],
      now: new Date("2026-10-21T12:10:00.000Z"),
      requestBudget: 48,
    });
    assert.equal(plan.reusableVerificationCount, 1);
    assert.deepEqual(plan.liveRequestThreadIds, ["thread-b"]);
    assert.equal(plan.semanticEvidenceReusable, false);
  });

  it("invalidates continuity when a new indexed message changes the fingerprint", () => {
    const before = workingSet(["thread-a"]);
    const after: SterlingTodayWorkingSet = {
      ...before,
      evidence: [...before.evidence, {
        ...before.evidence[0]!,
        evidenceId: "evidence-new",
        messageId: "message-new",
        timestamp: "2026-10-21T12:09:00.000Z",
      }],
      workUnits: [{ ...before.workUnits[0]!, evidenceRefs: ["evidence-0", "evidence-new"] }],
    };
    const plan = planSterlingThreadVerificationContinuity({
      workingSet: after,
      priorVerifications: [checkpoint(before, "thread-a")],
      now: new Date("2026-10-21T12:10:00.000Z"),
    });
    assert.equal(plan.invalidatedVerificationCount, 1);
    assert.deepEqual(plan.liveRequestThreadIds, ["thread-a"]);
  });

  it("keeps a stable bounded frontier and records overflow separately", () => {
    const set = workingSet(["thread-c", "thread-a", "thread-b"]);
    const first = planSterlingThreadVerificationContinuity({ workingSet: set, requestBudget: 2 });
    const second = planSterlingThreadVerificationContinuity({ workingSet: set, requestBudget: 2 });
    assert.deepEqual(first.liveRequestThreadIds, second.liveRequestThreadIds);
    assert.equal(first.liveRequestThreadIds.length, 2);
    assert.equal(first.budgetDeferredThreadIds.length, 1);
  });

  it("does not treat stale verification metadata as complete", () => {
    const set = workingSet(["thread-a"]);
    const plan = planSterlingThreadVerificationContinuity({
      workingSet: set,
      priorVerifications: [checkpoint(set, "thread-a")],
      now: new Date("2026-10-21T13:00:00.000Z"),
    });
    assert.equal(plan.reusableVerificationCount, 0);
    assert.equal(plan.invalidatedVerificationCount, 1);
    assert.deepEqual(plan.liveRequestThreadIds, ["thread-a"]);
  });
});
