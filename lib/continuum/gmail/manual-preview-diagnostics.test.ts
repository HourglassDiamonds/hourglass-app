import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createManualPreviewCorrelationId,
  isManualPreviewCorrelationId,
  logManualPreviewDiagnostic,
  manualPreviewStageForCode,
  sanitizeManualPreviewDiagnosticCode,
  sanitizeManualPreviewDiagnosticStage,
} from "./manual-preview-diagnostics";

describe("manual Preview Gmail diagnostics", () => {
  it("classifies the four operational failure boundaries", () => {
    assert.equal(manualPreviewStageForCode("unavailable"), "preflight");
    assert.equal(
      manualPreviewStageForCode("gmail-sync-already-running"),
      "lease-acquisition",
    );
    assert.equal(
      manualPreviewStageForCode("gmail-rate-limited"),
      "provider-fetch",
    );
    assert.equal(
      manualPreviewStageForCode("gmail-database-failed"),
      "checkpoint-persistence",
    );
  });

  it("accepts only generated correlation IDs and allowlisted stages", () => {
    const correlationId = createManualPreviewCorrelationId();
    assert.equal(isManualPreviewCorrelationId(correlationId), true);
    assert.equal(isManualPreviewCorrelationId("private-page-token"), false);
    assert.equal(
      sanitizeManualPreviewDiagnosticStage("checkpoint-persistence"),
      "checkpoint-persistence",
    );
    assert.equal(sanitizeManualPreviewDiagnosticStage("private-stage"), null);
  });

  it("reduces unknown error text to an allowlisted code", () => {
    assert.equal(
      sanitizeManualPreviewDiagnosticCode(
        "refresh-token subject@example.com private-page-token",
      ),
      "unexpected",
    );
  });

  it("logs metadata only", () => {
    const original = console.info;
    const lines: string[] = [];
    console.info = (line?: unknown) => lines.push(String(line));
    try {
      logManualPreviewDiagnostic({
        correlationId: createManualPreviewCorrelationId(),
        stage: "provider-fetch",
        outcome: "failed",
        code: "gmail-rate-limited",
      });
    } finally {
      console.info = original;
    }
    assert.equal(lines.length, 1);
    assert.match(lines[0], /continuum\.gmail_manual_preview/);
    assert.match(lines[0], /gmail-rate-limited/);
    assert.doesNotMatch(lines[0], /token|subject|message|page_token|credential/i);
  });

  it("wires correlation through the action and post-redirect render", () => {
    const root = process.cwd();
    const action = readFileSync(
      join(
        root,
        "app/executive-dashboard/concierge/sterling-today/readiness/actions.ts",
      ),
      "utf8",
    );
    const page = readFileSync(
      join(
        root,
        "app/executive-dashboard/concierge/sterling-today/readiness/page.tsx",
      ),
      "utf8",
    );
    const incremental = readFileSync(
      join(root, "lib/continuum/gmail/incremental.ts"),
      "utf8",
    );

    assert.match(action, /createManualPreviewCorrelationId/);
    assert.match(action, /correlationId/);
    assert.match(page, /readiness-render/);
    assert.match(page, /Diagnostic/);
    for (const stage of [
      "preflight",
      "lease-acquisition",
      "provider-fetch",
      "checkpoint-persistence",
    ]) {
      assert.match(incremental, new RegExp(stage));
    }
  });
});
