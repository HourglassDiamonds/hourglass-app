import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { protectExactThread } from "./exact-thread-payload";
import {
  ACHEDEKAL_THREAD,
  ACHEDEKAL_THREAD_ID,
  ADJACENCY_THREAD,
  NO_EVIDENCE_THREAD,
} from "./exact-thread-fixtures";
import {
  buildExactThreadReconstructionHandoff,
  collectExactThreadEvidence,
  proposedFingerSizeCorrection,
  RECONSTRUCTION_EVIDENCE_KINDS,
} from "./reconstruction-evidence";

const ACHEDEKAL_SPECS = {
  fingerSize: "141",
  orderNumber: "140",
  cadJobNumber: "CAD-1",
  metal: "platinum",
  centerStone: null,
};

describe("exact-thread reconstruction evidence contract", () => {
  it("exposes candidate evidence kinds without deciding canonical truth", () => {
    assert.deepEqual(RECONSTRUCTION_EVIDENCE_KINDS, [
      "finger_size",
      "order_number",
      "cad_job_number",
      "metal",
      "center_stone",
      "client_approval",
      "requested_revision",
      "vendor_response",
      "timing",
      "attachment_inventory",
    ]);
  });

  it("surfaces Achedekal ring-size 6.5 as a proposed spec correction only", () => {
    const thread = protectExactThread(ACHEDEKAL_THREAD);
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: "proj-achedekal",
      currentSpecs: ACHEDEKAL_SPECS,
      thread,
    });
    assert.equal(handoff.thread.threadId, ACHEDEKAL_THREAD_ID);
    assert.equal(handoff.currentSpecs.fingerSize, "141");
    assert.equal(handoff.currentSpecs.orderNumber, "140");
    const sizeEvidence = handoff.candidateEvidence.filter(
      (row) => row.kind === "finger_size",
    );
    assert.deepEqual(
      sizeEvidence.map((row) => row.proposedValue),
      ["6.5"],
    );
    assert.equal(sizeEvidence[0]?.explicit, true);
    assert.deepEqual(handoff.proposedCorrections, [
      {
        fieldName: "finger_size",
        currentValue: "141",
        proposedValue: "6.5",
        automaticApply: false,
        requiresFounderApproval: true,
      },
    ]);
    assert.equal(
      handoff.candidateEvidence.some((row) => row.kind === "attachment_inventory"),
      true,
    );
    assert.equal(
      handoff.candidateEvidence.some((row) => row.kind === "timing"),
      true,
    );
    assert.equal(
      handoff.proposedCorrections.some((row) => row.fieldName === "order_number"),
      false,
    );
  });

  it("does not propose a value when the exact thread has no explicit size", () => {
    const thread = protectExactThread(NO_EVIDENCE_THREAD);
    const evidence = collectExactThreadEvidence(thread);
    assert.equal(
      evidence.some((row) => row.kind === "finger_size"),
      false,
    );
    assert.equal(proposedFingerSizeCorrection("141", evidence), null);
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: "proj-no-size",
      currentSpecs: ACHEDEKAL_SPECS,
      thread,
    });
    assert.deepEqual(handoff.proposedCorrections, []);
    assert.equal(handoff.currentSpecs.orderNumber, "140");
  });

  it("does not treat 141/140 adjacency as finger-size evidence", () => {
    const thread = protectExactThread(ADJACENCY_THREAD);
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: "proj-adjacency",
      currentSpecs: ACHEDEKAL_SPECS,
      thread,
    });
    assert.equal(
      handoff.candidateEvidence.some((row) => row.kind === "finger_size"),
      false,
    );
    assert.deepEqual(handoff.proposedCorrections, []);
    assert.equal(handoff.currentSpecs.fingerSize, "141");
    assert.equal(handoff.currentSpecs.orderNumber, "140");
  });

  it("does not treat CAD presentation as a job identifier", () => {
    const thread = protectExactThread(ADJACENCY_THREAD);
    const presentation = {
      ...thread,
      messages: thread.messages.map((row) => ({
        ...row,
        subject: "CAD presentation",
        plainText: "CAD presentation / CAD design / CAD render / CAD revision / CAD update / CAD approval.",
      })),
    };
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: "proj-cad-words",
      currentSpecs: ACHEDEKAL_SPECS,
      thread: presentation,
    });
    assert.equal(
      handoff.candidateEvidence.some((row) => row.kind === "cad_job_number"),
      false,
    );
  });

  it("accepts a realistic CAD/job code from exact-thread text", () => {
    const thread = protectExactThread(ADJACENCY_THREAD);
    const coded = {
      ...thread,
      messages: thread.messages.map((row) => ({
        ...row,
        plainText: "Please review CAD-8821 and keep order 140.",
      })),
    };
    const handoff = buildExactThreadReconstructionHandoff({
      projectId: "proj-cad-code",
      currentSpecs: ACHEDEKAL_SPECS,
      thread: coded,
    });
    assert.equal(
      handoff.candidateEvidence.some(
        (row) => row.kind === "cad_job_number" && row.proposedValue === "CAD-8821",
      ),
      true,
    );
  });
});
