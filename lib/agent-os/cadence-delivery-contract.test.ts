/**
 * P0-COS-3 delivery contract: guaranteed Daily/Weekly founder emails.
 * Isolated durable-test store. Fake provider. No real email.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFakeEmailSender,
  executeAgentOsCadence,
  evaluateDeliveryEligibility,
  officialWindowHasAcceptedSend,
  isOfficialGuaranteedWindowOpen,
  officialInProgressKey,
} from "./cadence-delivery";
import { DurableTestPersistenceAdapter } from "./persistence/adapters/durable-test";
import { evaluateCadence } from "./persistence/evaluate-cadence";
import { getCadenceById } from "./persistence/cadence";
import { operatingBacklogForCadenceSendPath } from "./operating-backlog";
import { EXECUTIVE_REGISTRY, listExecutives } from "./registry";
import { JULY_28_FAILED_BRIEF } from "./fixtures/july-28-failed-brief";
import { AGENT_OS_VERSION } from "./types";
import type { AgentRun, FounderBrief } from "./types";
import type { AgentOsEmailSender } from "./cadence-delivery/send-email";

const EMAIL = {
  apiKey: "re_test_fake_key",
  from: "Hourglass Chief of Staff <brief@updates.example.test>",
  to: "justin@hourglassdiamonds.com",
  recipientAlias: "founder",
};

/** Monday 17 Aug 2026 07:00 EDT */
const EDT_MONDAY_7AM = "2026-08-17T11:00:00.000Z";
/** Monday 17 Aug 2026 08:00 EDT */
const EDT_MONDAY_8AM = "2026-08-17T12:00:00.000Z";
/** Monday 12 Jan 2026 07:00 EST */
const EST_MONDAY_7AM = "2026-01-12T12:00:00.000Z";
const PRIOR_TUESDAY = "2026-08-11T12:41:00.107Z";
const NEXT_DAY_7AM = "2026-08-18T11:00:00.000Z";

function quietBrief(): FounderBrief {
  return {
    whatChanged: "No material day-over-day signal.",
    whyItMatters: "No high-confidence founder action required today.",
    needsAttentionToday: [],
    highestRoiAction: "No high-confidence founder action required today.",
    canSafelyWait: [],
    blocked: [],
    founderDecisionNeeded: [],
    missingOrUnreliableData: [],
    markdown: "# Quiet",
    surfacedPriorityTitles: [],
    sprintOrientation: null,
    opportunityToWatch: null,
  };
}

function stubRun(brief: FounderBrief, extras?: Partial<AgentRun>): AgentRun {
  return {
    runId: "run-contract",
    generatedAt: EDT_MONDAY_7AM,
    mode: "fixture",
    reportingPeriod: {
      start: "2026-08-10",
      end: "2026-08-16",
    },
    executivesInvoked: [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ],
    executivesNotOperational: [],
    sourcesAttempted: [],
    sourceHealth: [],
    recommendations: [],
    anomalies: [],
    dataGaps: [],
    escalationItems: [],
    brief,
    runStatus: "completed",
    recommendationAvailability: "none-material",
    executiveStatuses: [],
    briefEvidenceQuality: "full",
    deliveryGuidance: "send-nothing",
    briefSurfacing: {
      opportunitiesDetected: 0,
      recommendationsRanked: 0,
      recommendationsSurfacedInBrief: 0,
    },
    durationMs: 1,
    warnings: [],
    agentOsVersion: AGENT_OS_VERSION,
    ...extras,
  } as AgentRun;
}

function failOnceThenOk(): AgentOsEmailSender & {
  calls: Array<{ subject: string; text: string }>;
} {
  const base = createFakeEmailSender({ messageId: "msg_catchup" });
  let fails = 1;
  const sender = (async (input) => {
    if (fails > 0) {
      fails -= 1;
      base.calls.push({
        subject: input.rendered.subject,
        text: input.rendered.text,
        html: input.rendered.html,
        toAlias: input.config.recipientAlias,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: false, uncertain: false, error: "simulated-failure" };
    }
    return base(input);
  }) as AgentOsEmailSender & { calls: typeof base.calls };
  sender.calls = base.calls;
  return sender;
}

describe("P0-COS-3 guaranteed Daily/Weekly delivery contract", () => {
  it("Z — five executives remain unchanged", () => {
    assert.equal(EXECUTIVE_REGISTRY.length, 5);
    assert.deepEqual(
      listExecutives().map((e) => e.id),
      [
        "chief-of-staff",
        "business-intelligence",
        "search-strategy",
        "content",
        "opportunity",
      ],
    );
  });

  it("S — malformed July 28 brief still fails quality gate", () => {
    const el = evaluateDeliveryEligibility({
      run: stubRun(JULY_28_FAILED_BRIEF, {
        deliveryGuidance: "send-normal-brief",
      }),
      persistenceOk: true,
      intent: "daily",
    });
    assert.equal(el.action, "send-nothing");
    assert.match(el.reason, /quality gate/i);
  });

  it("T/W — official quiet all-clear passes; HubSpot gap does not block", () => {
    const el = evaluateDeliveryEligibility({
      run: stubRun({
        ...quietBrief(),
        missingOrUnreliableData: ["HubSpot aggregates unavailable"],
      }),
      persistenceOk: true,
      intent: "daily",
    });
    assert.equal(el.action, "send-founder-brief");
    if (el.action === "send-founder-brief") {
      assert.equal(el.allClear, true);
    }
    const weeklyEl = evaluateDeliveryEligibility({
      run: stubRun(quietBrief(), { deliveryGuidance: "send-nothing" }),
      persistenceOk: true,
      intent: "weekly",
    });
    assert.equal(weeklyEl.action, "send-founder-brief");
    if (weeklyEl.action === "send-founder-brief") {
      assert.equal(weeklyEl.allClear, true);
    }
  });

  it("U/V/I — Weekly is Monday-anchored in EDT and EST; Tuesday send does not block next Monday", () => {
    const weekly = getCadenceById("cos-weekly-founder-brief")!;
    const mondayEdt = evaluateCadence({
      cadence: { ...weekly, lastSuccessfulAt: PRIOR_TUESDAY },
      nowIso: EDT_MONDAY_7AM,
    });
    assert.equal(mondayEdt.shouldProceed, true);
    assert.ok(!mondayEdt.reasonCodes.includes("weekday-outside-window"));

    const mondayEst = evaluateCadence({
      cadence: { ...weekly, lastSuccessfulAt: "2026-01-06T12:00:00.000Z" },
      nowIso: EST_MONDAY_7AM,
    });
    assert.equal(mondayEst.shouldProceed, true);

    const tuesday = evaluateCadence({
      cadence: { ...weekly, lastSuccessfulAt: PRIOR_TUESDAY },
      nowIso: NEXT_DAY_7AM,
    });
    assert.equal(tuesday.shouldProceed, false);
    assert.ok(tuesday.reasonCodes.includes("weekday-outside-window"));

    const beforeGate = evaluateCadence({
      cadence: { ...weekly, lastSuccessfulAt: PRIOR_TUESDAY },
      nowIso: "2026-08-17T10:59:00.000Z",
    });
    assert.equal(beforeGate.shouldProceed, false);
    assert.ok(beforeGate.reasonCodes.includes("local-time-before-window"));
  });

  it("A — Daily due + material brief sends exactly once", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(first.emailSent, true);
    assert.equal(first.deliveryOutcome, "sent");
    const second = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_8AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
      operatingBacklog: operatingBacklogForCadenceSendPath(),
    });
    assert.equal(second.emailSent, false);
    assert.equal(sender.calls.length, 1);
    assert.ok(
      officialWindowHasAcceptedSend(
        store.snapshot(),
        "cos-daily-synthesis",
        "day:2026-08-17",
      ),
    );
  });

  it("B/C/D/F/X/Y — quiet Daily sends all-clear once; success requires provider row", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const before = store.snapshot().cadences["cos-daily-synthesis"]?.lastSuccessfulAt;
    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(first.emailSent, true);
    assert.notEqual(first.deliveryAction, "send-nothing");
    assert.match(sender.calls[0]!.text, /No material founder priorities require action today/i);
    assert.doesNotMatch(sender.calls[0]!.html, /Client Attention/i);
    assert.doesNotMatch(sender.calls[0]!.html, /Highest-ROI|Top priorities/i);
    const after = store.snapshot();
    assert.notEqual(after.cadences["cos-daily-synthesis"]?.lastSuccessfulAt, before);
    assert.ok(
      officialWindowHasAcceptedSend(after, "cos-daily-synthesis", "day:2026-08-17"),
    );
    const retry = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_8AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(retry.emailSent, false);
    assert.equal(sender.calls.length, 1);
  });

  it("E/P/Q — Daily 7 AM hard failure stays unsatisfied; 8 AM catch-up sends once", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = failOnceThenOk();
    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(first.emailSent, false);
    assert.equal(first.ok, false);
    const mid = store.snapshot();
    assert.equal(mid.cadences["cos-daily-synthesis"]?.lastSuccessfulAt, null);
    assert.equal(
      officialWindowHasAcceptedSend(mid, "cos-daily-synthesis", "day:2026-08-17"),
      false,
    );
    const daily = mid.cadences["cos-daily-synthesis"]!;
    assert.equal(isOfficialGuaranteedWindowOpen(daily, mid, EDT_MONDAY_8AM), true);

    const second = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_8AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(second.emailSent, true);
    const sent = Object.values(store.snapshot().deliveries).filter(
      (d) =>
        d.cadenceId === "cos-daily-synthesis" &&
        d.cadenceWindow === "day:2026-08-17" &&
        d.status === "sent",
    );
    assert.equal(sent.length, 1);
  });

  it("G/H/N — Weekly Monday still sends after prior Tuesday; quiet all-clear; no duplicate", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    const weekly = prior.cadences["cos-weekly-founder-brief"]!;
    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-weekly-founder-brief": {
          ...weekly,
          lastSuccessfulAt: PRIOR_TUESDAY,
        },
      },
    });
    const sender = createFakeEmailSender();
    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      store,
      nowIso: EDT_MONDAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(first.emailSent, true);
    assert.match(first.officialCadenceWindow ?? "", /week:2026-W34/);
    assert.match(
      sender.calls[0]!.subject,
      /Weekly Brief/i,
    );
    const second = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      store,
      nowIso: EDT_MONDAY_8AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(second.emailSent, false);
    assert.equal(sender.calls.length, 1);
  });

  it("J/K/L — Monday Daily + Weekly both deliver independently", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...prior.cadences["cos-daily-synthesis"]!,
          lastSuccessfulAt: "2026-08-16T12:00:00.000Z",
        },
        "cos-weekly-founder-brief": {
          ...prior.cadences["cos-weekly-founder-brief"]!,
          lastSuccessfulAt: PRIOR_TUESDAY,
        },
      },
    });
    const sender = createFakeEmailSender();
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      store,
      nowIso: EDT_MONDAY_8AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(result.emailSent, true);
    const kinds = new Set(sender.calls.map((c) => c.subject));
    assert.equal(sender.calls.length, 2);
    assert.ok([...kinds].some((s) => /Morning Brief/i.test(s)));
    assert.ok([...kinds].some((s) => /Weekly Brief/i.test(s)));
    const snap = store.snapshot();
    assert.ok(
      officialWindowHasAcceptedSend(snap, "cos-daily-synthesis", "day:2026-08-17"),
    );
    assert.ok(
      officialWindowHasAcceptedSend(
        snap,
        "cos-weekly-founder-brief",
        "week:2026-W34",
      ),
    );
    assert.equal(
      snap.inProgressByScope[officialInProgressKey("cos-daily-synthesis")],
      undefined,
    );
  });

  it("O — manual preview does not send or consume official identity", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      runMode: "manual-preview",
      cadenceId: "cos-daily-synthesis",
      allowDurableTest: true,
      store,
      nowIso: EDT_MONDAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
      includePreviewRender: true,
    });
    assert.equal(result.emailSent, false);
    assert.equal(sender.calls.length, 0);
    assert.match(String(result.cadenceWindow), /manual-preview/);
    assert.equal(
      officialWindowHasAcceptedSend(
        store.snapshot(),
        "cos-daily-synthesis",
        "day:2026-08-17",
      ),
      false,
    );
    assert.equal(
      store.snapshot().cadences["cos-daily-synthesis"]?.lastSuccessfulAt,
      null,
    );
  });

  it("R — catch-up does not replay the previous local date or last Monday", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const daily = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: NEXT_DAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(daily.emailSent, true);
    assert.equal(daily.officialCadenceWindow, "day:2026-08-18");
    assert.equal(
      officialWindowHasAcceptedSend(
        store.snapshot(),
        "cos-daily-synthesis",
        "day:2026-08-17",
      ),
      false,
    );

    const weekly = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      store,
      nowIso: NEXT_DAY_7AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(weekly.emailSent, false);
    assert.match(String(weekly.suppressionReason ?? weekly.safeSummary), /not due/i);
  });

  it("false lastSuccessfulAt without a sent row does not close Daily", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const prior = await store.load();
    await store.save({
      ...prior,
      cadences: {
        ...prior.cadences,
        "cos-daily-synthesis": {
          ...prior.cadences["cos-daily-synthesis"]!,
          lastSuccessfulAt: EDT_MONDAY_7AM,
        },
      },
    });
    const sender = createFakeEmailSender();
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-daily-synthesis",
      store,
      nowIso: EDT_MONDAY_8AM,
      emailConfigOverride: EMAIL,
      emailSender: sender,
    });
    assert.equal(result.emailSent, true);
    assert.ok(
      officialWindowHasAcceptedSend(
        store.snapshot(),
        "cos-daily-synthesis",
        "day:2026-08-17",
      ),
    );
  });
});
