import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emitTodayLiveEnrichmentDiagnostics,
  TODAY_LIVE_ENRICHMENT_EVENT,
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
});
