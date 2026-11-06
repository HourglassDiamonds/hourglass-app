import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCanonicalApprovalPayload,
  sourceSuppressionBindingError,
  SupabaseSterlingCanonicalApprovalRepository,
} from "./canonical-approval-repository";
import type { SterlingCanonicalApprovalEnvelope } from "./canonical-approval-adapter";

const original: SterlingCanonicalApprovalEnvelope = {
  version: 1,
  kind: "canonical_change_set",
  approvalId: "76000000-0000-4000-8000-000000000001",
  projectId: "72000000-0000-4000-8000-000000000001",
  projectKind: "custom_new_jewelry",
  evidenceRefs: ["founder:test"],
  sourceWatermark: "test-watermark",
  requiresFounderApproval: true,
  operations: [{
    operationId: "77000000-0000-4000-8000-000000000001",
    kind: "resolve_open_job",
    projectId: "72000000-0000-4000-8000-000000000001",
    personId: "71000000-0000-4000-8000-000000000001",
    jobId: "74000000-0000-4000-8000-000000000001",
    expectedRecordVersion: "2026-10-30T15:00:00.000Z",
    evidenceRefs: ["founder:test"],
  }],
};

function fakeClient(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const row = {
    proposal_id: original.approvalId,
    proposal_type: original.kind,
    status: "proposed",
    record_version: 4,
    created_at: "2026-10-30T16:00:00.000Z",
    reasoning_summary: "Synthetic founder review fixture.",
    evidence_refs: ["founder:test"],
    original_proposal: original,
    approved_payload: null,
    founder_decision: null,
    founder_decision_at: null,
    founder_decision_note: null,
    founder_decided_by: null,
    execution_status: "not_requested",
    execution_receipt: null,
    ...overrides,
  };
  const client = {
    from(table: string) {
      assert.equal(table, "continuum_sterling_proposals");
      return {
        select() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, "proposal_id");
              assert.equal(value, original.approvalId);
              return { maybeSingle: async () => ({ data: row, error: null }) };
            },
          };
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return name === "continuum_sterling_record_canonical_decision"
        ? { data: { status: "approved", recordVersion: 5 }, error: null }
        : { data: { status: "executed", recordVersion: 6, receipt: { version: 1 } }, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function executionFailureClient() {
  const fixture = fakeClient();
  const client = fixture.client as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
  client.rpc = async (name: string, args: Record<string, unknown>) => {
    fixture.calls.push({ name, args });
    return name === "continuum_sterling_record_canonical_decision"
      ? { data: { status: "approved", recordVersion: 5 }, error: null }
      : { data: null, error: { message: "stale-job-version" } };
  };
  return fixture;
}

describe("Sterling canonical approval repository", () => {
  it("executes the immutable server-loaded payload for a plain approval", async () => {
    const { client, calls } = fakeClient();
    const repository = new SupabaseSterlingCanonicalApprovalRepository(client);
    const substituted = { ...original, sourceWatermark: "browser-substitution" };
    const result = await repository.approveAndExecute({
      proposalId: original.approvalId,
      expectedRecordVersion: 4,
      decision: "approved",
      approvedPayload: substituted,
      actor: "founder",
      now: "2026-10-30T17:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.name, "continuum_sterling_record_canonical_decision");
    assert.deepEqual(calls[0]?.args.p_approved_payload, original);
    assert.equal(calls[1]?.name, "continuum_sterling_execute_approved_change_set");
    assert.equal(calls[1]?.args.p_expected_record_version, 5);
  });

  it("requires a complete server-validated payload for edited approval", async () => {
    const { client, calls } = fakeClient();
    const repository = new SupabaseSterlingCanonicalApprovalRepository(client);
    const result = await repository.approveAndExecute({
      proposalId: original.approvalId,
      expectedRecordVersion: 4,
      decision: "edited_and_approved",
      actor: "founder",
      now: "2026-10-30T17:00:00.000Z",
    });
    assert.deepEqual(result, { ok: false, reason: "invalid-approved-payload" });
    assert.equal(calls.length, 0);
  });

  it("reports that founder approval remains durable when canonical execution fails", async () => {
    const { client, calls } = executionFailureClient();
    const repository = new SupabaseSterlingCanonicalApprovalRepository(client);
    const result = await repository.approveAndExecute({
      proposalId: original.approvalId,
      expectedRecordVersion: 4,
      decision: "approved",
      actor: "founder",
      now: "2026-10-30T17:00:00.000Z",
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "stale-job-version",
      approvalRecorded: true,
      recordVersion: 5,
    });
    assert.equal(calls.length, 2);
  });

  it("recognizes only an exact already-executed approval replay", async () => {
    const receipt = { version: 1, operations: [original.operations[0]?.operationId] };
    const exact = fakeClient({
      status: "executed",
      record_version: 6,
      approved_payload: original,
      founder_decision: "approved",
      founder_decision_at: "2026-10-30T17:00:00.000Z",
      founder_decided_by: "founder",
      execution_status: "executed",
      execution_receipt: receipt,
    });
    const repository = new SupabaseSterlingCanonicalApprovalRepository(exact.client);
    const replay = await repository.approveAndExecute({
      proposalId: original.approvalId,
      expectedRecordVersion: 4,
      decision: "approved",
      actor: "founder",
      now: "2026-10-30T17:00:01.000Z",
    });
    assert.deepEqual(replay, { ok: true, status: "already-present", recordVersion: 6, receipt });
    assert.equal(exact.calls.length, 0);

    const conflict = await repository.approveAndExecute({
      proposalId: original.approvalId,
      expectedRecordVersion: 6,
      decision: "edited_and_approved",
      approvedPayload: { ...original, sourceWatermark: "conflicting-repeat" },
      actor: "founder",
      now: "2026-10-30T17:00:02.000Z",
    });
    assert.deepEqual(conflict, { ok: false, reason: "approval-idempotency-conflict" });
    assert.equal(exact.calls.length, 0);
  });

  it("rejects stale rejection requests and recognizes only an exact rejection replay", async () => {
    const stale = fakeClient();
    const staleRepository = new SupabaseSterlingCanonicalApprovalRepository(stale.client);
    assert.deepEqual(await staleRepository.reject({
      proposalId: original.approvalId,
      expectedRecordVersion: 3,
      actor: "founder",
      note: "Not supported",
      now: "2026-10-30T17:00:00.000Z",
    }), { ok: false, reason: "stale-ledger-version" });

    const rejected = fakeClient({
      status: "rejected",
      record_version: 5,
      founder_decision: "rejected",
      founder_decision_at: "2026-10-30T17:00:00.000Z",
      founder_decision_note: "Not supported",
      founder_decided_by: "founder",
    });
    const rejectedRepository = new SupabaseSterlingCanonicalApprovalRepository(rejected.client);
    assert.deepEqual(await rejectedRepository.reject({
      proposalId: original.approvalId,
      expectedRecordVersion: 4,
      actor: "founder",
      note: "Not supported",
      now: "2026-10-30T17:00:01.000Z",
    }), { ok: true, status: "already-present", recordVersion: 5 });
    assert.deepEqual(await rejectedRepository.reject({
      proposalId: original.approvalId,
      expectedRecordVersion: 5,
      actor: "founder",
      note: "Different rejection",
      now: "2026-10-30T17:00:02.000Z",
    }), { ok: false, reason: "rejection-idempotency-conflict" });
  });

  it("rejects incomplete, empty-evidence, and mismatched operation shapes", () => {
    assert.equal(isCanonicalApprovalPayload(original), true);
    assert.equal(isCanonicalApprovalPayload({ ...original, evidenceRefs: [] }), false);
    assert.equal(isCanonicalApprovalPayload({
      ...original,
      operations: [{ ...original.operations[0], projectId: 7 }],
    }), false);
    assert.equal(isCanonicalApprovalPayload({
      version: 1, kind: "source_suppression", action: "suppress",
      approvalId: original.approvalId, candidateId: "b".repeat(64),
      sourceRefs: ["gmail:thread:exact", "gmail:thread:unrelated"], emailHash: "a".repeat(64),
      expectedRecordVersion: "1", disposition: "spam", itemId: "source:item",
      workUnitId: "source:thread", cadIds: [], label: "Daniel", wording: "Rejected",
      requiresFounderApproval: true,
    }), false);
  });

  it("fails source suppression closed when the Candidate lacks retained verified email identity", () => {
    const suppression = {
      version: 1 as const, kind: "source_suppression" as const, action: "suppress" as const,
      approvalId: original.approvalId, candidateId: "b".repeat(64), sourceRefs: ["gmail:thread:exact"],
      emailHash: "a".repeat(64), expectedRecordVersion: "1", disposition: "spam" as const,
      itemId: "source:item", workUnitId: "source:thread", cadIds: [], label: "Daniel",
      wording: "Rejected", requiresFounderApproval: true as const,
    };
    assert.equal(sourceSuppressionBindingError(suppression, {
      source_system: "gmail", source_ref: "gmail:thread:exact", record_version: 1,
      payload: { kind: "person_association", emailHash: "a".repeat(64) },
    }), null);
    assert.equal(sourceSuppressionBindingError(suppression, {
      source_system: "gmail", source_ref: "gmail:thread:exact", record_version: 1,
      payload: { kind: "open_job", jobKind: "required_action" },
    }), "candidate-email-identity-unsupported");
    assert.equal(sourceSuppressionBindingError(suppression, {
      source_system: "gmail", source_ref: "gmail:thread:other", record_version: 1,
      payload: { kind: "person_association", emailHash: "a".repeat(64) },
    }), "candidate-source-ref-mismatch");
  });
});
