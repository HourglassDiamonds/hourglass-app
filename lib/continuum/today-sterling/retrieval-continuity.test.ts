import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planSterlingThreadVerificationContinuity,
  sterlingIndexedThreadFingerprint,
  sterlingThreadKeyDigest,
  type SterlingThreadVerificationMetadata,
} from "./retrieval-continuity";
import { finalizeSterlingGmailExecution } from "./retrieval-execution";
import { STERLING_TODAY_WORKING_SET_VERSION, type SterlingTodayWorkingSet } from "./types";
import { InMemorySterlingThreadVerificationStore } from "./retrieval-continuity-store";

const HMAC_KEY = "test-only-sterling-continuity-key-32-bytes-minimum";

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
    threadKeyDigest: sterlingThreadKeyDigest(threadId, HMAC_KEY),
    indexedFingerprint: current.fingerprint,
    verifiedAt: "2026-10-21T12:05:00.000Z",
    expiresAt: "2026-10-21T12:20:00.000Z",
    latestIndexedMessageAt: current.latestIndexedMessageAt,
    indexedMessageCount: current.indexedMessageCount,
    outcome: "complete_live",
    revision: 1,
  };
}

describe("Sterling bounded retrieval continuity planning", () => {
  it("keeps the selected target first and never recombines deferred identifiers", () => {
    const execution = finalizeSterlingGmailExecution({
      selectedLiveThreadIds: ["target-thread", "alpha-unrelated", "target-thread"],
      budgetDeferredThreadIds: ["aardvark-deferred", "alpha-unrelated", "zulu-deferred"],
      targetThreadIds: ["target-thread"],
      requestBudget: 2,
    });
    assert.deepEqual(execution.scheduledThreadIds, ["target-thread", "alpha-unrelated"]);
    assert.deepEqual(execution.budgetDeferredThreadIds, ["aardvark-deferred", "zulu-deferred"]);
  });

  it("fails before retrieval when a target is deferred or exceeds the budget", () => {
    assert.throws(() => finalizeSterlingGmailExecution({
      selectedLiveThreadIds: ["unrelated-thread"],
      budgetDeferredThreadIds: ["target-thread"],
      targetThreadIds: ["target-thread"],
      requestBudget: 1,
    }), /sterling-target-required-thread-not-scheduled/);
    const threads = Array.from({ length: 49 }, (_, index) => `thread-${index}`);
    assert.throws(() => finalizeSterlingGmailExecution({
      selectedLiveThreadIds: threads,
      budgetDeferredThreadIds: [],
    }), /sterling-gmail-selected-set-exceeds-budget/);
    assert.throws(() => finalizeSterlingGmailExecution({
      selectedLiveThreadIds: [],
      budgetDeferredThreadIds: [],
      targetThreadIds: threads,
    }), /sterling-target-required-evidence-exceeds-budget/);
  });
  it("does not request an unchanged recently verified thread again", () => {
    const set = workingSet(["thread-a", "thread-b"]);
    const plan = planSterlingThreadVerificationContinuity({
      workingSet: set,
      priorVerifications: [checkpoint(set, "thread-a")],
      now: new Date("2026-10-21T12:10:00.000Z"),
      requestBudget: 48,
      threadKeyHmacKey: HMAC_KEY,
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
      threadKeyHmacKey: HMAC_KEY,
    });
    assert.equal(plan.invalidatedVerificationCount, 1);
    assert.deepEqual(plan.liveRequestThreadIds, ["thread-a"]);
  });

  it("keeps a stable bounded frontier and records overflow separately", () => {
    const set = workingSet(["thread-c", "thread-a", "thread-b"]);
    const first = planSterlingThreadVerificationContinuity({ workingSet: set, requestBudget: 2,
      threadKeyHmacKey: HMAC_KEY });
    const second = planSterlingThreadVerificationContinuity({ workingSet: set, requestBudget: 2,
      threadKeyHmacKey: HMAC_KEY });
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
      threadKeyHmacKey: HMAC_KEY,
    });
    assert.equal(plan.reusableVerificationCount, 0);
    assert.equal(plan.expiredVerificationCount, 1);
    assert.equal(plan.invalidatedVerificationCount, 0);
    assert.deepEqual(plan.liveRequestThreadIds, ["thread-a"]);
  });

  it("uses a server-held HMAC so raw or unsalted thread identifiers are not stored", () => {
    const digest = sterlingThreadKeyDigest("guessable-thread-123", HMAC_KEY);
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.notEqual(digest, "guessable-thread-123");
    assert.notEqual(digest, sterlingThreadKeyDigest("guessable-thread-123", `${HMAC_KEY}-different`));
    assert.throws(() => sterlingThreadKeyDigest("thread", "short"), /hmac-key-invalid/);
  });

  it("advances the bounded frontier across runs without making semantic evidence reusable", async () => {
    const set = workingSet(["thread-a", "thread-b", "thread-c"]);
    const store = new InMemorySterlingThreadVerificationStore();
    const first = planSterlingThreadVerificationContinuity({
      workingSet: set,
      threadKeyHmacKey: HMAC_KEY,
      requestBudget: 2,
      now: new Date("2026-10-21T12:10:00.000Z"),
    });
    assert.deepEqual(first.liveRequestThreadIds, ["thread-c", "thread-b"]);
    for (const threadId of first.liveRequestThreadIds) {
      await store.save(checkpoint(set, threadId), null);
    }
    const loaded = await store.load(["thread-a", "thread-b", "thread-c"].map((threadId) =>
      sterlingThreadKeyDigest(threadId, HMAC_KEY)));
    assert.equal(loaded.available, true);
    const second = planSterlingThreadVerificationContinuity({
      workingSet: set,
      priorVerifications: loaded.rows,
      threadKeyHmacKey: HMAC_KEY,
      requestBudget: 2,
      now: new Date("2026-10-21T12:10:00.000Z"),
    });
    assert.equal(second.reusableVerificationCount, 2);
    assert.deepEqual(second.liveRequestThreadIds, ["thread-a"]);
    assert.equal(second.semanticEvidenceReusable, false);
  });

  it("prioritizes a reviewed target inside the bounded portfolio without filtering other work", () => {
    const set = workingSet(["target-thread", "ordinary-a", "ordinary-b"]);
    const plan = planSterlingThreadVerificationContinuity({
      workingSet: set,
      threadKeyHmacKey: HMAC_KEY,
      requestBudget: 2,
      priorityThreadIds: ["target-thread"],
    });
    assert.equal(plan.requiredThreadCount, 3);
    assert.deepEqual(plan.liveRequestThreadIds, ["target-thread", "ordinary-b"]);
    assert.deepEqual(plan.budgetDeferredThreadIds, ["ordinary-a"]);
  });

  it("requires a fresh live read for a semantic target even when planning metadata is reusable", () => {
    const set = workingSet(["target-thread", "ordinary"]);
    const plan = planSterlingThreadVerificationContinuity({
      workingSet: set,
      priorVerifications: [checkpoint(set, "target-thread")],
      now: new Date("2026-10-21T12:10:00.000Z"),
      requestBudget: 1,
      threadKeyHmacKey: HMAC_KEY,
      priorityThreadIds: ["target-thread"],
      forceLiveThreadIds: ["target-thread"],
    });
    assert.equal(plan.reusableVerificationCount, 0);
    assert.deepEqual(plan.liveRequestThreadIds, ["target-thread"]);
    assert.equal(plan.semanticEvidenceReusable, false);
  });
});
