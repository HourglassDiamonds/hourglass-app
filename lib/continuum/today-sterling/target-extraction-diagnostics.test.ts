import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { summarizeSterlingTargetExtractionDiagnostics } from "./target-extraction-diagnostics";

const operational = {
  outcome: "operational_current_text" as const,
  decodingSucceeded: true,
  currentMessageTextFound: true,
  operationalTextRecognized: true,
  attachmentMetadataPresent: false,
  providerFallbackAffectedExtraction: false,
  extractionUncertain: false,
};

describe("target extraction diagnostic summary", () => {
  it("uses opaque request-local labels and aggregates each message once", () => {
    const context = new Map<string, TodayGmailThreadContext>([["raw-thread", { messages: [
      { messageId: "raw-message-b", sentAt: "2026-10-02T00:00:00.000Z", direction: "inbound",
        liveExtractionDiagnostic: { ...operational, outcome: "non_operational_current_text",
          operationalTextRecognized: false } },
      { messageId: "raw-message-a", sentAt: "2026-10-01T00:00:00.000Z", direction: "outbound",
        liveExtractionDiagnostic: operational },
      { messageId: "raw-message-c", sentAt: "2026-10-03T00:00:00.000Z", direction: "inbound",
        liveExtractionDiagnostic: { ...operational, outcome: "attachment_only",
          currentMessageTextFound: false, operationalTextRecognized: false,
          attachmentMetadataPresent: true } },
    ] }]]);
    const result = summarizeSterlingTargetExtractionDiagnostics({
      threadContext: context,
      requiredThreadIds: ["raw-thread"],
      provenanceMismatchMessageIds: new Set(["raw-message-b", "raw-message-c"]),
    });
    assert.equal(result.totalMessageCount, 3);
    assert.equal(Object.values(result.outcomeCounts).reduce((sum, count) => sum + count, 0), 3);
    assert.equal(result.provenanceMismatchCount, 2);
    assert.deepEqual(result.mismatches.map((row) => row.messageRef), ["mismatch-01", "mismatch-02"]);
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /raw-message|raw-thread|gmail:|subject|filename/i);
  });

  it("marks missing ephemeral diagnostics uncertain without changing provenance", () => {
    const result = summarizeSterlingTargetExtractionDiagnostics({
      threadContext: new Map([["thread", { messages: [
        { messageId: "message", sentAt: "2026-10-01T00:00:00.000Z", direction: "inbound" },
      ] }]]),
      requiredThreadIds: ["thread"],
      provenanceMismatchMessageIds: new Set(["message"]),
    });
    assert.equal(result.uncertainCount, 1);
    assert.equal(result.mismatches[0]?.outcome, "uncertain_or_failed_decoding");
  });
});
