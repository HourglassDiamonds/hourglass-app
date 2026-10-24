import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSterlingEvidenceCompleteness } from "./evidence-completeness";
import { safeAssemblyResult, type SterlingTodayAssembly } from "./server-runner";
import { resolveSterlingTarget } from "./target-resolution";
import { excludeSterlingSuppressedWorkUnits, sterlingPreModelSuppressions } from "./pre-model-suppression";
import { scopeDefinition } from "./scope";
import { STERLING_TODAY_WORKING_SET_VERSION, type SterlingTodayWorkingSet } from "./types";

function fixture(): SterlingTodayAssembly {
  const workingSet: SterlingTodayWorkingSet = {
    contractVersion: STERLING_TODAY_WORKING_SET_VERSION,
    runId: "run-private",
    evidenceSnapshotId: "snapshot-private",
    sourceWatermark: "watermark-private",
    generatedAt: "2026-10-21T12:00:00.000Z",
    mutationMode: "shadow_read_only",
    people: [],
    projects: [],
    jobs: [],
    evidence: ["a", "b"].map((threadId, index) => ({
      evidenceId: `evidence-${index}`,
      sourceType: "gmail" as const,
      sourceRef: `gmail:thread:${threadId}:message:private-${index}`,
      timestamp: `2026-10-21T1${index}:00:00.000Z`,
      direction: "inbound" as const,
      subject: "private subject",
      excerpt: "private Gmail body",
      attachmentFilenames: ["private-file.pdf"],
      messageId: `private-message-${index}`,
      threadId: `private-thread-${threadId}`,
      projectIds: [],
      personIds: [],
      provenance: "indexed",
    })),
    workUnits: ["a", "b"].map((threadId, index) => ({
      workUnitId: `provisional:private-${index}`,
      kind: "provisional_evidence" as const,
      identityBasis: "source_thread" as const,
      projectId: null,
      label: "Private client name",
      observedIdentifiers: index === 0 ? ["C026732"] : [],
      typedIdentifiers: index === 0 ? [{ kind: "project" as const, value: "C026732" }] : [],
      threadIds: [`private-thread-${threadId}`],
      sourceRefs: [`gmail:private-${threadId}`],
      evidenceRefs: [`evidence-${index}`],
    })),
    calendarAvailability: { status: "unavailable", reason: "not-configured" },
    calendar: [],
    previousToday: [],
  };
  const completeness = evaluateSterlingEvidenceCompleteness({
    workingSet,
    threadOutcomes: [
      { threadId: "private-thread-a", status: "complete_live", indexedMessageCount: 1, liveMessageCount: 1,
        safeErrorCategory: null, latestIndexedMessageAt: "2026-10-21T10:00:00.000Z",
        latestLiveMessageAt: "2026-10-21T10:00:00.000Z" },
      { threadId: "private-thread-b", status: "unavailable", indexedMessageCount: 1, liveMessageCount: 0,
        safeErrorCategory: "not-requested-budget-exhausted", latestIndexedMessageAt: "2026-10-21T11:00:00.000Z",
        latestLiveMessageAt: null },
    ],
  });
  return {
    workingSet,
    requestWorkingSet: workingSet,
    target: null,
    targetBlockedReason: null,
    targetDiagnostics: null,
    targetPackage: null,
    completeness,
    scopeCoverage: [
      { publicId: "ZANE/C026732", resolved: true, resolution: "exact_identifier", workUnitIds: ["provisional:private-0"] },
      { publicId: "UNRESOLVED", resolved: false, resolution: "unresolved", workUnitIds: [] },
    ],
    calendar: { diagnosis: "read_disabled", readEnabled: false, oauthConfigured: false, tokenKekConfigured: false,
      founderMailboxConfigured: false, connectionStoreReadable: true, connectionPresent: false, connectionStatus: null,
      refreshTokenPresent: false, grantedReadonlyScope: false, lastReadPresent: false, connectionErrorPresent: false,
      todayItemsBeforeAcceptanceScope: 0, scopedTodayItems: 0 },
    gmail: { requiredThreadCount: 2, scheduledThreadCount: 1,
      requestedThreadCount: 1, completedThreadCount: 1, failedThreadCount: 0,
      providerRateLimitedThreadCount: 0, otherProviderErrorThreadCount: 0, missingIndexedThreadCount: 0,
      missingLiveMessageThreadCount: 0, budgetDeferredThreadCount: 1, threadFetches: 1, durationMs: 10,
      failuresByCode: { "not-requested-budget-exhausted": 1 },
      sizeBuckets: { small: { completed: 1, failed: 1 }, medium: { completed: 0, failed: 0 }, large: { completed: 0, failed: 0 } },
      attachmentThreads: { completed: 0, failed: 0 }, nonAttachmentThreads: { completed: 1, failed: 1 } },
    continuity: { status: "available", requiredThreadCount: 2, reusedVerificationCount: 0,
      expiredVerificationCount: 0, invalidatedVerificationCount: 0, persistedVerificationCount: 1,
      persistenceConflictCount: 0, persistenceFailureCount: 0, semanticEvidenceReusable: false },
    counts: { people: 0, projects: 0, jobs: 0, evidence: 2, workUnits: 2, gmailThreads: 2, calendar: 0 },
    candidateCoverage: { total: 2, selected: 2, suppressed: 0,
      suppressedByReason: { superseded_or_discarded: 0, deferred_or_quoted_historical: 0,
        historical_context_outside_active_frontier: 0 } },
    suppressionByWorkUnitId: {},
    performance: { assemblyLatencyMs: 10, serializedInputBytes: 100, totalLatencyMs: 10 },
  };
}

describe("Sterling privacy-safe coverage diagnostics", () => {
  it("shows per-unit eligibility and named-case resolution with opaque work-unit references", () => {
    const result = safeAssemblyResult(fixture());
    assert.equal(result.workUnitCoverage.length, 2);
    assert.match(result.workUnitCoverage[0]!.workUnitRef, /^wu_[a-f0-9]{16}$/);
    assert.equal(result.workUnitCoverage.some((row) => row.recordIdentifier === "C026732"), true);
    assert.equal(result.workUnitCoverage.some((row) => row.budgetDeferredThreadCount === 1), true);
    assert.deepEqual(result.namedCaseCoverage.map((row) => [row.caseId, row.evidenceStatus]), [
      ["ZANE/C026732", "eligible"],
      ["UNRESOLVED", "unresolved"],
    ]);
    assert.equal(result.continuity?.persistedVerificationCount, 1);
    assert.equal(result.continuity?.semanticEvidenceReusable, false);
  });

  it("does not expose raw Gmail or private work-unit material", () => {
    const assembly = fixture();
    assembly.targetDiagnostics = { selectedWorkUnitId: "provisional:private-0",
      secondaryWorkUnitIds: ["provisional:private-1"], requiredThreadCount: 1,
      scheduledThreadCount: 1, successfullyLiveRetrievedThreadCount: 1, missingOrFailedThreadCount: 0,
      providerFailedThreadCount: 0, budgetDeferredThreadCount: 0, requiredIndexedMessageCount: 1,
      successfullyLiveRetrievedMessageCount: 1, includedEvidenceMessageCount: 1,
      excludedOrAmbiguousAssociationCount: 1, stoppedAtStage: null,
      latestVerifiedSourceAt: "2026-10-21T10:00:00.000Z",
      chronologyInvariant: {
        missingMessageIdCount: 0, malformedMessageIdCount: 0, duplicateMessageIdCount: 0,
        invalidTimestampCount: 0, outOfOrderMessageCount: 0, missingRequiredThreadCount: 0,
        requiredThreadMembershipMismatchCount: 0, provenanceMismatchCount: 0,
        unexpectedEvidenceMembershipCount: 0, indexedLiveCountDisagreementCount: 0,
        indexedIncludedCountDisagreementCount: 0,
      },
      extractionDiagnostics: null,
      complete: true };
    const serialized = JSON.stringify(safeAssemblyResult(assembly));
    for (const forbidden of ["Private client name", "private Gmail body", "private subject", "private-file.pdf",
      "private-message", "private-thread", "gmail:private", "provisional:private"]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
    }
    assert.match(serialized, /wu_[a-f0-9]{16}/);
  });

  it("keeps budget deferral distinct from provider failure", () => {
    const result = safeAssemblyResult(fixture());
    assert.equal(result.gmail?.budgetDeferredThreadCount, 1);
    assert.equal(result.gmail?.providerRateLimitedThreadCount, 0);
    assert.equal(result.gmail?.otherProviderErrorThreadCount, 0);
    assert.equal(result.workUnitCoverage.find((row) => row.budgetDeferredThreadCount === 1)?.providerFailedThreadCount, 0);
  });

  it("reports missing indexed evidence as its own fail-closed cause", () => {
    const assembly = fixture();
    assembly.completeness = evaluateSterlingEvidenceCompleteness({
      workingSet: assembly.workingSet,
      threadOutcomes: [
        { threadId: "private-thread-a", status: "complete_live", indexedMessageCount: 1, liveMessageCount: 1,
          safeErrorCategory: null, latestIndexedMessageAt: "2026-10-21T10:00:00.000Z",
          latestLiveMessageAt: "2026-10-21T10:00:00.000Z" },
        { threadId: "private-thread-b", status: "unavailable", indexedMessageCount: 0, liveMessageCount: 0,
          safeErrorCategory: "missing-indexed-context", latestIndexedMessageAt: null, latestLiveMessageAt: null },
      ],
    });
    const blocked = safeAssemblyResult(assembly).workUnitCoverage.find((row) => row.missingIndexedThreadCount === 1);
    assert.equal(blocked?.modelEligible, false);
    assert.equal(blocked?.blockReason, "required-thread-missing-indexed-evidence");
    assert.equal(blocked?.providerFailedThreadCount, 0);
  });
});

describe("Sterling trusted target resolution", () => {
  function targetFixture(threadCount = 2): SterlingTodayWorkingSet {
    const threadIds = Array.from({ length: threadCount }, (_, index) => (index + 1).toString(16).padStart(16, "a"));
    const canonicalId = "18e9ef2b-5b22-453e-8be8-e54dab0d86b1";
    const evidence = threadIds.map((threadId, index) => ({
      evidenceId: `e-${index}`, sourceType: "gmail" as const,
      sourceRef: `gmail:thread:${threadId}:message:${(index + 100).toString(16).padStart(16, "b")}`,
      timestamp: "2026-10-21T12:00:00.000Z", direction: "inbound" as const, subject: null, excerpt: null,
      attachmentFilenames: [], messageId: (index + 100).toString(16).padStart(16, "b"), threadId,
      projectIds: [canonicalId], personIds: [], provenance: "indexed",
    }));
    return {
      contractVersion: STERLING_TODAY_WORKING_SET_VERSION, runId: "run", evidenceSnapshotId: "snap",
      sourceWatermark: "wm", generatedAt: "2026-10-22T12:00:00.000Z", mutationMode: "shadow_read_only",
      people: [], projects: [], jobs: [], evidence,
      workUnits: [
        { workUnitId: `project:${canonicalId}`, kind: "canonical_project", identityBasis: "canonical_project",
          projectId: canonicalId, label: "Sarah", observedIdentifiers: ["C026143"],
          typedIdentifiers: [{ kind: "project", value: "C026143" }], threadIds,
          sourceRefs: evidence.map((row) => row.sourceRef), evidenceRefs: evidence.map((row) => row.evidenceId) },
        { workUnitId: "provisional:contaminated", kind: "provisional_evidence", identityBasis: "exact_identifier",
          projectId: null, label: "Ambiguous", observedIdentifiers: ["C026143"],
          typedIdentifiers: [{ kind: "project", value: "C026143" }], threadIds: ["cccccccccccccccc"],
          sourceRefs: [], evidenceRefs: [] },
      ], calendarAvailability: { status: "unavailable", reason: "test" }, calendar: [], previousToday: [],
    };
  }

  it("selects Sarah's canonical unit and excludes contaminated secondary matches from her frontier", () => {
    const workingSet = targetFixture();
    const definition = scopeDefinition("sarah")!;
    const result = resolveSterlingTarget({ workingSet, definition, matchingUnits: workingSet.workUnits,
      canonicalProjectIds: new Set([workingSet.workUnits[0]!.projectId!]) });
    assert.equal(result.selected?.kind, "canonical_project");
    assert.deepEqual(result.secondary.map((row) => row.workUnitId), ["provisional:contaminated"]);
    assert.equal(result.requiredThreadIds.includes("cccccccccccccccc"), false);
  });

  it("fails before retrieval when target evidence exceeds the 48-thread budget", () => {
    const workingSet = targetFixture(49);
    const definition = { ...scopeDefinition("sarah")!, exactThreadIds: [] };
    const result = resolveSterlingTarget({ workingSet, definition, matchingUnits: [workingSet.workUnits[0]!],
      canonicalProjectIds: new Set([workingSet.workUnits[0]!.projectId!]) });
    assert.equal(result.blockedReason, "target-required-evidence-exceeds-budget");
    assert.equal(result.requiredThreadIds.length, 49);
  });

  it("fails closed when a reviewed required thread is missing from indexed evidence", () => {
    const workingSet = targetFixture();
    const result = resolveSterlingTarget({ workingSet, definition: scopeDefinition("sarah")!,
      matchingUnits: [workingSet.workUnits[0]!], canonicalProjectIds: new Set([workingSet.workUnits[0]!.projectId!]) });
    assert.equal(result.blockedReason, "target-required-evidence-missing");
  });
});

describe("Sterling deterministic pre-model suppression", () => {
  it("keeps known newsletter and solicitation units visible but out of model-bound input", () => {
    const workingSet = fixture().workingSet;
    const newsletter = scopeDefinition("noiseNewsletter")!.exactThreadIds![0]!;
    const solicitation = scopeDefinition("noiseSolicitation")!.exactThreadIds![0]!;
    workingSet.workUnits = workingSet.workUnits.map((unit, index) => ({ ...unit,
      threadIds: [index === 0 ? newsletter : solicitation] }));
    const suppressions = sterlingPreModelSuppressions(workingSet);
    assert.deepEqual(Object.values(suppressions).sort(), ["known_newsletter_source", "known_solicitation_source"]);
    assert.equal(excludeSterlingSuppressedWorkUnits(workingSet, suppressions).workUnits.length, 0);
    assert.equal(workingSet.workUnits.length, 2);
  });

  it("keeps stale Duane evidence historical unless current canonical or fresh evidence qualifies it", () => {
    const workingSet = fixture().workingSet;
    workingSet.generatedAt = "2026-10-22T12:00:00.000Z";
    workingSet.workUnits = [{ ...workingSet.workUnits[0]!, observedIdentifiers: ["C026350"] }];
    workingSet.evidence = workingSet.evidence.map((row) => ({ ...row, timestamp: "2026-09-25T12:00:00.000Z" }));
    assert.equal(Object.values(sterlingPreModelSuppressions(workingSet))[0], "historical_case_without_current_qualification");
    workingSet.evidence = workingSet.evidence.map((row) => ({ ...row, timestamp: "2026-10-21T12:00:00.000Z" }));
    assert.deepEqual(sterlingPreModelSuppressions(workingSet), {});
  });
});
