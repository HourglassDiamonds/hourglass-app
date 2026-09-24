import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COS_DOCKET_TITLE,
  TODAY_DOCKET_VERSION,
  type CosTodayDocketView,
} from "./docket";
import type { TodayBriefingPacket } from "./briefing-packet";
import type { CosBriefingV1 } from "./cos-briefing-v1";
import type { CosDocketItemView } from "./types";
import {
  noteCosFeedbackUnavailable,
  refreshCosFeedback,
  resetCosFeedbackCache,
  type CosFeedbackSettleRoute,
} from "@/lib/continuum/cos-feedback/feedback";
import {
  COS_FEEDBACK_SETTLE_EVENT,
  COS_FEEDBACK_SETTLE_FIELDS,
  emitCosFeedbackSettle,
  type CosFeedbackSettleEvent,
} from "@/lib/continuum/cos-feedback/settle-telemetry";

const NOW = "2026-09-23T14:00:00.000Z";
const ROUTE: CosFeedbackSettleRoute = { provider: "openai", model: "gpt-5.6-sol" };
const SECRET_NAME = "Harborlane Client";
const SECRET_STATE = "Review the private CAD note.";
const SECRET_DATE = "2026-11-02";
const SECRET_MAIL = "founder@harborlane.example";
const SECRET_PHONE = "555-0148";
const SECRET_REF = "gmail:harborlane";

function packet(partial: Partial<TodayBriefingPacket> & Pick<TodayBriefingPacket, "displayName">): TodayBriefingPacket {
  return {
    itemId: partial.itemId ?? "harborlane",
    displayName: partial.displayName,
    entityType: "client",
    briefingKind: "client_work",
    projectName: partial.displayName,
    projectId: "project",
    personId: null,
    organizationLabel: null,
    vendorContactName: null,
    identifiers: [],
    lifecycle: null,
    latestMeaningfulExternalEvent: null,
    latestMeaningfulFounderAction: null,
    ballHolder: "founder",
    unresolvedFounderObligation: null,
    externalCommitment: null,
    nextExpectedEvent: null,
    candidateNextAction: null,
    uncertainty: [],
    mustNotState: [],
    sourceRefs: partial.sourceRefs ?? [SECRET_REF],
  };
}

function focus(): CosDocketItemView {
  const briefing: CosBriefingV1 = {
    modelId: "cos-briefing-v1",
    currentState: SECRET_STATE,
    timingFacts: [
      {
        kind: "quoted_lead_time",
        statement: `Checkpoint ${SECRET_DATE}.`,
        anchorDate: SECRET_DATE,
        dueDate: SECRET_DATE,
        leadBusinessDays: null,
        sourceRefs: [SECRET_REF],
      },
    ],
    timingProse: null,
    checkpoint: null,
    checkpointProse: "",
    why: null,
    currentFounderAction: true,
  };
  return {
    id: "harborlane",
    lane: "live_work",
    origin: "brief",
    subject: SECRET_NAME,
    headline: SECRET_STATE,
    context: SECRET_MAIL,
    job: null,
    brief: null,
    decision: null,
    anomaly: null,
    briefingPacket: packet({ displayName: SECRET_NAME }),
    cosBriefing: briefing,
  };
}

function docket(): CosTodayDocketView {
  return {
    todayDocketVersion: TODAY_DOCKET_VERSION,
    title: COS_DOCKET_TITLE,
    items: [focus()],
    queuedCount: 0,
    watchingCount: 0,
    watching: [],
    showCaughtUp: false,
    showDisconnected: false,
    caughtUpHeading: "Caught up",
    caughtUpDetail: null,
    disconnectedHeading: null,
    disconnectedDetail: null,
  };
}

function acceptedBody() {
  return {
    portfolioSummary: "You have one real founder action.",
    founderGuidance: `${SECRET_NAME} first: ${SECRET_STATE} ${SECRET_MAIL} ${SECRET_PHONE} ${SECRET_DATE}`,
    focusOrder: [{ itemId: "harborlane", why: SECRET_STATE }],
    safeToIgnore: [],
  };
}

async function capture(run: () => Promise<void>): Promise<CosFeedbackSettleEvent[]> {
  const logs: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    await run();
  } finally {
    console.info = original;
  }
  return logs
    .map((line) => {
      try {
        return JSON.parse(line) as CosFeedbackSettleEvent;
      } catch {
        return null;
      }
    })
    .filter((event): event is CosFeedbackSettleEvent => event?.event === COS_FEEDBACK_SETTLE_EVENT);
}

function assertPrivate(event: CosFeedbackSettleEvent) {
  const line = JSON.stringify(event);
  assert.equal(Object.keys(event).sort().join(), [...COS_FEEDBACK_SETTLE_FIELDS].sort().join());
  assert.equal(event.toolsSent, false);
  assert.equal(event.feedbackContract, "cos-feedback-v1");
  assert.doesNotMatch(line, /Harborlane|private CAD|harborlane\.example|555-0148|2026-11-02|gmail:harborlane/i);
  assert.match(event.sourceWatermarkDigest, /^[a-f0-9]{12}$/);
  assert.match(event.portfolioDigest, /^[a-f0-9]{12}$/);
}

describe("cos feedback settle telemetry", () => {
  it("emits model_accepted without packet content or feedback prose", async () => {
    resetCosFeedbackCache();
    const events = await capture(async () => {
      await refreshCosFeedback({
        docket: docket(),
        sourceWatermark: "watermark-secret",
        nowIso: NOW,
        route: ROUTE,
        model: async () => acceptedBody(),
      });
    });
    assert.equal(events.length, 1);
    const event = events[0]!;
    assertPrivate(event);
    assert.equal(event.outcome, "model_accepted");
    assert.equal(event.validationResult, "accepted");
    assert.equal(event.cache, "miss");
    assert.equal(event.modelInvoked, true);
    assert.equal(event.provider, "openai");
    assert.equal(event.model, "gpt-5.6-sol");
    assert.equal(typeof event.latencyMs, "number");
    assert.equal((event.inputBytes ?? 0) > 0, true);
    assert.equal((event.outputBytes ?? 0) > 0, true);
    assert.doesNotMatch(event.sourceWatermarkDigest, /watermark-secret/);
  });

  it("emits deterministic_fallback with the rejection reason", async () => {
    resetCosFeedbackCache();
    const events = await capture(async () => {
      await refreshCosFeedback({
        docket: docket(),
        sourceWatermark: "watermark-secret",
        nowIso: NOW,
        route: ROUTE,
        model: async () => ({
          ...acceptedBody(),
          founderGuidance: "This is due on 2099-01-01.",
        }),
      });
    });
    assert.equal(events.length, 1);
    assertPrivate(events[0]!);
    assert.equal(events[0]?.outcome, "deterministic_fallback");
    assert.equal(events[0]?.validationResult, "invented_date");
    assert.equal(events[0]?.modelInvoked, true);
    assert.doesNotMatch(JSON.stringify(events[0]), /2099-01-01/);
  });

  it("emits provider_error and keeps the error text out of the log", async () => {
    resetCosFeedbackCache();
    const events = await capture(async () => {
      await refreshCosFeedback({
        docket: docket(),
        sourceWatermark: "watermark-secret",
        nowIso: NOW,
        route: ROUTE,
        model: async () => {
          throw new Error("sk-test-should-not-log");
        },
      });
    });
    assert.equal(events.length, 1);
    assertPrivate(events[0]!);
    assert.equal(events[0]?.outcome, "deterministic_fallback");
    assert.equal(events[0]?.validationResult, "provider_error");
    assert.equal(events[0]?.modelInvoked, true);
    assert.equal(events[0]?.outputBytes, null);
    assert.doesNotMatch(JSON.stringify(events[0]), /sk-test-should-not-log/);
  });

  it("emits cache_hit without claiming a model invocation", async () => {
    resetCosFeedbackCache();
    let calls = 0;
    const events = await capture(async () => {
      const input = {
        docket: docket(),
        sourceWatermark: "watermark-secret",
        nowIso: NOW,
        route: ROUTE,
        model: async () => {
          calls += 1;
          return acceptedBody();
        },
      };
      await refreshCosFeedback(input);
      await refreshCosFeedback(input);
    });
    assert.equal(calls, 1);
    assert.equal(events.length, 2);
    assert.equal(events[1]?.outcome, "cache_hit");
    assert.equal(events[1]?.cache, "hit");
    assert.equal(events[1]?.modelInvoked, false);
    assert.equal(events[1]?.validationResult, null);
    assert.equal(events[1]?.latencyMs, null);
    assert.equal(events[1]?.inputBytes, null);
    assert.equal(events[1]?.outputBytes, null);
    assert.equal(events[1]?.toolsSent, false);
    assertPrivate(events[1]!);
  });

  it("does not cache a missing key as a completed model settle", async () => {
    resetCosFeedbackCache();
    let calls = 0;
    const events = await capture(async () => {
      noteCosFeedbackUnavailable({
        docket: docket(),
        sourceWatermark: "watermark-secret",
        nowIso: NOW,
      });
      await refreshCosFeedback({
        docket: docket(),
        sourceWatermark: "watermark-secret",
        nowIso: NOW,
        route: ROUTE,
        model: async () => {
          calls += 1;
          return acceptedBody();
        },
      });
    });
    assert.equal(calls, 1);
    assert.equal(events[0]?.outcome, "model_unavailable");
    assert.equal(events[0]?.validationResult, "missing_key");
    assert.equal(events[0]?.modelInvoked, false);
    assert.equal(events[1]?.outcome, "model_accepted");
  });

  it("keeps toolsSent false and drops fields outside the allowlist", () => {
    const leaked = {
      event: COS_FEEDBACK_SETTLE_EVENT,
      feedbackContract: "cos-feedback-v1",
      provider: "openai",
      model: "gpt-5.6-sol",
      outcome: "model_accepted",
      cache: "miss",
      modelInvoked: true,
      toolsSent: true,
      latencyMs: 4,
      inputBytes: 12,
      outputBytes: 8,
      validationResult: "accepted",
      sourceWatermarkDigest: "abcdef012345",
      portfolioDigest: "012345abcdef",
      founderGuidance: SECRET_NAME,
    } as CosFeedbackSettleEvent;
    const original = console.info;
    let line = "";
    console.info = (message?: unknown) => {
      line = String(message);
    };
    try {
      emitCosFeedbackSettle(leaked);
    } finally {
      console.info = original;
    }
    const event = JSON.parse(line) as CosFeedbackSettleEvent;
    assert.equal(event.toolsSent, false);
    assert.equal(Object.hasOwn(event, "founderGuidance"), false);
    assert.doesNotMatch(line, /Harborlane/);
  });
});
