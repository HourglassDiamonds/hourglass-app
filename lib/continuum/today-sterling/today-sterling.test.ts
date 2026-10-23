import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import { buildSterlingTodayWorkingSet } from "./working-set";
import { requestSterlingTodayProposal, resolveSterlingTodayTimeoutMs, STERLING_TODAY_TIMEOUT_ENV,
  STERLING_TODAY_MAX_OUTPUT_TOKENS, STERLING_TODAY_REASONING_EFFORT, STERLING_TODAY_TIMEOUT_MS,
  SterlingTodayRequestError } from "./request";
import { evaluateSterlingTodayAcceptance } from "./acceptance";
import { createSterlingEvidenceHandleMap } from "./evidence-handles";
import { buildSterlingTodayTargetWorkingSet, summarizeSterlingTodayTargetPackage } from "./target";
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
  const openJob = set.jobs[0]!;
  return { contractVersion: STERLING_TODAY_PROPOSAL_VERSION, runId: set.runId, evidenceSnapshotId: set.evidenceSnapshotId,
    generatedAt: set.generatedAt, portfolioAmbiguities: [], portfolioAssessments: [{ workUnitId: workUnit.workUnitId,
      projectId, identityStatus: "canonical_project", todayDisposition: "presented", recommendationItemId: "abbey",
      currentStage: { canonicalLifecycleStage: "client_approval", operationalSubstage: null,
        responsibleParty: "client", confidence: "high",
        explanation: "Client review follows delivery.", evidenceRefs: [evidenceId] },
      obligations: [{ obligationId: "send-cad", description: "Founder sends CAD", status: "fulfilled",
        responsibleParty: "founder", confidence: "high", evidenceRefs: [evidenceId] }],
      nextStepOwner: "client", confidence: "high", evidenceRefs: [evidenceId], ambiguities: [],
      explanation: "CAD delivered; the client owns the next step.", omissionReason: null }],
    recommendations: [{ itemId: "abbey", workUnitId: workUnit.workUnitId, category: "waiting_on_client",
      projectId, personId, relationshipRole: "client", title: "Abbey CAD", summary: "CAD delivered; Abbey has the next step.",
      confidence: "high", explanation: "The newer outbound delivery fulfills the founder obligation.",
      evidenceRefs: [evidenceId], ambiguities: [],
      obligations: [{ obligationId: "send-cad", description: "Founder sends CAD", status: "fulfilled", responsibleParty: "founder", confidence: "high", evidenceRefs: [evidenceId] }] }],
    relationshipProposals: [],
    proposedCanonicalMutations: [{ proposalKey: "resolve-send-cad", kind: "resolve_open_job", projectId, personId,
      jobId, expectedRecordVersion: openJob.recordVersion, targetLifecycleStage: null, targetJobState: "resolved",
      targetResponsibleParty: null, newJob: null, reason: "Delivery fulfilled the obligation.", evidenceRefs: [evidenceId], requiresFounderApproval: true }] };
}

function proposalWithEvidenceRef(evidenceRef: string): SterlingTodayProposal {
  const raw = structuredClone(proposal());
  for (const assessment of raw.portfolioAssessments) {
    assessment.evidenceRefs = [evidenceRef];
    assessment.currentStage.evidenceRefs = [evidenceRef];
    for (const obligation of assessment.obligations) obligation.evidenceRefs = [evidenceRef];
  }
  for (const recommendation of raw.recommendations) {
    recommendation.evidenceRefs = [evidenceRef];
    for (const obligation of recommendation.obligations) obligation.evidenceRefs = [evidenceRef];
  }
  for (const mutation of raw.proposedCanonicalMutations) mutation.evidenceRefs = [evidenceRef];
  return raw;
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

  it("keeps active projectless jobs visible without linking replies by Person or email identity alone", () => {
    const intakeJob = { ...job(), jobId: "intake-job", projectId: null, associatedPersonId: personId,
      subject: "Website inquiry", sourceSystem: "human-intake" as const, sourceRef: "website-intake:intake-1" };
    const set = buildSterlingTodayWorkingSet({ runId: "run-intake", sourceWatermark: "wm",
      generatedAt: "2026-10-22T12:00:00.000Z", projects: [], jobs: [intakeJob], candidates: [],
      knownPeople: [{ personId, displayName: "Prospect", roles: ["prospect"], organizationName: null,
        emailHash: "a".repeat(64) }],
      threadContext: new Map([["reply-thread", { subject: "Reply", messages: [{ messageId: "reply-1",
        sentAt: "2026-10-21T18:22:00.000Z", direction: "outbound", fromEmailHash: "f".repeat(64),
        toEmailHashes: ["a".repeat(64)], operationalText: "Founder first contact.", attachmentFilenames: [] }] }]]),
    });
    const unit = set.workUnits.find((row) => row.sourceRefs.includes("website-intake:intake-1"));
    assert.equal(unit?.kind, "provisional_evidence");
    assert.equal(unit?.identityBasis, "source_record");
    assert.deepEqual(unit?.threadIds, []);
    assert.ok(unit?.evidenceRefs.includes("canonical:job:intake-job"));
    assert.equal(unit?.evidenceRefs.includes("gmail:reply-thread:reply-1"), false);
    assert.equal(unit?.projectId, null);
    assert.equal(set.workUnits.some((row) => row.threadIds.includes("reply-thread")), true);
  });

  it("attaches a projectless job only to its exact canonical source thread", () => {
    const threadId = "1a1234567890abcd";
    const intakeJob = { ...job(), jobId: "intake-job", projectId: null, associatedPersonId: personId,
      subject: "Website inquiry", sourceRef: `gc1|${threadId}|1b1234567890abcd` };
    const set = buildSterlingTodayWorkingSet({ runId: "run-exact-source", sourceWatermark: "wm",
      generatedAt: "2026-10-22T12:00:00.000Z", projects: [], jobs: [intakeJob], candidates: [], knownPeople: [],
      threadContext: new Map([[threadId, { subject: "Reply", messages: [{ messageId: "1b1234567890abcd",
        sentAt: "2026-10-21T18:22:00.000Z", direction: "outbound", fromEmailHash: null,
        operationalText: "Founder first contact.", attachmentFilenames: [] }] }]]) });
    const unit = set.workUnits.find((row) => row.sourceRefs.includes(intakeJob.sourceRef));
    assert.deepEqual(unit?.threadIds, [threadId]);
  });

  it("does not let a shared vendor Person merge unrelated client conversations", () => {
    const vendorPersonId = personId;
    const projectless = { ...job(), jobId: "vendor-job", projectId: null, associatedPersonId: vendorPersonId,
      subject: "Check vendor pricing", sourceRef: "manual:vendor-job" };
    const set = buildSterlingTodayWorkingSet({ runId: "run-vendor-isolation", sourceWatermark: "wm",
      generatedAt: "2026-10-22T12:00:00.000Z", projects: [], jobs: [projectless], candidates: [],
      knownPeople: [{ personId: vendorPersonId, displayName: "Shared Vendor", roles: ["vendor"],
        organizationName: "Vendor", emailHash: "a".repeat(64) }],
      threadContext: new Map([
        ["client-a", { subject: "C026143", messages: [{ messageId: "ma", sentAt: "2026-10-21T10:00:00.000Z",
          direction: "inbound", fromEmailHash: "a".repeat(64), operationalText: "C026143 update", attachmentFilenames: [] }] }],
        ["client-b", { subject: "C010841", messages: [{ messageId: "mb", sentAt: "2026-10-21T11:00:00.000Z",
          direction: "inbound", fromEmailHash: "a".repeat(64), operationalText: "C010841 update", attachmentFilenames: [] }] }],
      ]) });
    const unit = set.workUnits.find((row) => row.sourceRefs.includes(projectless.sourceRef));
    assert.deepEqual(unit?.threadIds, []);
    assert.equal(set.workUnits.filter((row) => row.threadIds.length > 0).length, 2);
  });

  it("does not join projectless work through an ambiguous email hash", () => {
    const intakeJob = { ...job(), jobId: "intake-job", projectId: null, associatedPersonId: personId,
      subject: "Website inquiry", sourceRef: "website-intake:intake-1" };
    const sharedHash = "a".repeat(64);
    const set = buildSterlingTodayWorkingSet({ runId: "run-intake-conflict", sourceWatermark: "wm",
      generatedAt: "2026-10-22T12:00:00.000Z", projects: [], jobs: [intakeJob], candidates: [],
      knownPeople: [
        { personId, displayName: "First", roles: ["prospect"], organizationName: null, emailHash: sharedHash },
        { personId: otherPersonId, displayName: "Second", roles: ["prospect"], organizationName: null, emailHash: sharedHash },
      ], threadContext: new Map([["conflict-thread", { subject: "Reply", messages: [{ messageId: "m1",
        sentAt: "2026-10-21T18:22:00.000Z", direction: "inbound", fromEmailHash: sharedHash,
        operationalText: "Conflicting identity.", attachmentFilenames: [] }] }]]) });
    const unit = set.workUnits.find((row) => row.sourceRefs.includes("website-intake:intake-1"));
    assert.deepEqual(unit?.threadIds, []);
    assert.equal(set.workUnits.some((row) => row.threadIds.includes("conflict-thread")), true);
  });

  it("keeps an uncontacted intake visible and deduplicates repeated webhook delivery by exact job identity", () => {
    const intakeJob = { ...job(), jobId: "intake-job", projectId: null, associatedPersonId: null,
      subject: "Website inquiry", sourceRef: "website-intake:intake-1" };
    const set = buildSterlingTodayWorkingSet({ runId: "run-intake-duplicate", sourceWatermark: "wm",
      generatedAt: "2026-10-22T12:00:00.000Z", projects: [], jobs: [intakeJob, { ...intakeJob }],
      candidates: [], knownPeople: [], threadContext: new Map() });
    const units = set.workUnits.filter((row) => row.sourceRefs.includes("website-intake:intake-1"));
    assert.equal(units.length, 1);
    assert.equal(units[0]?.identityBasis, "source_record");
    assert.deepEqual(units[0]?.threadIds, []);
    assert.ok(units[0]?.evidenceRefs.includes("canonical:job:intake-job"));
  });

  it("groups only server-scoped exact threads without claiming canonical identity", () => {
    const thread = (messageId: string, subject: string) => ({ subject, messages: [{ messageId,
      sentAt: "2026-10-17T13:00:00.000Z", direction: "inbound" as const, fromEmailHash: null,
      operationalText: subject, attachmentFilenames: [] }] });
    const set = buildSterlingTodayWorkingSet({ runId: "run-scoped", sourceWatermark: "wm",
      generatedAt: "2026-10-19T12:00:00.000Z", projects: [], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([
        ["zane-direct", thread("z1", "Client follow-up")],
        ["zane-vendor", thread("z2", "Vendor quote")],
        ["unrelated", thread("u1", "Unrelated")],
      ]),
      explicitEvidenceGroups: [{ groupId: "zane", label: "ZANE/C026732", identifiers: ["C026732"],
        threadIds: ["zane-direct", "zane-vendor"] }],
    });
    const grouped = set.workUnits.find((row) => row.label === "ZANE/C026732");
    assert.equal(grouped?.identityBasis, "scoped_evidence_group");
    assert.equal(grouped?.projectId, null);
    assert.deepEqual(grouped?.threadIds, ["zane-direct", "zane-vendor"]);
    assert.equal(set.workUnits.some((row) => row.threadIds.includes("unrelated")), true);
  });

  it("types Nivoda order and certificate identifiers without treating them as project identity", () => {
    const set = buildSterlingTodayWorkingSet({ runId: "run-nivoda", sourceWatermark: "wm",
      generatedAt: "2026-10-19T12:00:00.000Z", projects: [], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([["nivoda", { subject: "Return LG819625099 / NIV-2609-13392551-2", messages: [{
        messageId: "n1", sentAt: "2026-10-18T12:00:00.000Z", direction: "inbound", fromEmailHash: null,
        operationalText: "Request 413451 has not arrived.", attachmentFilenames: [],
      }] }]]),
      explicitEvidenceGroups: [{ groupId: "nivoda", label: "NIVODA/RETURN",
        identifiers: ["LG819625099", "NIV-2609-13392551-2", "413451"], threadIds: ["nivoda"] }],
    });
    const unit = set.workUnits.find((row) => row.label === "NIVODA/RETURN")!;
    assert.deepEqual(unit.typedIdentifiers, [
      { kind: "certificate", value: "LG819625099" },
      { kind: "order", value: "NIV-2609-13392551-2" },
      { kind: "request", value: "413451" },
    ]);
    assert.equal(unit.identityBasis, "scoped_evidence_group");
  });

  it("types supplier identifiers from ordinary evidence without creating a canonical project", () => {
    const set = buildSterlingTodayWorkingSet({ runId: "run-nivoda-generic", sourceWatermark: "wm",
      generatedAt: "2026-10-22T12:00:00.000Z", projects: [], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([["nivoda", { subject: "Return NIV-2609-13392551-2", messages: [{
        messageId: "n1", sentAt: "2026-10-21T12:00:00.000Z", direction: "inbound", fromEmailHash: null,
        operationalText: "Certificate LG819625099 request 413451.", attachmentFilenames: [],
      }] }]]) });
    const unit = set.workUnits[0]!;
    assert.equal(unit.kind, "provisional_evidence");
    assert.equal(unit.projectId, null);
    assert.deepEqual(unit.typedIdentifiers, [
      { kind: "order", value: "NIV-2609-13392551-2" },
      { kind: "certificate", value: "LG819625099" },
      { kind: "request", value: "413451" },
    ]);
  });

  it("joins a multi-identifier source to one repeated exact identifier without using a name", () => {
    const thread = (messageId: string, text: string) => ({ subject: text, messages: [{ messageId,
      sentAt: "2026-10-07T13:00:00.000Z", direction: "inbound" as const, fromEmailHash: null,
      operationalText: text, attachmentFilenames: [] }] });
    const set = buildSterlingTodayWorkingSet({ runId: "run-shared-identifier", sourceWatermark: "wm",
      generatedAt: "2026-10-08T12:00:00.000Z", projects: [], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([
        ["thread-a", thread("m-a", "C025885 SP13477 production")],
        ["thread-b", thread("m-b", "C025885 status")],
      ]) });
    assert.equal(set.workUnits.length, 1);
    assert.equal(set.workUnits[0]?.identityBasis, "exact_identifier");
    assert.deepEqual(set.workUnits[0]?.observedIdentifiers, ["C025885", "SP13477"]);
    assert.deepEqual(set.workUnits[0]?.threadIds, ["thread-a", "thread-b"]);
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

  it("builds a one-work-unit target package without logging evidence text", () => {
    const set = workingSet();
    const target = buildSterlingTodayTargetWorkingSet(set, set.workUnits[0]!.workUnitId);
    const manifest = summarizeSterlingTodayTargetPackage(target);
    assert.equal(target.workUnits.length, 1);
    assert.deepEqual(target.evidence.map(row => row.evidenceId), target.workUnits[0]!.evidenceRefs);
    assert.notEqual(target.evidenceSnapshotId, set.evidenceSnapshotId);
    assert.equal(manifest.chronology.length, target.evidence.length);
    assert.doesNotMatch(JSON.stringify(manifest), /Attached is the updated CAD/);
    assert.ok(manifest.chronology.every(row => !("excerpt" in row) && !("subject" in row)));
  });

  it("accepts grounded presentation and approves a version-matched mutation only for founder review", () => {
    const set = workingSet(); const result = validateSterlingTodayProposal(set, proposal());
    assert.equal(result.accepted, true); assert.equal(result.mutationValidations[0]?.status, "approved_for_founder_review");
    assert.match(result.mutationValidations[0]?.rollback ?? "", /restore/i);
  });

  it("validates founder-review relationship proposals against exact work-unit provenance", () => {
    const set = workingSet();
    const raw = structuredClone(proposal());
    raw.relationshipProposals = [{
      proposalKey: "existing-person-thread", kind: "associate_existing_person",
      workUnitId: set.workUnits[0]!.workUnitId, personId, projectId: null,
      threadIds: ["thread-1"], basis: "historical_thread_continuity", confidence: "high",
      reason: "The same verified sender identity continues an existing thread.",
      evidenceRefs: [set.workUnits[0]!.evidenceRefs[0]!], requiresFounderApproval: true,
    }];
    assert.equal(validateSterlingTodayProposal(set, raw).accepted, true);
    raw.relationshipProposals[0]!.personId = "99999999-9999-4999-8999-999999999999";
    const invalid = validateSterlingTodayProposal(set, raw);
    assert.equal(invalid.accepted, false);
    assert.ok(invalid.errors.some((row) => row.startsWith("invalid-existing-person-association:")));
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

  it("allows evidence-supported responsibility for provisional work but rejects an unlinked canonical Job proposal", () => {
    const set = workingSet(); const raw = structuredClone(proposal());
    const unit = set.workUnits[0]!;
    (unit as { kind: string }).kind = "provisional_evidence";
    (unit as { identityBasis: string }).identityBasis = "source_thread";
    (unit as { projectId: string | null }).projectId = null;
    raw.portfolioAssessments[0]!.projectId = null;
    raw.portfolioAssessments[0]!.identityStatus = "provisional_evidence";
    raw.portfolioAssessments[0]!.currentStage.responsibleParty = "client";
    raw.portfolioAssessments[0]!.nextStepOwner = "client";
    raw.recommendations[0]!.projectId = null;
    raw.recommendations[0]!.personId = null;
    raw.recommendations[0]!.relationshipRole = "unknown";
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
    assert.equal(raw.portfolioAssessments[0]!.nextStepOwner, "client");
    assert.equal(result.mutationValidations[0]?.status, "rejected");
    assert.ok(result.mutationValidations[0]?.reasons.includes("canonical-project-required"));
  });

  it("rejects silent portfolio disappearance", () => {
    const set = workingSet();
    const missing = structuredClone(proposal());
    missing.portfolioAssessments = [];
    assert.ok(validateSterlingTodayProposal(set, missing).errors.some(row => row.startsWith("missing-work-unit-assessment:")));
    assert.equal(evaluateSterlingTodayAcceptance(set, missing).cases.find(row => row.id === "ABBEY/C026137")?.outcome, "missing_output");

  });

  it("keeps portfolio stage and ownership authoritative by rejecting duplicate recommendation state", () => {
    const duplicate = structuredClone(proposal()) as unknown as { recommendations: Array<Record<string, unknown>> };
    duplicate.recommendations[0]!.projectStage = { canonicalLifecycleStage: "production" };
    duplicate.recommendations[0]!.responsibleParty = "vendor_shop";
    assert.deepEqual(validateSterlingTodayProposal(workingSet(), duplicate).errors, ["invalid-structured-contract"]);
  });

  it("allows Today to omit closed obligations but rejects loss of an actionable obligation", () => {
    const set = workingSet();
    const summarized = structuredClone(proposal());
    summarized.recommendations[0]!.obligations = [];
    assert.equal(validateSterlingTodayProposal(set, summarized).accepted, true);

    const missingAction = structuredClone(summarized);
    missingAction.portfolioAssessments[0]!.obligations[0]!.status = "open";
    const result = validateSterlingTodayProposal(set, missingAction);
    assert.ok(result.errors.includes("missing-actionable-obligation:abbey:send-cad"));
  });

  it("separates canonical lifecycle stage from descriptive operational substage", () => {
    const set = workingSet();
    const valid = structuredClone(proposal());
    valid.portfolioAssessments[0]!.currentStage.canonicalLifecycleStage = "production";
    valid.portfolioAssessments[0]!.currentStage.operationalSubstage = "paid_preproduction";
    assert.equal(validateSterlingTodayProposal(set, valid).accepted, true);

    const invalid = structuredClone(valid) as unknown as { portfolioAssessments: Array<{
      currentStage: { canonicalLifecycleStage: string } }> };
    invalid.portfolioAssessments[0]!.currentStage.canonicalLifecycleStage = "paid_preproduction";
    assert.deepEqual(validateSterlingTodayProposal(set, invalid).errors, ["invalid-structured-contract"]);
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
    const set = workingSet();
    const sourceEvidenceId = set.workUnits[0]!.evidenceRefs[0]!;
    const evidenceHandle = createSterlingEvidenceHandleMap(set).evidenceIdToHandle.get(sourceEvidenceId)!;
    const expected = proposalWithEvidenceRef(evidenceHandle); const bodies: Record<string, unknown>[] = [];
    const result = await requestSterlingTodayProposal({ apiKey: "test", model: "gpt-6-sol", workingSet: set,
      fetchImpl: async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({
        output_text: JSON.stringify(expected), usage: { input_tokens: 100, output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 80 }, total_tokens: 300 },
      }), { status: 200 }); } });
    const body = bodies[0]!;
    const requestWorkingSet = JSON.parse(String(body.input)) as ReturnType<typeof workingSet>;
    assert.equal(result.proposal.contractVersion, STERLING_TODAY_PROPOSAL_VERSION);
    assert.equal(result.proposal.portfolioAssessments[0]!.evidenceRefs[0], sourceEvidenceId);
    assert.equal(requestWorkingSet.workUnits[0]!.evidenceRefs[0], evidenceHandle);
    assert.ok(requestWorkingSet.evidence.every(row => /^E\d{4}$/.test(row.evidenceId)));
    assert.equal(result.usage.reasoningTokens, 80);
    assert.equal((body.text as { format?: { strict?: boolean } })?.format?.strict, true);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, STERLING_TODAY_MAX_OUTPUT_TOKENS);
    assert.equal((body.reasoning as { effort?: string })?.effort, STERLING_TODAY_REASONING_EFFORT);
    assert.match(String(body.instructions), /may omit fulfilled or superseded obligations/i);
    assert.ok(((body.text as { format?: { schema?: { required?: string[] } } })?.format?.schema?.required ?? []).includes("portfolioAssessments"));
    assert.equal("tools" in body, false);
  });

  it("enforces the Sarah output and total request-package bounds without truncation or a network call", async () => {
    const set = workingSet();
    const sourceEvidenceId = set.workUnits[0]!.evidenceRefs[0]!;
    const evidenceHandle = createSterlingEvidenceHandleMap(set).evidenceIdToHandle.get(sourceEvidenceId)!;
    let calls = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 8_000);
      assert.equal(body.truncation, "disabled");
      assert.equal("tools" in body, false);
      assert.equal("background" in body, false);
      assert.equal("conversation" in body, false);
      return new Response(JSON.stringify({ output_text: JSON.stringify(proposalWithEvidenceRef(evidenceHandle)) }),
        { status: 200 });
    };
    await requestSterlingTodayProposal({ apiKey: "test", model: "gpt-5.6-sol", workingSet: set,
      maxOutputTokens: 8_000, maxRequestBytes: 64_000, disableTruncation: true, fetchImpl });
    assert.equal(calls, 1);

    calls = 0;
    await assert.rejects(
      requestSterlingTodayProposal({ apiKey: "secret-key", model: "gpt-5.6-sol", workingSet: set,
        maxOutputTokens: 8_000, maxRequestBytes: 1, disableTruncation: true,
        fetchImpl: async () => { calls += 1; throw new Error("must not run"); } }),
      (error: unknown) => error instanceof SterlingTodayRequestError && error.kind === "input" &&
        error.code === "request-package-too-large" && !error.message.includes("secret-key"),
    );
    assert.equal(calls, 0);
  });

  it("rejects unknown handles and model-authored source IDs without echoing them", async () => {
    const set = workingSet();
    const rawSourceId = set.evidence.find(row => row.sourceType === "gmail")!.evidenceId;
    for (const invalidRef of ["E9999", rawSourceId]) {
      const result = await requestSterlingTodayProposal({ apiKey: "test", model: "gpt-6-sol", workingSet: set,
        fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify(proposalWithEvidenceRef(invalidRef)) }),
          { status: 200 }) });
      const validation = validateSterlingTodayProposal(set, result.proposal);
      assert.equal(validation.accepted, false);
      assert.ok(validation.errors.some(error => error.includes("unknown-evidence") && error.includes("invalid-evidence-handle:")));
      assert.ok(validation.errors.every(error => !error.includes(invalidRef)));
    }
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

  it("reports incomplete reason and token usage without exposing partial model output", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_text: "Private Gmail evidence must never enter diagnostics.",
      usage: { input_tokens: 48_000, output_tokens: 24_000,
        output_tokens_details: { reasoning_tokens: 17_250 }, total_tokens: 72_000 },
    }), { status: 200, headers: { "x-request-id": "req_incomplete123" } });
    await assert.rejects(
      requestSterlingTodayProposal({ apiKey: "secret-key", model: "gpt-5.6-sol", workingSet: workingSet(), fetchImpl }),
      (error: unknown) => {
        assert.ok(error instanceof SterlingTodayRequestError);
        assert.equal(error.kind, "response");
        assert.equal(error.code, "incomplete");
        assert.equal(error.incompleteReason, "max_output_tokens");
        assert.equal(error.inputTokens, 48_000);
        assert.equal(error.outputTokens, 24_000);
        assert.equal(error.reasoningTokens, 17_250);
        assert.equal(error.totalTokens, 72_000);
        assert.equal(error.maxOutputTokens, 24_000);
        assert.equal(error.requestId, "req_incomplete123");
        assert.match(error.message, /incompleteReason=max_output_tokens/);
        assert.match(error.message, /reasoningTokens=17250/);
        assert.match(error.message, /elapsedMs=\d+/);
        assert.doesNotMatch(error.message, /Private Gmail|secret-key/);
        return true;
      },
    );
  });

  it("distinguishes a non-token incomplete response", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      status: "incomplete", incomplete_details: { reason: "content_filter" },
      usage: { input_tokens: 200, output_tokens: 40, output_tokens_details: { reasoning_tokens: 20 }, total_tokens: 240 },
    }), { status: 200, headers: { "x-request-id": "req_filtered123" } });
    await assert.rejects(
      requestSterlingTodayProposal({ apiKey: "test", model: "gpt-5.6-sol", workingSet: workingSet(), fetchImpl }),
      (error: unknown) => error instanceof SterlingTodayRequestError &&
        error.incompleteReason === "content_filter" && error.outputTokens === 40,
    );
  });
});
