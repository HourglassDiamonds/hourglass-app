/**
 * Daily Chief of Staff brief — 7:00 AM America/New_York gate,
 * DST correctness, idempotency, and weekly anti-redundancy.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultCadenceDefinitions,
  evaluateCadence,
  FOUNDER_CADENCE_TIMEZONE,
  isAtOrAfterLocalTime,
  localCalendarStamp,
  timeZoneOffsetMinutes,
  utcIsoForLocalWallTime,
} from "./persistence";
import {
  createFakeEmailSender,
  executeAgentOsCadence,
  weeklyFounderBriefOccupiesLocalDate,
} from "./cadence-delivery";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import {
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  type AgentOsDeliveryRecord,
  type CadenceDefinition,
} from "./persistence/types";
import { operatingBacklogForCadenceSendPath } from "./operating-backlog";

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

describe("cos-daily-synthesis local 7:00 AM America/New_York gate", () => {
  it("seeds localEligibleAt at 07:00 in founder timezone", () => {
    const daily = dailyCadence();
    assert.equal(daily.timezone, FOUNDER_CADENCE_TIMEZONE);
    assert.deepEqual(daily.localEligibleAt, { hour: 7, minute: 0 });
  });

  it("is not eligible immediately before 7:00 AM Eastern Daylight Time", () => {
    // 2026-07-15 06:59 EDT = 10:59 UTC (EDT = UTC-4)
    const nowIso = "2026-07-15T10:59:00.000Z";
    const stamp = localCalendarStamp(nowIso, FOUNDER_CADENCE_TIMEZONE);
    assert.equal(stamp.date, "2026-07-15");
    assert.equal(stamp.hour, 6);
    assert.equal(stamp.minute, 59);
    assert.equal(stamp.offsetMinutes, -240);
    assert.equal(isAtOrAfterLocalTime(nowIso, FOUNDER_CADENCE_TIMEZONE, 7, 0), false);

    const ev = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso,
    });
    assert.equal(ev.shouldProceed, false);
    assert.ok(ev.reasonCodes.includes("local-time-before-window"));
    assert.ok(ev.reasonCodes.includes("not-due"));
  });

  it("becomes eligible at exactly 7:00 AM Eastern Daylight Time", () => {
    // 2026-07-15 07:00 EDT = 11:00 UTC
    const nowIso = "2026-07-15T11:00:00.000Z";
    assert.equal(isAtOrAfterLocalTime(nowIso, FOUNDER_CADENCE_TIMEZONE, 7, 0), true);
    const stamp = localCalendarStamp(nowIso, FOUNDER_CADENCE_TIMEZONE);
    assert.equal(stamp.hour, 7);
    assert.equal(stamp.minute, 0);

    const ev = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso,
    });
    assert.equal(ev.shouldProceed, true);
    assert.ok(ev.reasonCodes.includes("due"));
  });

  it("remains discoverable shortly after 7:00 AM", () => {
    const nowIso = "2026-07-15T11:05:00.000Z"; // 07:05 EDT
    const ev = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso,
    });
    assert.equal(ev.shouldProceed, true);
    assert.ok(ev.reasonCodes.includes("due"));
  });

  it("EST conversion is correct (not fixed UTC hour)", () => {
    // 2026-01-15 06:59 EST = 11:59 UTC (EST = UTC-5)
    const before = "2026-01-15T11:59:00.000Z";
    assert.equal(timeZoneOffsetMinutes(before, FOUNDER_CADENCE_TIMEZONE), -300);
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: before,
      }).shouldProceed,
      false,
    );

    // 2026-01-15 07:00 EST = 12:00 UTC
    const at = "2026-01-15T12:00:00.000Z";
    assert.equal(timeZoneOffsetMinutes(at, FOUNDER_CADENCE_TIMEZONE), -300);
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: at,
      }).shouldProceed,
      true,
    );
  });

  it("EDT conversion is correct (not fixed UTC hour)", () => {
    assert.equal(
      timeZoneOffsetMinutes("2026-07-15T11:00:00.000Z", FOUNDER_CADENCE_TIMEZONE),
      -240,
    );
    assert.notEqual(
      timeZoneOffsetMinutes("2026-01-15T12:00:00.000Z", FOUNDER_CADENCE_TIMEZONE),
      timeZoneOffsetMinutes("2026-07-15T11:00:00.000Z", FOUNDER_CADENCE_TIMEZONE),
    );
  });

  it("spring-forward day still gates on local 7:00 (EDT after transition)", () => {
    // US spring forward 2026-03-08 02:00 → 03:00. 07:00 EDT = 11:00 UTC.
    const before = "2026-03-08T10:59:00.000Z"; // 06:59 EDT
    const at = "2026-03-08T11:00:00.000Z"; // 07:00 EDT
    assert.equal(
      localCalendarStamp(before, FOUNDER_CADENCE_TIMEZONE).offsetMinutes,
      -240,
    );
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: before,
      }).shouldProceed,
      false,
    );
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: at,
      }).shouldProceed,
      true,
    );
    const wall = utcIsoForLocalWallTime("2026-03-08", 7, 0, FOUNDER_CADENCE_TIMEZONE);
    assert.equal(localCalendarStamp(wall, FOUNDER_CADENCE_TIMEZONE).hour, 7);
    assert.equal(localCalendarStamp(wall, FOUNDER_CADENCE_TIMEZONE).date, "2026-03-08");
  });

  it("fall-back day still gates on local 7:00 (EST after transition)", () => {
    // US fall back 2026-11-01 02:00 → 01:00. 07:00 EST = 12:00 UTC.
    const before = "2026-11-01T11:59:00.000Z"; // 06:59 EST
    const at = "2026-11-01T12:00:00.000Z"; // 07:00 EST
    assert.equal(
      localCalendarStamp(at, FOUNDER_CADENCE_TIMEZONE).offsetMinutes,
      -300,
    );
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: before,
      }).shouldProceed,
      false,
    );
    assert.equal(
      evaluateCadence({
        cadence: dailyCadence({ lastSuccessfulAt: null }),
        nowIso: at,
      }).shouldProceed,
      true,
    );
  });

  it("only one daily occurrence per New York local date", () => {
    const nowIso = "2026-07-15T14:00:00.000Z"; // 10:00 EDT — after gate
    const first = evaluateCadence({
      cadence: dailyCadence({ lastSuccessfulAt: null }),
      nowIso,
    });
    assert.equal(first.shouldProceed, true);

    const second = evaluateCadence({
      cadence: dailyCadence({
        lastSuccessfulAt: "2026-07-15T11:00:00.000Z", // succeeded at 07:00 EDT same day
      }),
      nowIso,
    });
    assert.equal(second.shouldProceed, false);
    assert.ok(second.reasonCodes.includes("already-ran-local-date"));
  });

  it("next local morning is eligible after prior local-date success", () => {
    const nowIso = "2026-07-16T11:00:00.000Z"; // next day 07:00 EDT
    const ev = evaluateCadence({
      cadence: dailyCadence({
        lastSuccessfulAt: "2026-07-15T11:00:00.000Z",
      }),
      nowIso,
    });
    assert.equal(ev.shouldProceed, true);
  });
});

describe("daily delivery idempotency + fake email", () => {
  it("repeated scheduler calls do not duplicate the same daily delivery", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const nowIso = "2026-07-15T11:10:00.000Z";

    const first = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(first.ok, true);
    assert.equal(first.emailSent, true);
    assert.equal(sender.calls.length, 1);

    const second = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(second.ok, true);
    assert.equal(second.emailSent, false);
    assert.equal(sender.calls.length, 1);
    assert.ok(
      second.deliveryStatus === "sent" ||
        second.deliveryAction === "suppressed" ||
        second.safeSummary.toLowerCase().includes("already"),
    );
  });

  it("does not send real external email during tests", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: "2026-07-15T12:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.ok(sender.calls.length <= 1);
    // Fake sender records calls locally — never Resend.
    assert.equal(typeof sender.calls[0]?.toAlias, "string");
  });
});

describe("weekly vs daily independent Monday delivery", () => {
  it("weekly and daily can coexist on different local dates", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();

    const weekly = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-13T12:00:00.000Z", // Monday
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(weekly.emailSent, true);

    const daily = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: "2026-07-14T12:00:00.000Z", // Tuesday — different local date
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(daily.emailSent, true);
    assert.equal(sender.calls.length, 2);
  });

  it("successfully delivered weekly does not suppress daily on the same local date", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const nowIso = "2026-07-20T12:00:00.000Z"; // 08:00 EDT Monday

    const weekly = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(weekly.emailSent, true);
    assert.equal(weekly.ok, true);

    const localDate = localCalendarStamp(nowIso, FOUNDER_CADENCE_TIMEZONE).date;
    assert.equal(
      weeklyFounderBriefOccupiesLocalDate(store.snapshot(), localDate),
      false,
    );

    const daily = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(daily.ok, true);
    assert.equal(daily.emailSent, true);
    assert.equal(sender.calls.length, 2);
  });

  it("weekly send-nothing does not erase a valid daily brief", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const nowIso = "2026-07-21T12:00:00.000Z";
    const localDate = localCalendarStamp(nowIso, FOUNDER_CADENCE_TIMEZONE).date;

    // Seed a failed weekly founder-brief attempt (not a successful claim/send)
    const failed: AgentOsDeliveryRecord = {
      schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
      deliveryId: "del:weekly-failed-test",
      idempotencyKey: "idem:weekly-failed-test",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      runId: "run-weekly-fail",
      briefFingerprint: "fp-weekly-fail",
      recipientConfigFingerprint: "rcp-test",
      kind: "founder-brief",
      status: "failed",
      suppressionReason: null,
      providerMessageId: null,
      errorSummary: "simulated failure",
      reservedAt: nowIso,
      updatedAt: nowIso,
      sentAt: null,
      leaseExpiresAt: null,
      claimOwner: null,
      resolutionAudit: [],
    };
    const state = store.snapshot();
    state.deliveries[failed.deliveryId] = failed;
    await store.save(state);

    assert.equal(
      weeklyFounderBriefOccupiesLocalDate(store.snapshot(), localDate),
      false,
    );

    const daily = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(daily.ok, true);
    assert.equal(daily.emailSent, true);
    assert.equal(sender.calls.length, 1);
  });

  it("weekly failure-alert does not suppress daily founder brief", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const nowIso = "2026-07-22T12:00:00.000Z";
    const localDate = localCalendarStamp(nowIso, FOUNDER_CADENCE_TIMEZONE).date;

    const alert: AgentOsDeliveryRecord = {
      schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
      deliveryId: "del:weekly-alert-test",
      idempotencyKey: "idem:weekly-alert-test",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      runId: "run-weekly-alert",
      briefFingerprint: "fp-alert",
      recipientConfigFingerprint: "rcp-test",
      kind: "failure-alert",
      status: "sent",
      suppressionReason: null,
      providerMessageId: "msg_alert",
      errorSummary: null,
      reservedAt: nowIso,
      updatedAt: nowIso,
      sentAt: nowIso,
      leaseExpiresAt: null,
      claimOwner: null,
      resolutionAudit: [],
    };
    const state = store.snapshot();
    state.deliveries[alert.deliveryId] = alert;
    await store.save(state);

    assert.equal(
      weeklyFounderBriefOccupiesLocalDate(store.snapshot(), localDate),
      false,
    );

    const daily = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(daily.emailSent, true);
  });
});
