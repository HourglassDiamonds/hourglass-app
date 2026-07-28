/**
 * manual-preview runMode contracts.
 * No real Resend; durable-test store only.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFakeEmailSender,
  executeAgentOsCadence,
} from "./cadence-delivery";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import { evaluateCadence } from "./persistence/evaluate-cadence";
import { getCadenceById } from "./persistence/cadence";

describe("manual-preview runMode", () => {
  it("manual-preview does not send and does not mutate lastSuccessfulAt", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const cadence = prior.cadences["cos-daily-synthesis"] ?? getCadenceById("cos-daily-synthesis");
    assert.ok(cadence);
    const seeded = {
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...cadence,
          lastSuccessfulAt: "2026-07-27T11:00:00.000Z",
        },
      },
    };
    await store.save(seeded);

    const sender = createFakeEmailSender({ messageId: "should-not-send" });
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      runMode: "manual-preview",
      cadenceId: "cos-daily-synthesis",
      force: true,
      allowDurableTest: true,
      store,
      nowIso: "2026-07-28T15:00:00.000Z",
      emailSender: sender,
      emailConfigOverride: {
        apiKey: "re_test",
        from: "Agent OS <test@updates.example.test>",
        to: "founder@example.test",
        recipientAlias: "test-founder",
      },
      includePreviewRender: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.runMode, "manual-preview");
    assert.equal(result.emailSent, false);
    assert.equal(sender.calls.length, 0);
    assert.equal(result.dryRun, true);
    assert.match(String(result.cadenceWindow), /manual-preview/);
    assert.equal(
      result.cadenceLastSuccessfulAtBefore,
      "2026-07-27T11:00:00.000Z",
    );
    assert.equal(
      result.cadenceLastSuccessfulAtAfter,
      "2026-07-27T11:00:00.000Z",
    );
    assert.ok(result.previewRender?.subject);
    assert.doesNotMatch(result.previewRender!.subject, /^\[TEST\]/);

    const after = await store.load();
    assert.equal(
      after.cadences["cos-daily-synthesis"]?.lastSuccessfulAt,
      "2026-07-27T11:00:00.000Z",
    );
    // Official day window must not be claimed as sent
    const officialSent = Object.values(after.deliveries ?? {}).some(
      (d) =>
        d.cadenceId === "cos-daily-synthesis" &&
        d.cadenceWindow === "day:2026-07-28" &&
        d.status === "sent",
    );
    assert.equal(officialSent, false);

    const nextCadence = after.cadences["cos-daily-synthesis"] ?? cadence;
    const probe = evaluateCadence({
      cadence: {
        ...nextCadence,
        lastSuccessfulAt: "2026-07-27T11:00:00.000Z",
      },
      nowIso: "2026-07-29T11:05:00.000Z",
      trigger: "scheduled",
      sourceHealth: [],
    });
    assert.equal(probe.shouldProceed, true);
  });

  it("manual modes reject non-scheduled-live mode", async () => {
    const result = await executeAgentOsCadence({
      mode: "dry-run",
      runMode: "manual-preview",
      cadenceId: "cos-daily-synthesis",
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "mode-mismatch");
  });
});
