/**
 * Regression: HTTP 200 with emailSent:false looked like success.
 * Covers stale chief-of-staff inProgress lock + honest outcomes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFakeEmailSender,
  executeAgentOsCadence,
  httpStatusForCadenceOutcome,
  isInProgressStale,
  resolveCadenceDeliveryOutcome,
  STALE_IN_PROGRESS_MS,
} from "./cadence-delivery";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import { getCadenceById } from "./persistence/cadence";

const EMAIL_OVERRIDE = {
  apiKey: "re_test_fake_key",
  from: "Hourglass Chief of Staff <brief@updates.example.test>",
  to: "justin@hourglassdiamonds.com",
  recipientAlias: "founder",
};

describe("P0-2 cadence 200-without-email regression", () => {
  it("marks stale in-progress locks after the TTL", () => {
    const now = "2026-08-07T14:23:08.880Z";
    assert.equal(
      isInProgressStale("2026-08-07T14:00:00.000Z", now, STALE_IN_PROGRESS_MS),
      true,
    );
    // Exactly at TTL boundary remains active (must be older than TTL to clear).
    assert.equal(
      isInProgressStale("2026-08-07T14:13:08.880Z", now, STALE_IN_PROGRESS_MS),
      false,
    );
    assert.equal(
      isInProgressStale("2026-08-07T14:20:00.000Z", now, STALE_IN_PROGRESS_MS),
      false,
    );
  });

  it("classifies emailSent:false ok:true no-due as skipped_with_reason, not sent", () => {
    const outcome = resolveCadenceDeliveryOutcome({
      emailSent: false,
      ok: true,
      deliveryAction: "send-nothing",
      safeSummary: "No founder-brief cadence due",
    });
    assert.equal(outcome, "skipped_with_reason");
    assert.equal(httpStatusForCadenceOutcome(outcome), 200);
  });

  it("classifies quality-gate send-nothing as failed with non-2xx", () => {
    const outcome = resolveCadenceDeliveryOutcome({
      emailSent: false,
      ok: true,
      deliveryAction: "send-nothing",
      safeSummary: "Morning Brief quality gate blocked send: empty-today-call",
    });
    assert.equal(outcome, "failed");
    assert.equal(httpStatusForCadenceOutcome(outcome), 500);
  });

  it("stale chief-of-staff inProgress no longer yields empty due + silent success", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const daily =
      prior.cadences["cos-daily-synthesis"] ??
      getCadenceById("cos-daily-synthesis");
    assert.ok(daily);

    // Mirror Aug 7 10:23 ET manual Run: daily due after Aug 4 success,
    // but a crashed prior run left a stale shared-scope lock.
    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...daily,
          lastSuccessfulAt: "2026-08-04T11:28:00.000Z",
        },
        // Keep weekly fresh so only daily is due (isolates the lock bug).
        "cos-weekly-founder-brief": {
          ...(prior.cadences["cos-weekly-founder-brief"] ??
            getCadenceById("cos-weekly-founder-brief")!),
          lastSuccessfulAt: "2026-08-03T15:00:00.000Z",
        },
      },
      inProgressByScope: {
        "chief-of-staff": {
          runId: "run-crashed-leftover",
          startedAt: "2026-08-07T11:00:00.000Z", // >10m before 14:23Z
        },
      },
    });

    const sender = createFakeEmailSender({ messageId: "msg_recovery" });
    const nowIso = "2026-08-07T14:23:08.880Z";

    // Pre-fix behavior: active lock filtering with no TTL → no due cadence.
    // Post-fix: stale lock cleared → daily proceeds (or skips with explicit outcome).
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      store,
      nowIso,
      emailSender: sender,
      emailConfigOverride: EMAIL_OVERRIDE,
    });

    assert.notEqual(
      result.safeSummary,
      "No founder-brief cadence due",
      "stale lock must not present as empty-due success",
    );
    assert.ok(result.deliveryOutcome);
    assert.notEqual(result.deliveryOutcome, undefined);

    // Either sent, or an explicit skip/fail — never undifferentiated ok+no-email
    // without an outcome label.
    if (!result.emailSent) {
      assert.ok(
        result.deliveryOutcome === "skipped_with_reason" ||
          result.deliveryOutcome === "failed",
      );
      if (result.deliveryOutcome === "failed") {
        assert.equal(result.ok, false);
      }
    } else {
      assert.equal(result.deliveryOutcome, "sent");
      assert.equal(result.ok, true);
      assert.ok(sender.calls.length >= 1);
    }

    const after = await store.load();
    assert.equal(
      after.inProgressByScope["chief-of-staff"],
      undefined,
      "stale in-progress lock must be cleared",
    );
  });

  it("force-send clears a fresh in-progress lock for recovery", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const daily =
      prior.cadences["cos-daily-synthesis"] ??
      getCadenceById("cos-daily-synthesis");
    assert.ok(daily);

    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...daily,
          lastSuccessfulAt: "2026-08-04T11:28:00.000Z",
        },
        "cos-weekly-founder-brief": {
          ...(prior.cadences["cos-weekly-founder-brief"] ??
            getCadenceById("cos-weekly-founder-brief")!),
          lastSuccessfulAt: "2026-08-03T15:00:00.000Z",
        },
      },
      inProgressByScope: {
        "chief-of-staff": {
          runId: "run-still-warm",
          startedAt: "2026-08-07T14:22:00.000Z", // fresh (<10m)
        },
      },
    });

    const sender = createFakeEmailSender({ messageId: "msg_force" });
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      runMode: "force-send",
      cadenceId: "cos-daily-synthesis",
      allowDurableTest: true,
      store,
      nowIso: "2026-08-07T14:23:08.880Z",
      emailSender: sender,
      emailConfigOverride: EMAIL_OVERRIDE,
    });

    assert.notEqual(result.safeSummary, "No founder-brief cadence due");
    assert.ok(
      result.deliveryOutcome === "sent" ||
        result.deliveryOutcome === "skipped_with_reason" ||
        result.deliveryOutcome === "failed",
    );
  });

  it("second scheduled invocation after successful send is skipped_with_reason", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const daily =
      prior.cadences["cos-daily-synthesis"] ??
      getCadenceById("cos-daily-synthesis");
    assert.ok(daily);

    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...daily,
          lastSuccessfulAt: "2026-08-04T11:28:00.000Z",
        },
        "cos-weekly-founder-brief": {
          ...(prior.cadences["cos-weekly-founder-brief"] ??
            getCadenceById("cos-weekly-founder-brief")!),
          lastSuccessfulAt: "2026-08-03T15:00:00.000Z",
        },
      },
      inProgressByScope: {},
    });

    const sender = createFakeEmailSender({ messageId: "msg_once" });
    const nowIso = "2026-08-07T14:23:08.880Z";
    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      cadenceId: "cos-daily-synthesis",
      allowDurableTest: true,
      store,
      nowIso,
      emailSender: sender,
      emailConfigOverride: EMAIL_OVERRIDE,
    });
    assert.equal(first.deliveryOutcome, "sent");
    assert.equal(first.emailSent, true);
    assert.equal(sender.calls.length, 1);

    const second = await executeAgentOsCadence({
      mode: "scheduled-live",
      cadenceId: "cos-daily-synthesis",
      allowDurableTest: true,
      store,
      nowIso: "2026-08-07T15:00:00.000Z",
      emailSender: sender,
      emailConfigOverride: EMAIL_OVERRIDE,
    });
    assert.equal(second.emailSent, false);
    assert.equal(second.deliveryOutcome, "skipped_with_reason");
    assert.ok(second.suppressionReason);
    assert.match(
      `${second.safeSummary} ${second.suppressionReason}`,
      /already|not due|terminal|sent/i,
    );
    assert.equal(sender.calls.length, 1);
  });
});
