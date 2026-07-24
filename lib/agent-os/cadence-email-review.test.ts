/**
 * Review-amendment coverage: production durability, atomic claims, cron auth,
 * uncertain recovery, alert separation, fingerprints, multi-cadence, email config.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DurableTestPersistenceAdapter,
  createSharedDurableTestBackend,
  assertScheduledLiveDurability,
  AgentOsPersistenceError,
  resolvePersistenceAdapter,
  DELIVERY_CLAIM_LEASE_MS,
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
} from "./index";
import {
  executeAgentOsCadence,
  createFakeEmailSender,
  reserveDelivery,
  transitionDeliveryStatus,
  resolveUncertainDelivery,
  resolveAgentOsEmailConfig,
  buildFounderBriefFingerprint,
  buildFounderBriefFingerprintFromTitles,
  buildDeliveryIdempotencyKey,
  listDueFounderCadencesInOrder,
  renderFailureAlertEmail,
} from "./cadence-delivery";
import { GET as cronGet } from "../../app/api/cron/agent-os-cadence/route";

const EMAIL_OVERRIDE = {
  apiKey: "re_test_fake_key",
  from: "agent-os@example.com",
  to: "founder@example.com",
  recipientAlias: "founder",
};

describe("production durable adapter selection", () => {
  it("scheduled live refuses durable-test without allowDurableTest", () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    assert.throws(
      () => assertScheduledLiveDurability({ store }),
      AgentOsPersistenceError,
    );
  });

  it("schema SQL documents supabase agent_os tables", () => {
    const sql = readFileSync(
      join(process.cwd(), "lib/supabase/agent-os-schema.sql"),
      "utf8",
    );
    assert.match(sql, /agent_os_persisted_state/);
    assert.match(sql, /agent_os_delivery_claims/);
    assert.match(sql, /idempotency_key text primary key/);
    assert.match(sql, /Never stores secrets/i);
  });

  it("live resolve prefers supabase adapter id when explicitly requested without env → unconfigured", () => {
    assert.throws(
      () =>
        resolvePersistenceAdapter({
          mode: "live",
          adapter: "supabase",
        }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError && err.code === "unconfigured",
    );
  });
});

describe("atomic delivery reservation across independent clients", () => {
  it("two independent store instances: exactly one claim owner", async () => {
    const shared = createSharedDurableTestBackend({ modeScope: "live" });
    const a = new DurableTestPersistenceAdapter({
      modeScope: "live",
      shared,
      saveDelayMs: 5,
    });
    const b = new DurableTestPersistenceAdapter({
      modeScope: "live",
      shared,
      saveDelayMs: 5,
    });
    const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    const fp = buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["Same"],
    });
    const key = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    });
    const now = "2026-07-23T18:00:00.000Z";
    const base = {
      idempotencyKey: key,
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      briefFingerprint: fp,
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "founder-brief" as const,
      nowIso: now,
    };
    const [r1, r2] = await Promise.all([
      reserveDelivery({
        ...base,
        store: a,
        deliveryId: "del:a",
        runId: "run-a",
        claimOwner: a.instanceId,
      }),
      reserveDelivery({
        ...base,
        store: b,
        deliveryId: "del:b",
        runId: "run-b",
        claimOwner: b.instanceId,
      }),
    ]);
    const reserved = [r1, r2].filter((r) => r.outcome === "reserved");
    const other = [r1, r2].filter((r) => r.outcome !== "reserved");
    assert.equal(reserved.length, 1);
    assert.equal(other.length, 1);
    assert.ok(
      other[0]!.outcome === "already-terminal" ||
        other[0]!.outcome === "contention",
    );
    // Winner owns the claim; loser sees existing claim or contention
    if (other[0]!.outcome === "already-terminal") {
      assert.equal(
        other[0]!.record.idempotencyKey,
        reserved[0]!.record.idempotencyKey,
      );
    }
  });
});

describe("cron authentication hardening", () => {
  it("rejects missing auth before job work", async () => {
    const res = await cronGet(
      new Request("http://localhost/api/cron/agent-os-cadence"),
    );
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("Cache-Control")?.includes("no-store"), true);
    const body = await res.json();
    assert.equal(body.error, "Unauthorized");
    assert.equal("safeSummary" in body, false);
  });

  it("rejects valid bearer when secret query param is present", async () => {
    process.env.CRON_SECRET = "test-cron-secret-value-32chars!!";
    const res = await cronGet(
      new Request(
        "http://localhost/api/cron/agent-os-cadence?secret=test-cron-secret-value-32chars!!",
        {
          headers: {
            authorization: "Bearer test-cron-secret-value-32chars!!",
          },
        },
      ),
    );
    assert.equal(res.status, 401);
    delete process.env.CRON_SECRET;
  });

  it("route source requires verifyCronRequest before execute import path", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/cron/agent-os-cadence/route.ts"),
      "utf8",
    );
    assert.match(src, /verifyCronRequest/);
    assert.match(src, /Cache-Control.*no-store/);
    assert.match(src, /runtime = "nodejs"/);
    const authIdx = src.indexOf("verifyCronRequest");
    const execIdx = src.indexOf("executeAgentOsCadence");
    assert.ok(authIdx > 0 && execIdx > authIdx);
  });
});

describe("uncertain delivery recovery", () => {
  it("operator can resolve uncertain to failed then retry send", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const now = "2026-07-24T12:00:00.000Z";
    const uncertain = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender({ uncertain: true }),
    });
    assert.equal(uncertain.deliveryStatus, "uncertain");
    const id = Object.values(store.snapshot().deliveries).find(
      (d) => d.status === "uncertain",
    )!.deliveryId;

    const resolved = await resolveUncertainDelivery({
      store,
      deliveryId: id,
      resolveAs: "failed",
      nowIso: "2026-07-24T12:05:00.000Z",
      note: "operator confirmed not sent",
    });
    assert.equal(resolved.status, "failed");
    assert.ok(
      resolved.resolutionAudit.some((a) => a.action === "resolve-failed"),
    );

    const retry = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
    });
    assert.equal(retry.emailSent, true);
    assert.equal(retry.deliveryStatus, "sent");
  });

  it("inspect output never includes raw recipient", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T13:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender({ uncertain: true }),
    });
    const blob = JSON.stringify(store.snapshot().deliveries);
    assert.equal(/founder@example\.com|re_test/i.test(blob), false);
  });
});

describe("founder-brief vs failure-alert separation", () => {
  it("failure alert does not consume founder-brief window slot", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    const window = "week:2026-W31";
    const alertKey = buildDeliveryIdempotencyKey({
      kind: "failure-alert",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: window,
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    });
    const briefKey = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: window,
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    });
    assert.notEqual(alertKey, briefKey);

    const alert = await reserveDelivery({
      store,
      deliveryId: "del:alert",
      idempotencyKey: alertKey,
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: window,
      runId: "run-alert",
      briefFingerprint: "alert-fp",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "failure-alert",
      nowIso: "2026-07-24T14:00:00.000Z",
    });
    assert.equal(alert.outcome, "reserved");
    await transitionDeliveryStatus({
      store,
      deliveryId: "del:alert",
      status: "sent",
      nowIso: "2026-07-24T14:01:00.000Z",
    });

    const brief = await reserveDelivery({
      store,
      deliveryId: "del:brief",
      idempotencyKey: briefKey,
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: window,
      runId: "run-brief",
      briefFingerprint: "brief-fp",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "founder-brief",
      nowIso: "2026-07-24T14:02:00.000Z",
    });
    assert.equal(brief.outcome, "reserved");
  });

  it("repeated identical failure alerts suppress (no storm)", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    const key = buildDeliveryIdempotencyKey({
      kind: "failure-alert",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W32",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    });
    const r1 = await reserveDelivery({
      store,
      deliveryId: "del:fa1",
      idempotencyKey: key,
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W32",
      runId: "r1",
      briefFingerprint: "same-alert-fp",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "failure-alert",
      nowIso: "2026-07-24T15:00:00.000Z",
      cooldownMs: 6 * 60 * 60 * 1000,
    });
    assert.equal(r1.outcome, "reserved");
    await transitionDeliveryStatus({
      store,
      deliveryId: r1.record.deliveryId,
      status: "sent",
      nowIso: "2026-07-24T15:01:00.000Z",
    });
    const r2 = await reserveDelivery({
      store,
      deliveryId: "del:fa2",
      idempotencyKey: buildDeliveryIdempotencyKey({
        kind: "failure-alert",
        cadenceId: "cos-weekly-founder-brief",
        cadenceWindow: "week:2026-W33",
        recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W33",
      runId: "r2",
      briefFingerprint: "same-alert-fp",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "failure-alert",
      nowIso: "2026-07-24T15:30:00.000Z",
      cooldownMs: 6 * 60 * 60 * 1000,
    });
    assert.equal(r2.outcome, "suppressed");
  });

  it("failure alert email contains no secrets or stack traces", () => {
    const rendered = renderFailureAlertEmail({
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      runId: "run-x",
      runStatus: "failed",
      reason:
        "Bearer sk_live_abc failed at Error: boom\n  at Object.<anonymous> (file.ts:1:1)",
    });
    assert.equal(/sk_live_abc/i.test(rendered.html), false);
    assert.equal(/Bearer sk_live/i.test(rendered.html), false);
    assert.equal(/at Object\.<anonymous>/i.test(rendered.html), false);
    assert.match(rendered.text, /NOT a founder brief/i);
  });
});

describe("material-change fingerprinting", () => {
  it("formatting / order noise suppresses; action/evidence/severity changes deliver", () => {
    const a = buildFounderBriefFingerprint({
      priorities: [
        {
          recommendationId: "rec:1",
          actionToken: "fix:tracking",
          urgency: "high",
          impactBucket: "high",
          evidenceTokens: ["kw:gap", "n:12"],
          sourceGapTokens: ["gap:ga4"],
        },
        {
          recommendationId: "rec:2",
          actionToken: "publish:guide",
          urgency: "medium",
          impactBucket: "med",
          evidenceTokens: ["kw:demand"],
          sourceGapTokens: [],
        },
      ],
      sourceGapStatusTokens: ["gap:ga4"],
    });
    const reordered = buildFounderBriefFingerprint({
      priorities: [
        {
          recommendationId: "rec:2",
          actionToken: "publish:guide",
          urgency: "medium",
          impactBucket: "med",
          evidenceTokens: ["kw:demand"],
          sourceGapTokens: [],
        },
        {
          recommendationId: "rec:1",
          actionToken: "fix:tracking",
          urgency: "high",
          impactBucket: "high",
          evidenceTokens: ["kw:gap", "n:12"],
          sourceGapTokens: ["gap:ga4"],
        },
      ],
      sourceGapStatusTokens: ["gap:ga4"],
    });
    assert.equal(a, reordered);

    const changedAction = buildFounderBriefFingerprint({
      priorities: [
        {
          recommendationId: "rec:1",
          actionToken: "rewrite:funnel",
          urgency: "high",
          impactBucket: "high",
          evidenceTokens: ["kw:gap", "n:12"],
          sourceGapTokens: ["gap:ga4"],
        },
      ],
    });
    assert.notEqual(a, changedAction);

    const changedSeverity = buildFounderBriefFingerprint({
      priorities: [
        {
          recommendationId: "rec:1",
          actionToken: "fix:tracking",
          urgency: "critical",
          impactBucket: "high",
          evidenceTokens: ["kw:gap", "n:12"],
          sourceGapTokens: ["gap:ga4"],
        },
      ],
      sourceGapStatusTokens: ["gap:ga4"],
    });
    assert.notEqual(
      buildFounderBriefFingerprint({
        priorities: [
          {
            recommendationId: "rec:1",
            actionToken: "fix:tracking",
            urgency: "high",
            impactBucket: "high",
            evidenceTokens: ["kw:gap", "n:12"],
            sourceGapTokens: ["gap:ga4"],
          },
        ],
        sourceGapStatusTokens: ["gap:ga4"],
      }),
      changedSeverity,
    );

    const restored = buildFounderBriefFingerprint({
      priorities: [
        {
          recommendationId: "rec:1",
          actionToken: "fix:tracking",
          urgency: "high",
          impactBucket: "high",
          evidenceTokens: ["kw:gap", "n:40"],
          sourceGapTokens: [],
        },
      ],
      sourceGapStatusTokens: [],
    });
    assert.notEqual(
      buildFounderBriefFingerprint({
        priorities: [
          {
            recommendationId: "rec:1",
            actionToken: "fix:tracking",
            urgency: "high",
            impactBucket: "high",
            evidenceTokens: ["kw:gap", "n:12"],
            sourceGapTokens: ["gap:ga4"],
          },
        ],
        sourceGapStatusTokens: ["gap:ga4"],
      }),
      restored,
    );
  });
});

describe("simultaneous due cadences", () => {
  it("lists weekly before daily deterministically", () => {
    assert.deepEqual(
      listDueFounderCadencesInOrder([
        "cos-daily-synthesis",
        "cos-weekly-founder-brief",
      ]),
      ["cos-weekly-founder-brief", "cos-daily-synthesis"],
    );
  });

  it("processes both due cadences without marking the other complete incorrectly", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    // Force both by calling each explicitly; shared store timestamps should remain independent
    const weekly = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-20T12:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
    });
    const daily = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: "2026-07-20T12:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
    });
    assert.equal(weekly.cadenceId, "cos-weekly-founder-brief");
    assert.equal(daily.cadenceId, "cos-daily-synthesis");
    const state = store.snapshot();
    assert.ok(state.cadences["cos-weekly-founder-brief"]?.lastAttemptedAt);
    assert.ok(state.cadences["cos-daily-synthesis"]?.lastAttemptedAt);
    // Separate delivery kinds/windows → independent records
    const kinds = new Set(
      Object.values(state.deliveries).map((d) => d.cadenceId),
    );
    assert.ok(kinds.has("cos-weekly-founder-brief"));
    assert.ok(kinds.has("cos-daily-synthesis"));
  });
});

describe("email configuration resolution", () => {
  it("complete override works; partial override fails; missing fails with key names only", () => {
    const ok = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    assert.equal(ok.configSource, "override");
    assert.equal(ok.from, EMAIL_OVERRIDE.from);

    assert.throws(
      () =>
        resolveAgentOsEmailConfig({
          override: { apiKey: "x", from: "a@example.com" },
        }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError &&
        /override\.to/.test(err.message) &&
        !/@example\.com/.test(err.message),
    );

    assert.throws(
      () =>
        resolveAgentOsEmailConfig({
          override: { apiKey: "", from: "", to: "" },
        }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError &&
        /RESEND_API_KEY/.test(err.message),
    );
  });

  it("partial Agent OS pair refuses mixing", () => {
    const prevFrom = process.env.AGENT_OS_EMAIL_FROM;
    const prevTo = process.env.AGENT_OS_EMAIL_TO;
    const prevIntelFrom = process.env.INTELLIGENCE_EMAIL_FROM;
    const prevIntelTo = process.env.INTELLIGENCE_EMAIL_TO;
    const prevKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_test";
      process.env.AGENT_OS_EMAIL_FROM = "only-from@example.com";
      delete process.env.AGENT_OS_EMAIL_TO;
      process.env.INTELLIGENCE_EMAIL_FROM = "intel-from@example.com";
      process.env.INTELLIGENCE_EMAIL_TO = "intel-to@example.com";
      assert.throws(
        () => resolveAgentOsEmailConfig(),
        (err: unknown) =>
          err instanceof AgentOsPersistenceError &&
          /AGENT_OS_EMAIL_TO/.test(err.message) &&
          /no mixing/i.test(err.message),
      );
    } finally {
      process.env.AGENT_OS_EMAIL_FROM = prevFrom;
      process.env.AGENT_OS_EMAIL_TO = prevTo;
      process.env.INTELLIGENCE_EMAIL_FROM = prevIntelFrom;
      process.env.INTELLIGENCE_EMAIL_TO = prevIntelTo;
      process.env.RESEND_API_KEY = prevKey;
    }
  });

  it("complete intelligence fallback works when Agent OS unset", () => {
    const prevFrom = process.env.AGENT_OS_EMAIL_FROM;
    const prevTo = process.env.AGENT_OS_EMAIL_TO;
    const prevIntelFrom = process.env.INTELLIGENCE_EMAIL_FROM;
    const prevIntelTo = process.env.INTELLIGENCE_EMAIL_TO;
    const prevKey = process.env.RESEND_API_KEY;
    try {
      delete process.env.AGENT_OS_EMAIL_FROM;
      delete process.env.AGENT_OS_EMAIL_TO;
      process.env.RESEND_API_KEY = "re_test";
      process.env.INTELLIGENCE_EMAIL_FROM = "intel-from@example.com";
      process.env.INTELLIGENCE_EMAIL_TO = "intel-to@example.com";
      const cfg = resolveAgentOsEmailConfig();
      assert.equal(cfg.configSource, "intelligence");
      assert.equal(cfg.from, "intel-from@example.com");
    } finally {
      process.env.AGENT_OS_EMAIL_FROM = prevFrom;
      process.env.AGENT_OS_EMAIL_TO = prevTo;
      process.env.INTELLIGENCE_EMAIL_FROM = prevIntelFrom;
      process.env.INTELLIGENCE_EMAIL_TO = prevIntelTo;
      process.env.RESEND_API_KEY = prevKey;
    }
  });
});

describe("lease constant documented", () => {
  it("exposes claim lease duration", () => {
    assert.equal(DELIVERY_CLAIM_LEASE_MS, 15 * 60 * 1000);
    assert.equal(AGENT_OS_PERSISTENCE_SCHEMA_VERSION, 2);
  });
});

describe("CLI --test email transport safety", () => {
  it("defaults --test to fake sender and requires --allow-real-email for Resend", () => {
    const src = readFileSync(
      join(process.cwd(), "scripts/agent-os-cadence.ts"),
      "utf8",
    );
    assert.match(src, /createFakeEmailSender/);
    assert.match(src, /--allow-real-email/);
    assert.match(
      src,
      /testMode && !allowRealEmail \? createFakeEmailSender\(\)/,
    );
    assert.match(
      src,
      /--allow-real-email is only valid with --test/,
    );
    assert.match(src, /fake in-process sender/);
    assert.match(src, /no Resend \/ no external email/);
    // Production path must remain explicit and must not inherit the fake default.
    assert.match(src, /--scheduled-live/);
    assert.doesNotMatch(
      src,
      /scheduledLive && !allowRealEmail \? createFakeEmailSender/,
    );
  });
});
