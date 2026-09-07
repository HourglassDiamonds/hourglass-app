import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "./store";
import {
  applyFounderReview,
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "./review";
import { ingestGmailCandidates } from "../gmail/candidates/ingest";
import { hashEmail } from "../client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "../client-memory/gmail/types";
import type { GmailIndexedMessage } from "../client-memory/gmail/types";
import { EIGHT_THREADS } from "../gmail/candidates/fixtures";
import type {
  GmailCandidateEvidence,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "../gmail/candidates/types";

const NOW = "2026-09-07T12:00:00.000Z";
const THREAD = EIGHT_THREADS.travis;

function indexed(messageId: string, sentAt: string): GmailIndexedMessage {
  return {
    messageId,
    threadId: THREAD,
    sentAt,
    indexedAt: NOW,
    subject: "Size",
    fromEmailHash: hashEmail("client@example.test"),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "inbound",
    labelIds: ["INBOX"],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function evidence(
  messageId: string,
  plaintext: string,
  sentAt = "2026-08-01T12:00:00.000Z",
): GmailCandidateEvidence {
  return {
    indexed: indexed(messageId, sentAt),
    plaintext,
    fromEmailHash: hashEmail("client@example.test"),
  };
}

function world(): GmailCandidateWorld {
  const project: GmailCandidateProject = {
    projectId: "proj-travis",
    title: "Travis",
    gmailThreadId: THREAD,
    cadJobNumber: null,
    orderNumber: null,
    fingerSize: "11",
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: [],
    founderApprovedCurrent: true,
  };
  return { people: [], projects: [project], internalEmailHashes: [] };
}

function specOf(rows: Awaited<ReturnType<InMemoryCandidateStore["list"]>>) {
  return rows.find(
    (row) =>
      row.payload.kind === "structured_spec" &&
      row.payload.fieldName === "finger_size",
  );
}

async function ingestSize(store = new InMemoryCandidateStore()) {
  const input = {
    createdAt: NOW,
    world: world(),
    evidence: [evidence("m-size", "Finger size is 12.5.")],
  };
  const first = await ingestGmailCandidates(store, input);
  const spec = specOf(first.candidates);
  assert.ok(spec);
  return { store, input, spec: spec! };
}

describe("candidate review state", () => {
  it("keeps conflict as evidence state after founder approval", async () => {
    const { spec } = await ingestSize();
    assert.equal(spec.candidateState, "conflict");
    assert.equal(spec.reviewStatus, "pending");
    const reviewed = applyFounderReview(spec, { action: "approve" }, NOW);
    assert.equal(reviewed.candidateState, "conflict");
    assert.equal(reviewed.reviewStatus, "approved");
    assert.equal(reviewed.canonical, false);
    assert.equal(reviewed.automaticApply, false);
  });

  it("does not resurrect an approved candidate on identical reprocess", async () => {
    const { store, input, spec } = await ingestSize();
    await store.applyReview(spec.candidateId, { action: "approve" }, NOW);
    const second = await ingestGmailCandidates(store, input);
    const after = await store.get(spec.candidateId);
    assert.equal(after?.reviewStatus, "approved");
    assert.equal(after?.candidateState, "conflict");
    assert.equal(after?.lastReviewAction, "approve");
    assert.ok(second.duplicateIds.includes(spec.candidateId));
    assert.equal(
      (await store.list()).filter((row) => row.candidateId === spec.candidateId)
        .length,
      1,
    );
  });

  it("does not resurrect a discarded candidate on identical reprocess", async () => {
    const { store, input, spec } = await ingestSize();
    await store.applyReview(spec.candidateId, { action: "discard" }, NOW);
    await ingestGmailCandidates(store, input);
    const after = await store.get(spec.candidateId);
    assert.equal(after?.reviewStatus, "discarded");
    assert.equal(after?.candidateState, "conflict");
    assert.notEqual(after?.reviewStatus, "pending");
  });

  it("does not resurrect a deferred candidate on identical reprocess", async () => {
    const { store, input, spec } = await ingestSize();
    await store.applyReview(spec.candidateId, { action: "defer" }, NOW);
    await ingestGmailCandidates(store, input);
    const after = await store.get(spec.candidateId);
    assert.equal(after?.reviewStatus, "deferred");
    assert.equal(after?.lastReviewAction, "defer");
    assert.notEqual(after?.reviewStatus, "pending");
  });

  it("stores edit as payload/target provenance without a standalone edit status", async () => {
    const { store, spec } = await ingestSize();
    const edited = await store.applyReview(
      spec.candidateId,
      {
        action: "edit",
        payload: {
          kind: "structured_spec",
          fieldName: "finger_size",
          proposedValue: "12.25",
          currentValue: "11",
          conflict: true,
        },
        proposedTarget: {
          kind: "project_spec",
          projectId: "proj-travis",
          fieldName: "finger_size",
        },
      },
      NOW,
    );
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal(edited.record.reviewStatus, "pending");
    assert.equal(edited.record.lastReviewAction, "edit");
    assert.ok(!["approved", "discarded", "deferred"].includes(edited.record.reviewStatus));
    assert.equal(edited.record.payload.kind, "structured_spec");
    if (edited.record.payload.kind === "structured_spec") {
      assert.equal(edited.record.payload.proposedValue, "12.5");
    }
    const effective = effectiveCandidatePayload(edited.record);
    assert.equal(effective.kind, "structured_spec");
    if (effective.kind === "structured_spec") {
      assert.equal(effective.proposedValue, "12.25");
    }
    assert.equal(edited.record.founderEditedTarget?.kind, "project_spec");
    assert.equal(effectiveCandidateTarget(edited.record).kind, "project_spec");
    assert.equal(edited.record.canonical, false);
    assert.equal(edited.record.automaticApply, false);
  });

  it("does not write canonical Person/Project/spec/job flags on any review action", async () => {
    const { spec } = await ingestSize();
    for (const input of [
      { action: "approve" as const },
      { action: "discard" as const },
      { action: "defer" as const },
      {
        action: "edit" as const,
        payload: spec.payload,
        proposedTarget: spec.proposedTarget,
      },
    ]) {
      const reviewed = applyFounderReview(spec, input, NOW);
      assert.equal(reviewed.canonical, false);
      assert.equal(reviewed.automaticApply, false);
    }
  });

  it("keeps superseded history deterministic after founder discard", async () => {
    const store = new InMemoryCandidateStore();
    await ingestGmailCandidates(store, {
      createdAt: NOW,
      world: world(),
      evidence: [evidence("m-old", "Finger size is 12.5.", "2025-01-01T00:00:00.000Z")],
    });
    const older = specOf(await store.list());
    assert.ok(older);
    await store.applyReview(older!.candidateId, { action: "discard" }, NOW);
    await ingestGmailCandidates(store, {
      createdAt: NOW,
      world: world(),
      evidence: [evidence("m-new", "Finger size is 12.5.", "2026-04-02T00:00:00.000Z")],
    });
    const rows = (await store.list()).filter(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.equal(rows.length, 2);
    const discarded = rows.find((row) => row.candidateId === older!.candidateId);
    const newer = rows.find((row) => row.candidateId !== older!.candidateId);
    assert.equal(discarded?.candidateState, "superseded");
    assert.equal(discarded?.reviewStatus, "discarded");
    assert.equal(discarded?.supersededByCandidateId, newer?.candidateId);
    assert.equal(newer?.reviewStatus, "pending");
    assert.equal(newer?.candidateState, "conflict");
    assert.equal(newer?.supersedesCandidateId, discarded?.candidateId);
    assert.notEqual(newer?.candidateId, discarded?.candidateId);
  });

  it("keeps approved review on a superseded row when newer evidence arrives", async () => {
    const store = new InMemoryCandidateStore();
    await ingestGmailCandidates(store, {
      createdAt: NOW,
      world: world(),
      evidence: [evidence("m-old", "Finger size is 12.5.", "2025-01-01T00:00:00.000Z")],
    });
    const older = specOf(await store.list());
    assert.ok(older);
    await store.applyReview(older!.candidateId, { action: "approve" }, NOW);
    await ingestGmailCandidates(store, {
      createdAt: NOW,
      world: world(),
      evidence: [evidence("m-new", "Finger size is 12.5.", "2026-04-02T00:00:00.000Z")],
    });
    const discardedOrApproved = await store.get(older!.candidateId);
    assert.equal(discardedOrApproved?.candidateState, "superseded");
    assert.equal(discardedOrApproved?.reviewStatus, "approved");
    assert.equal(discardedOrApproved?.canonical, false);
  });
});
