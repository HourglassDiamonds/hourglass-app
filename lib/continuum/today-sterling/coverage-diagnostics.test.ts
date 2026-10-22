import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSterlingEvidenceCompleteness } from "./evidence-completeness";
import { safeAssemblyResult, type SterlingTodayAssembly } from "./server-runner";
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
    gmail: { requestedThreadCount: 2, completedThreadCount: 1, failedThreadCount: 1,
      providerRateLimitedThreadCount: 0, otherProviderErrorThreadCount: 0, missingIndexedThreadCount: 0,
      missingLiveMessageThreadCount: 0, budgetDeferredThreadCount: 1, threadFetches: 1, durationMs: 10,
      failuresByCode: { "not-requested-budget-exhausted": 1 },
      sizeBuckets: { small: { completed: 1, failed: 1 }, medium: { completed: 0, failed: 0 }, large: { completed: 0, failed: 0 } },
      attachmentThreads: { completed: 0, failed: 0 }, nonAttachmentThreads: { completed: 1, failed: 1 } },
    counts: { people: 0, projects: 0, jobs: 0, evidence: 2, workUnits: 2, gmailThreads: 2, calendar: 0 },
    candidateCoverage: { total: 2, selected: 2, suppressed: 0,
      suppressedByReason: { superseded_or_discarded: 0, deferred_or_quoted_historical: 0,
        historical_context_outside_active_frontier: 0 } },
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
  });

  it("does not expose raw Gmail or private work-unit material", () => {
    const serialized = JSON.stringify(safeAssemblyResult(fixture()));
    for (const forbidden of ["Private client name", "private Gmail body", "private subject", "private-file.pdf",
      "private-message", "private-thread", "gmail:private", "provisional:private"]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
    }
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
