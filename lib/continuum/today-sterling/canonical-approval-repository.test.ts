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

function fakeClient() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const row = {
    proposal_id: original.approvalId,
    proposal_type: original.kind,
    status: "proposed",
    record_version: 4,
    original_proposal: original,
    approved_payload: null,
    founder_decision: null,
    execution_status: "not_requested",
    execution_receipt: null,
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
