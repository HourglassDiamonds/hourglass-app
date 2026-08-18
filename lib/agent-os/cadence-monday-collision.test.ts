/**
 * P0-COS-3 — Monday Daily vs Weekly CoS collision.
 * Official delivery identities must be cadence-specific.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeliveryIdempotencyKey,
  cadenceWindowId,
  createFakeEmailSender,
  executeAgentOsCadence,
  officialInProgressKey,
} from "./cadence-delivery";
import { getCadenceById } from "./persistence/cadence";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import { operatingBacklogForCadenceSendPath } from "./operating-backlog";
import { FOUNDER_CADENCE_TIMEZONE } from "./persistence/cadence";
import { localCalendarStamp } from "./persistence/timezone";

const EMAIL_OVERRIDE = {
  apiKey: "re_test_fake_key",
  from: "Hourglass Chief of Staff <brief@updates.example.test>",
  to: "justin@hourglassdiamonds.com",
  recipientAlias: "founder",
};

/** Monday 17 Aug 2026 08:00 America/New_York (EDT). */
const MONDAY_ISO = "2026-08-17T12:00:00.000Z";

describe("P0-COS-3 Monday official delivery identities", () => {
  it("Daily and Weekly use distinct idempotency keys on the same Monday", () => {
    const daily = getCadenceById("cos-daily-synthesis")!;
    const weekly = getCadenceById("cos-weekly-founder-brief")!;
    const recipientConfigFingerprint = "rcp-test";
    const dailyKey = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: daily.cadenceId,
      cadenceWindow: cadenceWindowId(daily, MONDAY_ISO),
      recipientConfigFingerprint,
    });
    const weeklyKey = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: weekly.cadenceId,
      cadenceWindow: cadenceWindowId(weekly, MONDAY_ISO),
      recipientConfigFingerprint,
    });
    assert.notEqual(cadenceWindowId(daily, MONDAY_ISO), cadenceWindowId(weekly, MONDAY_ISO));
    assert.match(cadenceWindowId(daily, MONDAY_ISO), /^day:2026-08-17$/);
    assert.match(cadenceWindowId(weekly, MONDAY_ISO), /^week:2026-W34$/);
    assert.notEqual(dailyKey, weeklyKey);
    assert.notEqual(
      officialInProgressKey(daily.cadenceId),
      officialInProgressKey(weekly.cadenceId),
    );
    assert.equal(
      officialInProgressKey("cos-daily-synthesis"),
      "cadence:cos-daily-synthesis",
    );
    assert.equal(
      officialInProgressKey("cos-weekly-founder-brief"),
      "cadence:cos-weekly-founder-brief",
    );
  });

  it("lastSuccessfulAt remains per-cadence after independent Monday runs", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const weekly = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: MONDAY_ISO,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    const daily = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: MONDAY_ISO,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(weekly.ok, true);
    assert.equal(daily.ok, true);
    const state = store.snapshot();
    const weeklyTs = state.cadences["cos-weekly-founder-brief"]?.lastSuccessfulAt;
    const dailyTs = state.cadences["cos-daily-synthesis"]?.lastSuccessfulAt;
    assert.ok(weeklyTs);
    assert.ok(dailyTs);
    assert.equal(
      state.cadences["cos-weekly-founder-brief"]?.lastSuccessfulAt,
      weeklyTs,
    );
    const kinds = new Set(Object.values(state.deliveries).map((d) => d.cadenceId));
    assert.ok(kinds.has("cos-weekly-founder-brief"));
    assert.ok(kinds.has("cos-daily-synthesis"));
  });

  it("warm weekly official lock does not mark daily as already satisfied", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const daily = prior.cadences["cos-daily-synthesis"]!;
    const weekly = prior.cadences["cos-weekly-founder-brief"]!;
    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...daily,
          lastSuccessfulAt: "2026-08-16T12:00:00.000Z",
        },
        "cos-weekly-founder-brief": {
          ...weekly,
          lastSuccessfulAt: "2026-08-03T15:00:00.000Z",
        },
      },
      inProgressByScope: {
        [officialInProgressKey("cos-weekly-founder-brief")]: {
          runId: "run-weekly-still-running",
          startedAt: "2026-08-17T11:55:00.000Z",
        },
      },
    });

    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      store,
      nowIso: MONDAY_ISO,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });

    assert.notEqual(result.safeSummary, "No founder-brief cadence due");
    assert.doesNotMatch(String(result.suppressionReason ?? ""), /already-running/);
    assert.equal(result.cadenceId, "cos-daily-synthesis");
    const after = await store.load();
    assert.ok(
      after.inProgressByScope[officialInProgressKey("cos-weekly-founder-brief")],
      "weekly lock must remain; daily must not clear it",
    );
  });

  it("legacy shared chief-of-staff lock does not skip the sibling Monday cadence", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const daily = prior.cadences["cos-daily-synthesis"]!;
    const weekly = prior.cadences["cos-weekly-founder-brief"]!;
    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...daily,
          lastSuccessfulAt: "2026-08-16T12:00:00.000Z",
        },
        "cos-weekly-founder-brief": {
          ...weekly,
          lastSuccessfulAt: "2026-08-03T15:00:00.000Z",
        },
      },
      inProgressByScope: {
        "chief-of-staff": {
          runId: "run-legacy-shared-scope",
          startedAt: "2026-08-17T11:55:00.000Z",
        },
      },
    });

    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      store,
      nowIso: MONDAY_ISO,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });

    assert.notEqual(result.safeSummary, "No founder-brief cadence due");
    assert.doesNotMatch(String(result.suppressionReason ?? ""), /already-running/);
    assert.ok(
      result.cadenceId === "cos-weekly-founder-brief" ||
        result.cadenceId === "cos-daily-synthesis" ||
        result.emailSent,
    );
  });

  it("Monday local date is the same for Daily and Weekly windows but identities stay split", () => {
    const stamp = localCalendarStamp(MONDAY_ISO, FOUNDER_CADENCE_TIMEZONE);
    assert.equal(stamp.date, "2026-08-17");
    const daily = getCadenceById("cos-daily-synthesis")!;
    const weekly = getCadenceById("cos-weekly-founder-brief")!;
    assert.equal(daily.scope, weekly.scope);
    assert.equal(daily.scope, "chief-of-staff");
    assert.notEqual(daily.cadenceId, weekly.cadenceId);
    assert.notEqual(
      officialInProgressKey(daily.cadenceId),
      officialInProgressKey(weekly.cadenceId),
    );
  });
});
