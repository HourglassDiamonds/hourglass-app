import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { buildSterlingTodayWorkingSet } from "./working-set";
import { requestSterlingTodayProposal, resolveSterlingTodayTimeoutMs, STERLING_TODAY_TIMEOUT_ENV,
  STERLING_TODAY_TIMEOUT_MS, SterlingTodayRequestError } from "./request";
import { evaluateSterlingTodayAcceptance } from "./acceptance";
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
  const set = workingSet(); const workUnit = set.workUnits[0]!; const evidenceId = workUnit.evidenceRefs[0]!;
  const project = set.projects[0]!; const openJob = set.jobs[0]!;
  return { contractVersion: STERLING_TODAY_PROPOSAL_VERSION, runId: set.runId, evidenceSnapshotId: set.evidenceSnapshotId,
    generatedAt: set.generatedAt, portfolioAmbiguities: [], portfolioAssessments: [{ workUnitId: workUnit.workUnitId,
      projectId, identityStatus: "canonical_project", todayDisposition: "presented", recommendationItemId: "abbey",
      currentStage: { stage: "client_approval", responsibleParty: "client", confidence: "high",
        explanation: "Client review follows delivery.", evidenceRefs: [evidenceId] },
      obligations: [{ obligationId: "send-cad", description: "Founder sends CAD", status: "fulfilled",
        responsibleParty: "founder", confidence: "high", evidenceRefs: [evidenceId] }],
      nextStepOwner: "client", confidence: "high", evidenceRefs: [evidenceId], ambiguities: [],
      explanation: "CAD delivered; the client owns the next step.", omissionReason: null }],
    recommendations: [{ itemId: "abbey", workUnitId: workUnit.workUnitId, category: "waiting_on_client",
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
    assert.equal(set.calendarAvailability.status, "unavailable");
    assert.ok(set.evidence.length >= 1);
    assert.equal(set.workUnits.length, 1);
    assert.equal(set.workUnits[0]?.kind, "canonical_project");
    assert.equal(set.evidence.find(row => row.sourceType === "gmail")?.excerpt, "Attached is the updated CAD for you to review.");
    assert.deepEqual(set.projects[0]?.gmailThreadIds, ["thread-1"]);
    assert.equal(set.projects[0]?.people[0]?.relationshipRole, "client");
  });

  it("creates deduplicated provisional work only from exact identifiers or exact source identity", () => {
    const thread = (messageId: string) => ({ subject: "C026137 production", messages: [{ messageId,
      sentAt: "2026-10-07T13:00:00.000Z", direction: "inbound" as const, fromEmailHash: null,
      operationalText: "Production update for C026137.", attachmentFilenames: [] }] });
    const set = buildSterlingTodayWorkingSet({ runId: "run-provisional", sourceWatermark: "wm", generatedAt: "2026-10-08T12:00:00.000Z",
      projects: [], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([["thread-a", thread("m-a")], ["thread-b", thread("m-b")]]) });
    assert.equal(set.workUnits.length, 1);
    assert.equal(set.workUnits[0]?.kind, "provisional_evidence");
    assert.equal(set.workUnits[0]?.identityBasis, "exact_identifier");
    assert.equal(set.workUnits[0]?.projectId, null);
    assert.deepEqual(set.workUnits[0]?.threadIds, ["thread-a", "thread-b"]);
    assert.equal(set.workUnits[0]?.evidenceRefs.length, 2);
  });

  it("keeps a thread with conflicting exact identifiers provisional instead of cross-linking projects", () => {
    const first = { ...summary(), gmailThreadId: null };
    const secondId = "66666666-6666-4666-8666-666666666666";
    const second = { ...summary(), projectId: secondId, title: "Other / C017756", gmailThreadId: null,
      specs: [{ fieldName: "cad_job_number" as const, label: "CAD", value: "C017756" }] };
    const set = buildSterlingTodayWorkingSet({ runId: "run-conflict", sourceWatermark: "wm", generatedAt: "2026-10-08T12:00:00.000Z",
      projects: [first, second], jobs: [], candidates: [], knownPeople: [], threadContext: new Map([["thread-conflict", {
        subject: "Project references", messages: [{ messageId: "m-conflict-1", sentAt: "2026-10-07T13:00:00.000Z",
          direction: "inbound", fromEmailHash: null, operationalText: "References C026137.", attachmentFilenames: [] },
        { messageId: "m-conflict-2", sentAt: "2026-10-07T14:00:00.000Z",
          direction: "inbound", fromEmailHash: null, operationalText: "References C017756.", attachmentFilenames: [] }],
      }]]) });
    const gmailEvidence = set.evidence.find(row => row.threadId === "thread-conflict");
    assert.deepEqual(gmailEvidence?.projectIds, []);
    assert.equal(set.workUnits.filter(row => row.kind === "provisional_evidence").length, 1);
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

  it("allows provisional presentation but rejects an unlinked canonical Job proposal", () => {
    const set = workingSet(); const raw = structuredClone(proposal());
    const unit = set.workUnits[0]!;
    (unit as { kind: string }).kind = "provisional_evidence";
    (unit as { identityBasis: string }).identityBasis = "source_thread";
    (unit as { projectId: string | null }).projectId = null;
    raw.portfolioAssessments[0]!.projectId = null;
    raw.portfolioAssessments[0]!.identityStatus = "provisional_evidence";
    raw.recommendations[0]!.projectId = null;
    raw.recommendations[0]!.personId = null;
    const mutation = raw.proposedCanonicalMutations[0]!;
    mutation.kind = "create_open_job";
    mutation.projectId = null;
    mutation.personId = null;
    mutation.jobId = null;
    mutation.expectedRecordVersion = null;
    mutation.targetJobState = null;
    mutation.newJob = { kind: "follow_up", subject: "Review provisional work", detail: null,
      responsibleParty: "founder", dueAt: null };
    const result = validateSterlingTodayProposal(set, raw);
    assert.equal(result.accepted, true);
    assert.equal(result.mutationValidations[0]?.status, "rejected");
    assert.ok(result.mutationValidations[0]?.reasons.includes("canonical-project-required"));
  });

  it("rejects silent portfolio disappearance and assessment/presentation drift", () => {
    const set = workingSet();
    const missing = structuredClone(proposal());
    missing.portfolioAssessments = [];
    assert.ok(validateSterlingTodayProposal(set, missing).errors.some(row => row.startsWith("missing-work-unit-assessment:")));
    assert.equal(evaluateSterlingTodayAcceptance(set, missing).cases.find(row => row.id === "ABBEY/C026137")?.outcome, "missing_output");

    const drifted = structuredClone(proposal());
    drifted.recommendations[0]!.projectStage.stage = "production";
    drifted.recommendations[0]!.obligations = [];
    const result = validateSterlingTodayProposal(set, drifted);
    assert.ok(result.errors.includes("project-stage-reconciliation-mismatch:abbey"));
    assert.ok(result.errors.includes("obligation-count-mismatch:abbey"));
  });

  it("reports a present item in the wrong lane instead of calling it absent", () => {
    const set = workingSet(); const raw = structuredClone(proposal());
    raw.recommendations[0]!.title = "Client decision";
    raw.recommendations[0]!.summary = "The next step remains external.";
    raw.recommendations[0]!.explanation = "Current evidence assigns the next step externally.";
    raw.recommendations[0]!.category = "held_watching";
    const abbey = evaluateSterlingTodayAcceptance(set, raw).cases.find(row => row.id === "ABBEY/C026137");
    assert.equal(abbey?.outcome, "wrong_category");
    assert.notEqual(abbey?.actual, "absent");
  });

  it("sends one strict no-tools Structured Output request", async () => {
    const expected = proposal(); const bodies: Record<string, unknown>[] = [];
    const result = await requestSterlingTodayProposal({ apiKey: "test", model: "gpt-6-sol", workingSet: workingSet(),
      fetchImpl: async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ output_text: JSON.stringify(expected) }), { status: 200 }); } });
    const body = bodies[0]!;
    assert.equal(result.proposal.contractVersion, STERLING_TODAY_PROPOSAL_VERSION);
    assert.equal((body.text as { format?: { strict?: boolean } })?.format?.strict, true);
    assert.equal(body.store, false);
    assert.ok(((body.text as { format?: { schema?: { required?: string[] } } })?.format?.schema?.required ?? []).includes("portfolioAssessments"));
    assert.equal("tools" in body, false);
  });

  it("uses a 180-second default timeout and accepts a server-side environment override", () => {
    const previous = process.env[STERLING_TODAY_TIMEOUT_ENV];
    try {
      delete process.env[STERLING_TODAY_TIMEOUT_ENV];
      assert.equal(STERLING_TODAY_TIMEOUT_MS, 180_000);
      assert.equal(resolveSterlingTodayTimeoutMs(), 180_000);
      process.env[STERLING_TODAY_TIMEOUT_ENV] = "240000";
      assert.equal(resolveSterlingTodayTimeoutMs(), 240_000);
      process.env[STERLING_TODAY_TIMEOUT_ENV] = "not-a-timeout";
      assert.equal(resolveSterlingTodayTimeoutMs(), 180_000);
      assert.equal(resolveSterlingTodayTimeoutMs(25), 25);
    } finally {
      if (previous === undefined) delete process.env[STERLING_TODAY_TIMEOUT_ENV];
      else process.env[STERLING_TODAY_TIMEOUT_ENV] = previous;
    }
  });

  it("reports a local abort as an explicit timeout without exposing request data", async () => {
    const fetchImpl: typeof fetch = async (_url, init) => await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")), { once: true });
    });
    await assert.rejects(
      requestSterlingTodayProposal({ apiKey: "secret-key", model: "gpt-5.6-sol", workingSet: workingSet(), fetchImpl, timeoutMs: 5 }),
      (error: unknown) => {
        assert.ok(error instanceof SterlingTodayRequestError);
        assert.equal(error.kind, "timeout");
        assert.match(error.message, /kind=timeout:timeoutMs=5/);
        assert.doesNotMatch(error.message, /secret-key|C026137/);
        return true;
      },
    );
  });

  it("preserves safe API diagnostics without copying the response body or private text", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ error: {
      code: "rate_limit_exceeded", type: "requests", param: "model",
      message: "Private evidence from C026137 must never enter diagnostics.",
    } }), { status: 429, headers: { "x-request-id": "req_safe123" } });
    await assert.rejects(
      requestSterlingTodayProposal({ apiKey: "secret-key", model: "gpt-5.6-sol", workingSet: workingSet(), fetchImpl }),
      (error: unknown) => {
        assert.ok(error instanceof SterlingTodayRequestError);
        assert.equal(error.kind, "api");
        assert.equal(error.status, 429);
        assert.equal(error.code, "rate_limit_exceeded");
        assert.equal(error.apiType, "requests");
        assert.equal(error.param, "model");
        assert.equal(error.requestId, "req_safe123");
        assert.match(error.message, /status=429:code=rate_limit_exceeded:type=requests:param=model:requestId=req_safe123/);
        assert.doesNotMatch(error.message, /Private evidence|C026137|secret-key/);
        return true;
      },
    );
  });
});
