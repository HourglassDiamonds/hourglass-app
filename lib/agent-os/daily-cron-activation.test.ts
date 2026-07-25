/**
 * Vercel cron registration for daily Chief of Staff cadence —
 * dual UTC schedules + America/New_York gate semantics.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createFakeEmailSender,
  executeAgentOsCadence,
} from "./cadence-delivery";
import {
  defaultCadenceDefinitions,
  evaluateCadence,
  FOUNDER_CADENCE_TIMEZONE,
} from "./persistence";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import type { CadenceDefinition } from "./persistence/types";

const EMAIL_OVERRIDE = {
  apiKey: "re_test_key_not_real",
  from: "agent-os@example.com",
  to: "founder@example.com",
  recipientAlias: "founder-primary",
};

function dailyCadence(
  overrides: Partial<CadenceDefinition> = {},
): CadenceDefinition {
  const base = defaultCadenceDefinitions().find(
    (c) => c.cadenceId === "cos-daily-synthesis",
  )!;
  return { ...base, ...overrides };
}

function agentOsCronSchedules(): string[] {
  const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
  const config = JSON.parse(raw) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  return (config.crons ?? [])
    .filter((c) => c.path === "/api/cron/agent-os-cadence")
    .map((c) => c.schedule)
    .sort();
}

describe("vercel.json Agent OS daily cron registration", () => {
  it("registers dual UTC schedules for 07:00 America/New_York across DST", () => {
    const schedules = agentOsCronSchedules();
    // 11:00 UTC = 07:00 EDT; 12:00 UTC = 07:00 EST
    assert.deepEqual(schedules, ["0 11 * * *", "0 12 * * *"]);
  });

  it("does not introduce a competing Agent OS scheduler path", () => {
    const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    const agentOs = (config.crons ?? []).filter((c) =>
      c.path.includes("agent-os"),
    );
    assert.equal(agentOs.length, 2);
    assert.ok(agentOs.every((c) => c.path === "/api/cron/agent-os-cadence"));
  });
});

describe("dual UTC cron + New York gate (EST / EDT)", () => {
  it("EDT: 11:00 UTC is eligible; early 10:59 UTC is not", () => {
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: "2026-07-15T10:59:00.000Z",
      }).shouldProceed,
      false,
    );
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: "2026-07-15T11:00:00.000Z",
      }).shouldProceed,
      true,
    );
  });

  it("EST: 11:00 UTC is before gate; 12:00 UTC is eligible", () => {
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: "2026-01-15T11:00:00.000Z", // 06:00 EST
      }).shouldProceed,
      false,
    );
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: "2026-01-15T12:00:00.000Z", // 07:00 EST
      }).shouldProceed,
      true,
    );
  });

  it("EDT second fire (12:00 UTC) is a no-op after same-day success at 11:00 UTC", () => {
    const afterFirst = evaluateCadence({
      cadence: dailyCadence({
        lastSuccessfulAt: "2026-07-15T11:00:00.000Z",
      }),
      nowIso: "2026-07-15T12:00:00.000Z", // 08:00 EDT
    });
    assert.equal(afterFirst.shouldProceed, false);
    assert.ok(afterFirst.reasonCodes.includes("already-ran-local-date"));
  });

  it("EST first fire (11:00 UTC) skips; second fire (12:00 UTC) proceeds", () => {
    const early = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso: "2026-01-15T11:00:00.000Z",
    });
    assert.equal(early.shouldProceed, false);
    assert.ok(early.reasonCodes.includes("local-time-before-window"));

    const atGate = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso: "2026-01-15T12:00:00.000Z",
    });
    assert.equal(atGate.shouldProceed, true);
  });
});

describe("late cron invocation and failed-delivery recovery", () => {
  it("delayed fire after 07:00 local still discovers the day (no silent skip)", () => {
    // 14:00 UTC = 10:00 EDT — well after the gate, never succeeded today
    const late = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso: "2026-07-15T14:00:00.000Z",
    });
    assert.equal(late.shouldProceed, true);
    assert.ok(late.reasonCodes.includes("due"));
  });

  it("failed prior attempt does not block a later same-day retry send", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const failSender = createFakeEmailSender({ fail: true });
    const nowIso = "2026-07-15T11:05:00.000Z";

    const failed = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: failSender,
    });
    assert.equal(failed.emailSent, false);
    assert.ok(
      failed.deliveryStatus === "failed" || failed.ok === false,
      `expected failed delivery, got ${failed.deliveryStatus}`,
    );

    // Gate still allows proceed when lastSuccessfulAt is unset
    const ev = evaluateCadence({
      cadence: dailyCadence({
        lastSuccessfulAt: null,
        lastAttemptedAt: nowIso,
      }),
      nowIso: "2026-07-15T12:05:00.000Z",
    });
    assert.equal(ev.shouldProceed, true);

    const retrySender = createFakeEmailSender();
    const retry = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: "2026-07-15T12:05:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: retrySender,
    });
    assert.equal(retry.ok, true);
    assert.equal(retry.emailSent, true);
    assert.equal(retrySender.calls.length, 1);
  });

  it("duplicate scheduled invocations send at most one founder email", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const firstIso = "2026-07-15T11:00:00.000Z";
    const secondIso = "2026-07-15T12:00:00.000Z";

    const first = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: firstIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(first.emailSent, true);

    const second = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: secondIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(second.emailSent, false);
    assert.equal(sender.calls.length, 1);
  });

  it("timezone constant remains America/New_York", () => {
    assert.equal(FOUNDER_CADENCE_TIMEZONE, "America/New_York");
  });
});
