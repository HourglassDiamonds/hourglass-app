import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { buildSterlingTodayWorkingSet } from "./working-set";
import { requestSterlingTodayProposal } from "./request";
import { validateSterlingTodayProposal } from "./validate";
import { STERLING_TODAY_PROPOSAL_VERSION, type SterlingTodayProposal } from "./types";

const projectId = "11111111-1111-4111-8111-111111111111";
const personId = "22222222-2222-4222-8222-222222222222";
const otherPersonId = "33333333-3333-4333-8333-333333333333";
const jobId = "44444444-4444-4444-8444-444444444444";

function summary(): ProjectDeskSummary {
  return { projectId, title: "Abbey / C026137", projectKind: "custom_new_jewelry",
    people: [{ personId, displayName: "Abbey", roles: ["client"], organizationName: null }],
    specs: [{ fieldName: "cad_job_number", label: "CAD", value: "C026137" }], latestNoteAt: null,
    latestNotePreview: null, coverage: { people: "available", specs: "available", notes: "none", jobs: "available", files: "none", email: "not-connected" },
    recordCreatedAt: "2026-10-01T00:00:00.000Z", projectWork: {} as never, lifecycleStage: "cad", lifecycleLabel: "CAD", gmailThreadId: "thread-1" };
}
function job(): ProjectJob {
  return { jobId, projectId, kind: "commitment", subject: "Send CAD", detail: null, waitingOnActor: "founder",
    associatedPersonId: personId, state: "open", dueAt: null, deferredUntil: null, resolvedAt: null,
    cancelledAt: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-07T12:00:00.000Z",
    createdBy: "founder", sourceSystem: "gmail", sourceRef: "gmail:message:m1", createdMutationId: "55555555-5555-4555-8555-555555555555" };
}
function candidate(): ContinuumCandidate {
  return { candidateId: "candidate-1", sourceSystem: "gmail", sourceRef: "gmail:thread:thread-1:message:m1",
    sourceTimestamp: "2026-10-07T13:00:00.000Z", candidateType: "note", proposedTarget: { kind: "project", projectId },
    payload: { kind: "note", text: "Attached is the updated CAD for you to review.", contextLayer: null }, confidence: "high",
    evidenceBasis: { ruleIds: ["fixture"], matchedText: "Attached is the updated CAD for you to review." },
    candidateState: "active", reviewStatus: "pending", lastReviewAction: null, founderEditedPayload: null,
    founderEditedTarget: null, reviewedAt: null, createdAt: "2026-10-07T13:00:00.000Z", canonical: false,
    automaticApply: false, parserVersion: "fixture", supersedesCandidateId: null, supersededByCandidateId: null };
}
function workingSet() {
  return buildSterlingTodayWorkingSet({ runId: "run-1", sourceWatermark: "wm-1", generatedAt: "2026-10-08T12:00:00.000Z",
    projects: [summary()], jobs: [job()], candidates: [candidate()], knownPeople: [
      { personId, displayName: "Abbey", roles: ["client"], organizationName: null, emailHash: "a".repeat(64) },
      { personId: otherPersonId, displayName: "Other", roles: ["client"], organizationName: null, emailHash: "b".repeat(64) },
    ], threadContext: new Map([["thread-1", { subject: "C026137 CAD", messages: [{ messageId: "m1", sentAt: "2026-10-07T13:00:00.000Z",
      direction: "outbound", fromEmailHash: "a".repeat(64), operationalText: "Attached is the updated CAD for you to review.", attachmentFilenames: ["C026137.pdf"] }] }]]) });
}
function proposal(): SterlingTodayProposal {
  const set = workingSet(); const evidenceId = set.evidence[0]!.evidenceId; const project = set.projects[0]!; const openJob = set.jobs[0]!;
  return { contractVersion: STERLING_TODAY_PROPOSAL_VERSION, runId: set.runId, evidenceSnapshotId: set.evidenceSnapshotId,
    generatedAt: set.generatedAt, portfolioAmbiguities: [], recommendations: [{ itemId: "abbey", category: "waiting_on_client",
      projectId, personId, relationshipRole: "client", title: "Abbey CAD", summary: "CAD delivered; Abbey has the next step.",
      responsibleParty: "client", confidence: "high", explanation: "The newer outbound delivery fulfills the founder obligation.",
      evidenceRefs: [evidenceId], ambiguities: [], projectStage: { stage: "client_approval", confidence: "high", explanation: "Client review follows delivery.", evidenceRefs: [evidenceId] },
      obligations: [{ obligationId: "send-cad", description: "Founder sends CAD", status: "fulfilled", responsibleParty: "founder", confidence: "high", evidenceRefs: [evidenceId] }] }],
    proposedCanonicalMutations: [{ proposalKey: "resolve-send-cad", kind: "resolve_open_job", projectId, personId,
      jobId, expectedRecordVersion: openJob.recordVersion, targetLifecycleStage: null, targetJobState: "resolved",
      targetResponsibleParty: null, newJob: null, reason: "Delivery fulfilled the obligation.", evidenceRefs: [evidenceId], requiresFounderApproval: true }] };
}

describe("Sterling-native Today", () => {
  it("assembles full associated chronology without treating unknown contacts as clients", () => {
    const set = workingSet();
    assert.equal(set.mutationMode, "shadow_read_only");
    assert.ok(set.evidence.length >= 1);
    assert.equal(set.evidence.find(row => row.sourceType === "gmail")?.excerpt, "Attached is the updated CAD for you to review.");
    assert.deepEqual(set.projects[0]?.gmailThreadIds, ["thread-1"]);
    assert.equal(set.projects[0]?.people[0]?.relationshipRole, "client");
  });

  it("accepts grounded presentation and approves a version-matched mutation only for founder review", () => {
    const set = workingSet(); const result = validateSterlingTodayProposal(set, proposal());
    assert.equal(result.accepted, true); assert.equal(result.mutationValidations[0]?.status, "approved_for_founder_review");
    assert.match(result.mutationValidations[0]?.rollback ?? "", /restore/i);
  });

  it("rejects cross-client collisions, unknown evidence, and stale versions without semantic reinterpretation", () => {
    const set = workingSet(); const raw = structuredClone(proposal());
    raw.recommendations[0]!.personId = otherPersonId;
    raw.recommendations[0]!.evidenceRefs = ["missing"];
    raw.proposedCanonicalMutations[0]!.expectedRecordVersion = "stale";
    const result = validateSterlingTodayProposal(set, raw);
    assert.equal(result.accepted, false);
    assert.ok(result.errors.some(row => row.includes("cross-client-collision")));
    assert.ok(result.errors.some(row => row.includes("unknown-evidence")));
    assert.ok(result.mutationValidations[0]?.reasons.includes("stale-job-version"));
  });

  it("sends one strict no-tools Structured Output request", async () => {
    const expected = proposal(); const bodies: Record<string, unknown>[] = [];
    const result = await requestSterlingTodayProposal({ apiKey: "test", model: "gpt-6-sol", workingSet: workingSet(),
      fetchImpl: async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ output_text: JSON.stringify(expected) }), { status: 200 }); } });
    const body = bodies[0]!;
    assert.equal(result.proposal.contractVersion, STERLING_TODAY_PROPOSAL_VERSION);
    assert.equal((body.text as { format?: { strict?: boolean } })?.format?.strict, true);
    assert.equal("tools" in body, false);
  });
});
