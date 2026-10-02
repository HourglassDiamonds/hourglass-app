import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type {
  CosDocketItemView,
  CosWatchingItem,
} from "@/lib/continuum/chief-of-staff/operating-loop/types";
import {
  classifyTodayLiveThreadFrontier,
  requiredTodayLiveThreadIds,
} from "./today-required-thread-set";

function candidate(
  candidateId: string,
  threadId: string,
  options: {
    state?: ContinuumCandidate["candidateState"];
    review?: ContinuumCandidate["reviewStatus"];
    supportingThreadId?: string;
  } = {},
): ContinuumCandidate {
  return {
    candidateId,
    sourceSystem: "gmail",
    sourceRef: `gc1|${threadId}|${candidateId}-message`,
    sourceTimestamp: "2026-10-01T12:00:00.000Z",
    candidateType: "note",
    proposedTarget: { kind: "none" },
    payload: { kind: "note", text: candidateId, contextLayer: null },
    confidence: "high",
    evidenceBasis: {
      ruleIds: ["test"],
      matchedText: candidateId,
      supportingSourceRefs: options.supportingThreadId
        ? [`gc1|${options.supportingThreadId}|support-message`]
        : undefined,
    },
    candidateState: options.state ?? "active",
    reviewStatus: options.review ?? "pending",
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

function packet(
  projectId: string,
  controllingThreadIds: readonly string[],
): NonNullable<CosDocketItemView["briefingPacket"]> {
  return {
    projectId,
    sourceRefs: [
      ...controllingThreadIds.map((id) => `gc1|${id}|current-message`),
      "gc1|historical-packet-thread|historical-message",
    ],
    sourceEvents: [],
    projection: {
      controllingSourceRefs: controllingThreadIds.map(
        (id) => `gc1|${id}|current-message`,
      ),
    },
  } as unknown as NonNullable<CosDocketItemView["briefingPacket"]>;
}

function actionable(
  projectId: string,
  controllingThreadIds: readonly string[],
): CosDocketItemView {
  return {
    briefingPacket: packet(projectId, controllingThreadIds),
    job: null,
    brief: null,
    decision: null,
    anomaly: null,
  } as unknown as CosDocketItemView;
}

function watching(
  projectId: string,
  controllingThreadIds: readonly string[],
): CosWatchingItem {
  return {
    projectId,
    candidateIds: [],
    briefingPacket: packet(projectId, controllingThreadIds),
  } as unknown as CosWatchingItem;
}

describe("Today required live Gmail thread frontier", () => {
  it("requires only the newest controlling CAD thread on a project with historical CAD threads", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [actionable("project-a", ["newest-cad-thread"])],
      watching: [],
      candidates: [
        candidate("new", "newest-cad-thread"),
        candidate("old-one", "old-cad-thread-one"),
        candidate("old-two", "old-cad-thread-two"),
      ],
      associatedGmailThreadsByProject: new Map([
        [
          "project-a",
          ["old-cad-thread-one", "newest-cad-thread", "old-cad-thread-two"],
        ],
      ]),
    });

    assert.deepEqual(result.requiredThreadIds, ["newest-cad-thread"]);
    assert.equal(result.priorBroadThreadCount, 4);
    assert.equal(result.counts.actionable, 1);
    assert.equal(result.counts.project_context, 2);
    assert.equal(result.counts.invalid_stale, 1);
  });

  it("excludes an inaccessible superseded thread from the publication frontier", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [actionable("project-a", ["current-thread"])],
      watching: [],
      candidates: [
        candidate("current", "current-thread"),
        candidate("old", "superseded-thread", { state: "superseded" }),
      ],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["current-thread", "superseded-thread"]],
      ]),
    });

    assert.equal(result.requiredThreadIds.includes("superseded-thread"), false);
    assert.equal(result.counts.historical_superseded, 1);
  });

  it("excludes a stale associated thread with no persisted dependency", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [actionable("project-a", ["current-thread"])],
      watching: [],
      candidates: [candidate("current", "current-thread")],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["current-thread", "stale-pointer"]],
      ]),
    });

    assert.equal(result.requiredThreadIds.includes("stale-pointer"), false);
    assert.equal(result.counts.invalid_stale, 2);
  });

  it("keeps a stale-looking thread required when current truth directly depends on it", () => {
    const result = requiredTodayLiveThreadIds({
      upNext: [actionable("project-a", ["current-thread", "old-but-controlling"])],
      watching: [],
      candidates: [],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["current-thread", "old-but-controlling"]],
      ]),
    });

    assert.deepEqual(result, ["current-thread", "old-but-controlling"]);
  });

  it("classifies a supporting-thread alias without requiring it twice", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [actionable("project-a", ["primary-thread"])],
      watching: [],
      candidates: [
        candidate("linked", "primary-thread", {
          supportingThreadId: "alias-thread",
        }),
      ],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["primary-thread", "alias-thread"]],
      ]),
    });

    assert.deepEqual(result.requiredThreadIds, ["primary-thread"]);
    assert.equal(result.counts.duplicate_alias, 1);
  });

  it("requires a current shop-order dependency in the watching lane", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [],
      watching: [watching("project-shop", ["shop-order-thread"])],
      candidates: [],
    });

    assert.deepEqual(result.requiredThreadIds, ["shop-order-thread"]);
    assert.equal(result.counts.watching, 1);
  });

  it("requires a thread used to resolve a current unknown identity", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [],
      watching: [],
      candidates: [],
      unresolvedIdentityThreadIds: ["identity-thread"],
    });

    assert.deepEqual(result.requiredThreadIds, ["identity-thread"]);
    assert.equal(result.counts.identity, 1);
  });

  it("keeps non-current project association as indexed context, not a veto", () => {
    const result = classifyTodayLiveThreadFrontier({
      upNext: [actionable("project-a", ["current-thread"])],
      watching: [],
      candidates: [
        candidate("current", "current-thread"),
        candidate("context", "context-thread"),
      ],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["current-thread", "context-thread"]],
      ]),
    });

    assert.equal(result.requiredThreadIds.includes("context-thread"), false);
    assert.equal(result.counts.project_context, 1);
  });

  it("allows publication to ignore an inaccessible thread proven irrelevant by indexed state", () => {
    const required = requiredTodayLiveThreadIds({
      upNext: [actionable("project-a", ["available-current-thread"])],
      watching: [],
      candidates: [candidate("irrelevant", "inaccessible-history")],
      associatedGmailThreadsByProject: new Map([
        ["project-a", ["available-current-thread", "inaccessible-history"]],
      ]),
    });

    assert.deepEqual(required, ["available-current-thread"]);
  });

  it("returns a stable sorted set when current references overlap", () => {
    const result = requiredTodayLiveThreadIds({
      upNext: [actionable("project-a", ["thread-b", "thread-a", "thread-b"])],
      watching: [watching("project-a", ["thread-a"])],
      candidates: [],
      unresolvedIdentityThreadIds: ["thread-b"],
    });

    assert.deepEqual(result, ["thread-a", "thread-b"]);
  });
});
