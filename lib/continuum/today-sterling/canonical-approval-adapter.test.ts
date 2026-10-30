import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  prepareSterlingCanonicalApprovals,
  prepareSterlingSourceSuppression,
  prepareSterlingSourceSuppressionCompensation,
} from "./canonical-approval-adapter";
import type { SterlingTodayProposal, SterlingTodayValidationResult, SterlingTodayWorkingSet } from "./types";

function fixture() {
  const workingSet = {
    contractVersion: "sterling-today-working-set-v3", runId: "00000000-0000-5000-8000-000000000001",
    evidenceSnapshotId: "snapshot", sourceWatermark: "watermark", generatedAt: "2026-10-30T12:00:00.000Z", mutationMode: "shadow_read_only",
    people: [{ personId: "00000000-0000-5000-8000-000000000030", displayName: "Dylan", roles: ["client"], organizationName: null, emailHashes: [] }],
    projects: [{ projectId: "00000000-0000-5000-8000-000000000010", title: "Dylan", projectKind: "custom_new_jewelry", lifecycleStage: "production", recordVersion: "project-v1", people: [{ personId: "00000000-0000-5000-8000-000000000030", relationshipRole: "client" }], specs: [], openJobIds: ["00000000-0000-5000-8000-000000000020"], gmailThreadIds: [] }],
    jobs: [{ jobId: "00000000-0000-5000-8000-000000000020", projectId: "00000000-0000-5000-8000-000000000010", associatedPersonId: "00000000-0000-5000-8000-000000000030", kind: "follow_up", subject: "Deliver", detail: null, responsibleParty: "founder", state: "open", dueAt: null, deferredUntil: null, sourceRef: "gmail:thread:t-dylan", recordVersion: "2026-10-30T12:00:00.000Z" }],
    evidence: [{ evidenceId: "e-founder", sourceType: "founder_directive", sourceRef: "candidate:daniel", timestamp: "2026-10-30T12:00:00.000Z", direction: "unknown", subject: null, excerpt: "Delivered", attachmentFilenames: [], messageId: null, threadId: null, projectIds: ["00000000-0000-5000-8000-000000000010"], personIds: [], provenance: "founder_correction" }],
    workUnits: [], calendarAvailability: { status: "disabled", reason: null }, calendar: [], previousToday: [],
  } as SterlingTodayWorkingSet;
  const proposal = {
    contractVersion: "sterling-today-proposal-v6", runId: workingSet.runId, evidenceSnapshotId: workingSet.evidenceSnapshotId,
    generatedAt: workingSet.generatedAt, portfolioAssessments: [], recommendations: [], relationshipProposals: [], portfolioAmbiguities: [],
    proposedCanonicalMutations: [
      { proposalKey: "lifecycle", kind: "set_project_lifecycle", projectId: workingSet.projects[0]!.projectId, personId: workingSet.people[0]!.personId, jobId: null, expectedRecordVersion: "project-v1", targetLifecycleStage: "completed", targetJobState: null, targetResponsibleParty: null, newJob: null, reason: "Founder complete", evidenceRefs: ["e-founder"], requiresFounderApproval: true },
      { proposalKey: "resolve", kind: "resolve_open_job", projectId: workingSet.projects[0]!.projectId, personId: workingSet.people[0]!.personId, jobId: workingSet.jobs[0]!.jobId, expectedRecordVersion: workingSet.jobs[0]!.recordVersion, targetLifecycleStage: null, targetJobState: "resolved", targetResponsibleParty: null, newJob: null, reason: "Obligation complete", evidenceRefs: ["e-founder"], requiresFounderApproval: true },
    ],
  } as SterlingTodayProposal;
  const validation = { accepted: true, proposal, errors: [], mutationValidations: [
    { proposalKey: "lifecycle", validationId: "v1", status: "approved_for_founder_review", reasons: [], rollback: "compensate" },
    { proposalKey: "resolve", validationId: "v2", status: "approved_for_founder_review", reasons: [], rollback: "compensate" },
  ] } as SterlingTodayValidationResult;
  return { workingSet, proposal, validation };
}

describe("Sterling canonical approval preparation", () => {
  it("groups related versioned operations into one founder approval envelope", () => {
    const result = prepareSterlingCanonicalApprovals(fixture());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.envelopes.length, 1);
    assert.deepEqual(result.envelopes[0]!.operations.map((row) => row.kind), ["set_project_lifecycle", "resolve_open_job"]);
    assert.equal(result.envelopes[0]!.projectKind, "custom_new_jewelry");
    assert.ok(result.envelopes[0]!.operations.every((row) => row.personId === fixture().workingSet.people[0]!.personId));
    assert.equal(result.envelopes[0]!.requiresFounderApproval, true);
  });

  it("fails closed when any mutation lacks a reviewable validation", () => {
    const input = fixture();
    const validation = {
      ...input.validation,
      mutationValidations: [
        input.validation.mutationValidations[0]!,
        { ...input.validation.mutationValidations[1]!, status: "rejected" as const, reasons: ["stale-job-version"] },
      ],
    };
    const result = prepareSterlingCanonicalApprovals({ ...input, validation });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.reasons, ["mutation-not-reviewable:resolve"]);
  });

  it("requires candidate, exact source refs, verified hash, and version for suppression", () => {
    const input = { candidateId: "b".repeat(64), sourceRefs: ["gmail:thread:exact"], emailHash: "a".repeat(64), expectedRecordVersion: "1", disposition: "spam" as const, itemId: "source:item", workUnitId: "source:thread", cadIds: [], label: "Daniel Iles", wording: "Rejected junk." };
    assert.equal(prepareSterlingSourceSuppression({ ...input, sourceRefs: [] }), null);
    assert.equal(prepareSterlingSourceSuppression({ ...input, sourceRefs: [...input.sourceRefs, "gmail:thread:unrelated"] }), null);
    const prepared = prepareSterlingSourceSuppression(input);
    assert.equal(prepared?.requiresFounderApproval, true);
    assert.deepEqual(prepared?.sourceRefs, ["gmail:thread:exact"]);
    const restored = prepareSterlingSourceSuppressionCompensation({
      candidateId: input.candidateId, sourceRefs: input.sourceRefs, emailHash: input.emailHash,
      expectedRecordVersion: "2", disposition: "spam",
      compensatesProposalId: prepared!.approvalId,
    });
    assert.equal(restored?.action, "restore");
    assert.equal(prepareSterlingSourceSuppressionCompensation({
      candidateId: input.candidateId, sourceRefs: [...input.sourceRefs, "gmail:thread:unrelated"],
      emailHash: input.emailHash, expectedRecordVersion: "2", disposition: "spam",
      compensatesProposalId: prepared!.approvalId,
    }), null);
  });
});
