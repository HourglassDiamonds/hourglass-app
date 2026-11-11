import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectSterlingRequiredLiveThreadIds,
  buildSterlingEvidenceReadyWorkingSet,
  evaluateSterlingEvidenceCompleteness,
  executeSterlingEvidenceGatedRequest,
} from "./evidence-completeness";
import { validateSterlingTodayProposal } from "./validate";
import {
  STERLING_TODAY_PROPOSAL_VERSION,
  STERLING_TODAY_WORKING_SET_VERSION,
  type SterlingTodayProposal,
  type SterlingTodayWorkingSet,
} from "./types";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function baseWorkingSet(): SterlingTodayWorkingSet {
  return {
    contractVersion: STERLING_TODAY_WORKING_SET_VERSION,
    runId: "run-gate",
    evidenceSnapshotId: "snapshot-gate",
    sourceWatermark: "watermark-gate",
    generatedAt: "2026-10-10T12:00:00.000Z",
    mutationMode: "shadow_read_only",
    people: [],
    projects: [P1, P2].map((projectId, index) => ({
      projectId,
      title: `Project ${index + 1}`,
      projectKind: "custom_new_jewelry",
      lifecycleStage: "cad",
      recordVersion: `project-version-${index + 1}`,
      people: [],
      specs: [],
      openJobIds: [],
      gmailThreadIds: [`thread-${index + 1}`],
    })),
    jobs: [],
    evidence: [P1, P2].flatMap((projectId, index) => [
      {
        evidenceId: `gmail-${index + 1}`,
        sourceType: "gmail" as const,
        sourceRef: `gmail:thread:thread-${index + 1}:message:message-${index + 1}`,
        timestamp: `2026-10-0${index + 1}T12:00:00.000Z`,
        direction: "inbound" as const,
        subject: "private subject",
        excerpt: "private message content",
        attachmentFilenames: [],
        messageId: `message-${index + 1}`,
        threadId: `thread-${index + 1}`,
        projectIds: [projectId],
        personIds: [],
        provenance: "indexed_gmail+candidate_excerpt",
      },
      {
        evidenceId: `canonical-${index + 1}`,
        sourceType: "canonical" as const,
        sourceRef: `continuum:project:${projectId}`,
        timestamp: `2026-10-0${index + 1}T12:00:00.000Z`,
        direction: "unknown" as const,
        subject: `Project ${index + 1}`,
        excerpt: "Canonical project; lifecycle=cad.",
        attachmentFilenames: [],
        messageId: null,
        threadId: null,
        projectIds: [projectId],
        personIds: [],
        provenance: "canonical_project_read_only",
      },
    ]),
    workUnits: [P1, P2].map((projectId, index) => ({
      workUnitId: `project:${projectId}`,
      kind: "canonical_project" as const,
      identityBasis: "canonical_project" as const,
      projectId,
      label: `Project ${index + 1}`,
      observedIdentifiers: [],
      typedIdentifiers: [],
      threadIds: [`thread-${index + 1}`],
      sourceRefs: [`gmail:thread:thread-${index + 1}:message:message-${index + 1}`],
      evidenceRefs: [`gmail-${index + 1}`, `canonical-${index + 1}`],
    })),
    calendarAvailability: { status: "unavailable", reason: "not-configured" },
    calendar: [],
    previousToday: [],
  };
}

function live(threadId: string) {
  return {
    threadId,
    status: "complete_live" as const,
    indexedMessageCount: 1,
    liveMessageCount: 1,
    safeErrorCategory: null,
  };
}

function unavailable(threadId: string, safeErrorCategory = "thread-inaccessible") {
  return {
    threadId,
    status: "unavailable" as const,
    indexedMessageCount: 1,
    liveMessageCount: 0,
    safeErrorCategory,
  };
}

describe("Sterling permanent evidence completeness gate", () => {
  it("plans one deduplicated newest-first live frontier and skips independent evidence", () => {
    const base = baseWorkingSet();
    const founderEvidence = {
      ...base.evidence[0]!,
      evidenceId: "founder-1",
      sourceType: "founder_directive" as const,
      sourceRef: "founder:correction:1",
      timestamp: "2026-10-11T12:00:00.000Z",
      messageId: null,
      threadId: null,
      provenance: "founder_correction",
    };
    const workingSet: SterlingTodayWorkingSet = {
      ...base,
      evidence: [...base.evidence, founderEvidence],
      workUnits: [
        { ...base.workUnits[0]!, threadIds: ["shared", "thread-1"] },
        { ...base.workUnits[1]!, threadIds: ["shared", "thread-2"], evidenceRefs: [...base.workUnits[1]!.evidenceRefs, "founder-1"] },
      ],
    };
    assert.deepEqual(collectSterlingRequiredLiveThreadIds(workingSet), ["shared", "thread-1"]);
  });

  it("allows every work unit when all required threads are live", () => {
    const workingSet = baseWorkingSet();
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet,
      threadOutcomes: [live("thread-1"), live("thread-2")],
    });

    assert.equal(report.aggregate.modelEligibleWorkUnitCount, 2);
    assert.equal(report.aggregate.blockedWorkUnitCount, 0);
    assert.equal(report.aggregate.countsByStatus.complete_live_evidence, 2);
  });

  it("fails closed for one inaccessible required thread", () => {
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet: baseWorkingSet(),
      threadOutcomes: [live("thread-1"), unavailable("thread-2")],
    });

    const blocked = report.workUnits.find((row) => row.workUnitId === `project:${P2}`);
    assert.equal(blocked?.status, "unavailable_required_evidence");
    assert.equal(blocked?.modelEligible, false);
    assert.deepEqual(blocked?.safeErrorCategories, ["thread-inaccessible"]);
  });

  it("reports an allowlist exclusion as scoped-out evidence, not a provider failure", () => {
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet: baseWorkingSet(),
      threadOutcomes: [live("thread-1"), unavailable("thread-2", "not-requested-scope-excluded")],
    });

    const blocked = report.workUnits.find((row) => row.workUnitId === `project:${P2}`);
    assert.equal(blocked?.blockReason, "required-live-evidence-scope-excluded");
    assert.equal(blocked?.scopeExcludedThreadCount, 1);
    assert.equal(blocked?.providerFailedThreadCount, 0);
  });

  it("preserves complete work units in a mixed portfolio and excludes blocked evidence", () => {
    const workingSet = baseWorkingSet();
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet,
      threadOutcomes: [live("thread-1"), unavailable("thread-2")],
    });
    const prepared = buildSterlingEvidenceReadyWorkingSet({ workingSet, completeness: report });

    assert.deepEqual(prepared.blockedWorkUnitIds, [`project:${P2}`]);
    assert.deepEqual(prepared.workingSet?.workUnits.map((row) => row.workUnitId), [`project:${P1}`]);
    assert.deepEqual(prepared.workingSet?.projects.map((row) => row.projectId), [P1]);
    assert.equal(prepared.workingSet?.evidence.some((row) => row.projectIds.includes(P2)), false);
  });

  it("accepts canonical-only state without inventing a Gmail requirement", () => {
    const base = baseWorkingSet();
    const workingSet: SterlingTodayWorkingSet = {
      ...base,
      workUnits: [{
        ...base.workUnits[0]!,
        threadIds: [],
        sourceRefs: [base.evidence.find((row) => row.evidenceId === "canonical-1")!.sourceRef],
        evidenceRefs: ["canonical-1"],
      }],
      projects: [base.projects[0]!],
      evidence: base.evidence.filter((row) => row.evidenceId === "canonical-1"),
    };

    const report = evaluateSterlingEvidenceCompleteness({ workingSet, threadOutcomes: [] });
    assert.equal(report.workUnits[0]?.status, "complete_independent_evidence");
    assert.equal(report.workUnits[0]?.basis, "canonical_facts");
    assert.equal(report.workUnits[0]?.modelEligible, true);
  });

  it("lets an explicit founder correction supersede unavailable older Gmail evidence", () => {
    const base = baseWorkingSet();
    const founderEvidence = {
      evidenceId: "founder-1",
      sourceType: "founder_directive" as const,
      sourceRef: "founder:correction:1",
      timestamp: "2026-10-10T12:00:00.000Z",
      direction: "outbound" as const,
      subject: null,
      excerpt: "Founder correction",
      attachmentFilenames: [],
      messageId: null,
      threadId: null,
      projectIds: [P1],
      personIds: [],
      provenance: "founder_correction",
    };
    const workingSet: SterlingTodayWorkingSet = {
      ...base,
      workUnits: [{
        ...base.workUnits[0]!,
        evidenceRefs: [...base.workUnits[0]!.evidenceRefs, "founder-1"],
      }],
      projects: [base.projects[0]!],
      evidence: [...base.evidence.filter((row) => row.projectIds.includes(P1)), founderEvidence],
    };

    const report = evaluateSterlingEvidenceCompleteness({
      workingSet,
      threadOutcomes: [unavailable("thread-1")],
    });
    assert.equal(report.workUnits[0]?.status, "complete_independent_evidence");
    assert.equal(report.workUnits[0]?.basis, "founder_correction");
    assert.equal(report.workUnits[0]?.requiredThreadCount, 0);
  });

  it("distinguishes indexed excerpts from successful live retrieval", () => {
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet: baseWorkingSet(),
      threadOutcomes: [
        { threadId: "thread-1", status: "indexed_excerpt_only", indexedMessageCount: 1,
          liveMessageCount: 0, safeErrorCategory: "missing-live-message" },
        live("thread-2"),
      ],
    });

    assert.equal(report.workUnits[0]?.status, "indexed_excerpt_only");
    assert.equal(report.workUnits[0]?.modelEligible, false);
  });

  it("uses recent verification only for planning and keeps semantic evidence blocked", () => {
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet: baseWorkingSet(),
      threadOutcomes: [
        { threadId: "thread-1", status: "indexed_excerpt_only", indexedMessageCount: 1,
          liveMessageCount: 0, safeErrorCategory: "recently-verified-assembly-only",
          latestIndexedMessageAt: "2026-10-10T10:00:00.000Z",
          latestLiveMessageAt: "2026-10-10T10:00:00.000Z", verifiedAt: "2026-10-22T12:00:00.000Z" },
        live("thread-2"),
      ],
    });
    assert.equal(report.workUnits[0]?.modelEligible, false);
    assert.equal(report.workUnits[0]?.reusedVerificationThreadCount, 1);
    assert.equal(report.workUnits[0]?.blockReason, "required-live-evidence-reused-for-planning-only");
    assert.equal(report.workUnits[0]?.lastSuccessfulVerificationAt, "2026-10-22T12:00:00.000Z");
  });

  it("preserves explicit ambiguity when non-canonical evidence has no exact live thread", () => {
    const base = baseWorkingSet();
    const candidate = {
      ...base.evidence[0]!,
      evidenceId: "candidate-without-thread",
      sourceType: "candidate" as const,
      sourceRef: "candidate:record:opaque",
      messageId: null,
      threadId: null,
    };
    const workingSet: SterlingTodayWorkingSet = {
      ...base,
      projects: [],
      evidence: [candidate],
      workUnits: [{
        ...base.workUnits[0]!,
        kind: "provisional_evidence",
        identityBasis: "source_record",
        projectId: null,
        threadIds: [],
        sourceRefs: [candidate.sourceRef],
        evidenceRefs: [candidate.evidenceId],
      }],
    };

    const report = evaluateSterlingEvidenceCompleteness({ workingSet, threadOutcomes: [] });
    assert.equal(report.workUnits[0]?.status, "legitimately_ambiguous_evidence");
    assert.equal(report.workUnits[0]?.modelEligible, false);
  });

  it("does not call the model when every requested work unit is blocked", async () => {
    const workingSet = baseWorkingSet();
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet,
      threadOutcomes: [unavailable("thread-1"), unavailable("thread-2")],
    });
    let calls = 0;
    const result = await executeSterlingEvidenceGatedRequest({
      workingSet,
      completeness: report,
      request: async () => { calls += 1; return "unexpected"; },
    });

    assert.equal(calls, 0);
    assert.equal(result.called, false);
    assert.equal(result.result, null);
  });

  it("calls the model once with only complete work units in a mixed portfolio", async () => {
    const workingSet = baseWorkingSet();
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet,
      threadOutcomes: [live("thread-1"), unavailable("thread-2")],
    });
    const seen: string[][] = [];
    const result = await executeSterlingEvidenceGatedRequest({
      workingSet,
      completeness: report,
      request: async (ready) => {
        seen.push(ready.workUnits.map((row) => row.workUnitId));
        return "ok";
      },
    });

    assert.equal(result.called, true);
    assert.equal(result.result, "ok");
    assert.deepEqual(seen, [[`project:${P1}`]]);
  });

  it("rejects a mutation aimed at a work unit removed by the gate", () => {
    const workingSet = baseWorkingSet();
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet,
      threadOutcomes: [live("thread-1"), unavailable("thread-2")],
    });
    const ready = buildSterlingEvidenceReadyWorkingSet({ workingSet, completeness: report }).workingSet!;
    const evidenceId = ready.workUnits[0]!.evidenceRefs[0]!;
    const proposal: SterlingTodayProposal = {
      contractVersion: STERLING_TODAY_PROPOSAL_VERSION,
      runId: ready.runId,
      evidenceSnapshotId: ready.evidenceSnapshotId,
      generatedAt: ready.generatedAt,
      portfolioAssessments: [{
        workUnitId: ready.workUnits[0]!.workUnitId,
        projectId: P1,
        identityStatus: "canonical_project",
        todayDisposition: "suppressed",
        recommendationItemId: null,
        currentStage: { canonicalLifecycleStage: null, operationalSubstage: null, responsibleParty: "unknown",
          confidence: "low", explanation: "No definitive stage change.", evidenceRefs: [evidenceId] },
        obligations: [],
        nextStepOwner: "unknown",
        attentionPriority: "no_attention",
        confidence: "low",
        evidenceRefs: [evidenceId],
        ambiguities: [],
        explanation: "Evidence reviewed.",
        omissionReason: "No actionable recommendation.",
      }],
      recommendations: [],
      relationshipProposals: [],
      proposedCanonicalMutations: [{
        proposalKey: "blocked-project-mutation",
        kind: "set_project_lifecycle",
        projectId: P2,
        personId: null,
        jobId: null,
        expectedRecordVersion: "project-version-2",
        targetLifecycleStage: "production",
        targetJobState: null,
        targetResponsibleParty: null,
        newJob: null,
        reason: "Unsupported blocked work unit.",
        evidenceRefs: [evidenceId],
        requiresFounderApproval: true,
      }],
      portfolioAmbiguities: [],
    };

    const validation = validateSterlingTodayProposal(ready, proposal);
    assert.equal(validation.mutationValidations[0]?.status, "rejected");
    assert.ok(validation.mutationValidations[0]?.reasons.includes("unknown-project"));
  });

  it("returns privacy-safe aggregate diagnostics and contains no write boundary", () => {
    const report = evaluateSterlingEvidenceCompleteness({
      workingSet: baseWorkingSet(),
      threadOutcomes: [live("thread-1"), unavailable("thread-2", "unknown_forbidden")],
    });
    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /private subject|private message content|message-1|thread-1|thread-2/i);
    assert.deepEqual(report.aggregate.safeErrorCategories, ["unknown_forbidden"]);

    const source = readFileSync(new URL("./evidence-completeness.ts", import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /@supabase|\.from\(|\.insert\(|\.upsert\(|\.delete\(|publishPersistedTodaySnapshot|putCheckpoint|OPENAI_API_KEY|fetch\(/,
    );
  });
});
