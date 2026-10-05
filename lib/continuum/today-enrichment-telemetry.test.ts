import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emitTodayCanonicalInputCounts,
  emitTodayLiveEnrichmentDiagnostics,
  emitTodayUnindexedSourceRefCount,
  TODAY_CANONICAL_INPUTS_EVENT,
  TODAY_LIVE_ENRICHMENT_EVENT,
  TODAY_UNINDEXED_SOURCE_REFS_EVENT,
} from "./today-enrichment-telemetry";

describe("Today live-enrichment telemetry", () => {
  it("emits aggregate counts without source identities or content", () => {
    let captured = "";
    const original = console.info;
    console.info = (message?: unknown) => {
      captured = String(message ?? "");
    };
    try {
      emitTodayLiveEnrichmentDiagnostics({
        requestedThreadCount: 3,
        completedThreadCount: 2,
        failedThreadCount: 1,
        missingIndexedThreadCount: 0,
        missingLiveMessageThreadCount: 1,
        threadFetches: 3,
        durationMs: 250,
        failuresByCode: { unavailable: 1 },
        sizeBuckets: {
          small: { completed: 1, failed: 0 },
          medium: { completed: 1, failed: 1 },
          large: { completed: 0, failed: 0 },
        },
        attachmentThreads: { completed: 1, failed: 1 },
        nonAttachmentThreads: { completed: 1, failed: 0 },
      });
    } finally {
      console.info = original;
    }

    const parsed = JSON.parse(captured) as Record<string, unknown>;
    assert.equal(parsed.event, TODAY_LIVE_ENRICHMENT_EVENT);
    assert.equal(parsed.requestedThreadCount, 3);
    assert.equal(parsed.completedThreadCount, 2);
    assert.equal(parsed.failedThreadCount, 1);
    assert.doesNotMatch(captured, /threadId|messageId|subject|filename|operationalText/);
  });

  it("emits content-free canonical and skipped-source counts", () => {
    const captured: string[] = [];
    const original = console.info;
    console.info = (message?: unknown) => captured.push(String(message ?? ""));
    try {
      emitTodayCanonicalInputCounts({
        jobsConnected: true,
        jobCount: 9,
        projectCount: 12,
        candidateCount: 7075,
      });
      emitTodayUnindexedSourceRefCount(2);
    } finally {
      console.info = original;
    }
    const first = JSON.parse(captured[0]!) as Record<string, unknown>;
    const second = JSON.parse(captured[1]!) as Record<string, unknown>;
    assert.equal(first.event, TODAY_CANONICAL_INPUTS_EVENT);
    assert.equal(first.candidateCount, 7075);
    assert.equal(second.event, TODAY_UNINDEXED_SOURCE_REFS_EVENT);
    assert.equal(second.count, 2);
    assert.doesNotMatch(captured.join("\n"), /threadId|messageId|subject|body/);
  });
});
