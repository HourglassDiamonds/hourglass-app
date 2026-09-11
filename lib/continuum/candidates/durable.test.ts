import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignCandidateId } from "./identity";
import { effectiveCandidatePayload, effectiveCandidateTarget } from "./review";
import { SqlMappedCandidateStore } from "./sql-mapped-store";
import { CANDIDATE_PARSER_GOOGLE_CALENDAR_V1, CANDIDATE_PARSER_HUMAN_INTAKE_V1 } from "./types";

const NOW = "2026-08-25T17:00:00.000Z";
const LATER = "2026-08-26T17:00:00.000Z";

function specCandidate(sourceRef = "hi1|dddddddd-dddd-4ddd-8ddd-dddddddddddd|10|28") {
  return assignCandidateId({
    sourceSystem: "human-intake",
    sourceRef,
    sourceTimestamp: NOW,
    createdAt: NOW,
    candidateId: "",
    candidateType: "structured_spec",
    proposedTarget: {
      kind: "project_spec",
      projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      fieldName: "finger_size",
    },
    payload: {
      kind: "structured_spec",
      fieldName: "finger_size",
      proposedValue: "6.5",
      currentValue: "6",
      conflict: true,
    },
    confidence: "ambiguous",
    evidenceBasis: { ruleIds: ["finger_size"], matchedText: "Finger size is 6.5" },
    candidateState: "conflict",
    canonical: false,
    automaticApply: false,
    parserVersion: CANDIDATE_PARSER_HUMAN_INTAKE_V1,
  });
}

describe("durable CandidateStore SQL-shaped persistence", () => {
  it("keeps reviewStatus and edit overlays across snapshot reload", async () => {
    const store = new SqlMappedCandidateStore();
    const row = specCandidate();
    const inserted = await store.put(row);
    assert.equal(inserted.status, "inserted");
    await store.applyReview(
      row.candidateId,
      {
        action: "edit",
        payload:
          row.payload.kind === "structured_spec"
            ? { ...row.payload, proposedValue: "7" }
            : row.payload,
        proposedTarget: row.proposedTarget,
      },
      NOW,
    );
    await store.applyReview(row.candidateId, { action: "defer" }, NOW);
    const reloaded = SqlMappedCandidateStore.fromRows(store.exportRows());
    const restored = await reloaded.get(row.candidateId);
    assert.equal(restored?.reviewStatus, "deferred");
    assert.equal(restored?.lastReviewAction, "defer");
    assert.equal(restored?.candidateState, "conflict");
    const restoredPayload = effectiveCandidatePayload(restored!);
    assert.equal(restoredPayload.kind, "structured_spec");
    if (restoredPayload.kind === "structured_spec") {
      assert.equal(restoredPayload.proposedValue, "7");
    }
    assert.equal(effectiveCandidateTarget(restored!).kind, "project_spec");
    const again = await reloaded.put(row);
    assert.equal(again.status, "duplicate");
    assert.equal(again.record.reviewStatus, "deferred");
    assert.equal((await reloaded.list()).length, 1);
  });

  it("does not resurrect approved, discarded, or deferred rows and keeps one id", async () => {
    for (const action of ["approve", "discard", "defer"] as const) {
      const store = new SqlMappedCandidateStore();
      const row = specCandidate(`hi1|source-${action}|0|12`);
      await store.put(row);
      await store.applyReview(row.candidateId, { action }, NOW);
      const reloaded = SqlMappedCandidateStore.fromRows(store.exportRows());
      const second = await reloaded.put(row);
      assert.equal(second.status, "duplicate");
      assert.equal(second.record.reviewStatus, action === "approve" ? "approved" : action === "discard" ? "discarded" : "deferred");
      assert.equal(second.record.candidateId, row.candidateId);
      assert.equal((await reloaded.list()).filter((item) => item.candidateId === row.candidateId).length, 1);
    }
  });

  it("keeps superseded lineage review history when replacing", async () => {
    const store = new SqlMappedCandidateStore();
    const older = specCandidate("hi1|source-lineage|0|10");
    const newer = specCandidate("hi1|source-lineage|20|30");
    await store.put({ ...older, sourceTimestamp: NOW, createdAt: NOW });
    await store.put({ ...newer, sourceTimestamp: LATER, createdAt: LATER });
    await store.applyReview(older.candidateId, { action: "discard" }, NOW);
    await store.replace({
      ...(await store.get(older.candidateId))!,
      candidateState: "superseded",
      supersededByCandidateId: newer.candidateId,
    });
    const reloaded = SqlMappedCandidateStore.fromRows(store.exportRows());
    const history = await reloaded.get(older.candidateId);
    assert.equal(history?.candidateState, "superseded");
    assert.equal(history?.reviewStatus, "discarded");
    assert.equal(history?.supersededByCandidateId, newer.candidateId);
  });

  it("persists google_calendar association Candidates without duplicating on reload", async () => {
    const store = new SqlMappedCandidateStore();
    const row = assignCandidateId({
      sourceSystem: "google_calendar",
      sourceRef: "cal1|primary|evt-durable",
      sourceTimestamp: NOW,
      createdAt: NOW,
      candidateId: "",
      candidateType: "project_association",
      proposedTarget: { kind: "project", projectId: "proj-ada" },
      payload: {
        kind: "project_association",
        title: "Ada ring",
        token: "CR5001024",
        match: "exact",
      },
      confidence: "high",
      evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5001024" },
      candidateState: "active",
      canonical: false,
      automaticApply: false,
      parserVersion: CANDIDATE_PARSER_GOOGLE_CALENDAR_V1,
    });
    await store.put(row);
    await store.applyReview(row.candidateId, { action: "approve" }, NOW);
    const reloaded = SqlMappedCandidateStore.fromRows(store.exportRows());
    const second = await reloaded.put(row);
    assert.equal(second.status, "duplicate");
    assert.equal(second.record.reviewStatus, "approved");
    assert.equal(second.record.sourceSystem, "google_calendar");
    assert.equal(second.record.canonical, false);
    assert.equal((await reloaded.list()).length, 1);
  });

  it("round-trips observed supporting Gmail sourceRefs on evidence_basis", async () => {
    const store = new SqlMappedCandidateStore();
    const row = assignCandidateId({
      ...specCandidate(),
      candidateId: "",
      sourceSystem: "gmail",
      sourceRef: "gc1|1a085d41ae9efcf6|1a085d41ae9efcf6",
      evidenceBasis: {
        ruleIds: ["explicit_follow_up", "generated_founder_operating_brief"],
        matchedText: "follow-up window",
        supportingSourceRefs: ["gc1|1a04a565e20ee5f5|1a082e6c4dcb5849"],
      },
    });
    await store.put(row);
    const reloaded = SqlMappedCandidateStore.fromRows(store.exportRows());
    const restored = await reloaded.get(row.candidateId);
    assert.deepEqual(restored?.evidenceBasis.supportingSourceRefs, [
      "gc1|1a04a565e20ee5f5|1a082e6c4dcb5849",
    ]);
    assert.equal(restored?.sourceRef, "gc1|1a085d41ae9efcf6|1a085d41ae9efcf6");
  });
});
