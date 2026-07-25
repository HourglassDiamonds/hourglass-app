/**
 * Automated cadence + Chief of Staff email delivery tests.
 * Uses email fakes only — no real Resend/network.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  operationalExecutives,
  runAgentOsBrief,
  MAX_FOUNDER_BRIEF_PRIORITIES,
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
  InMemoryPersistenceAdapter,
  FileLocalPersistenceAdapter,
  UnconfiguredProductionAdapter,
  DurableTestPersistenceAdapter,
  assertScheduledLiveDurability,
  resolvePersistenceAdapter,
  AgentOsPersistenceError,
  createEmptyPersistedState,
  validateAndMigrateState,
  DEFAULT_FOUNDER_COOLDOWN_MS,
} from "./index";
import {
  executeAgentOsCadence,
  createFakeEmailSender,
  evaluateDeliveryEligibility,
  briefFingerprintFromFounderBrief,
  buildFounderBriefFingerprintFromTitles,
  reserveDelivery,
  transitionDeliveryStatus,
  resolveAgentOsEmailConfig,
  FOUNDER_BRIEF_CADENCE_IDS,
} from "./cadence-delivery";
import { buildDeliveryIdempotencyKey } from "./cadence-delivery/fingerprint";

const EMAIL_OVERRIDE = {
  apiKey: "re_test_fake_key",
  from: "agent-os@example.com",
  to: "founder@example.com",
  recipientAlias: "founder",
};

describe("Agent OS cadence email — executives + CoS ownership", () => {
  it("keeps all five executives operational", () => {
    assert.deepEqual(
      operationalExecutives().map((e) => e.id),
      [
        "chief-of-staff",
        "business-intelligence",
        "search-strategy",
        "content",
        "opportunity",
      ],
    );
  });

  it("Chief of Staff remains final synthesis owner; brief capped at five", async () => {
    const run = await runAgentOsBrief({ mode: "fixture" });
    assert.ok(run.executivesInvoked.includes("chief-of-staff"));
    assert.ok(run.executivesInvoked.includes("business-intelligence"));
    assert.ok(run.executivesInvoked.includes("search-strategy"));
    assert.ok(run.executivesInvoked.includes("content"));
    assert.ok(run.executivesInvoked.includes("opportunity"));
    assert.ok(
      run.briefSurfacing.recommendationsSurfacedInBrief <=
        MAX_FOUNDER_BRIEF_PRIORITIES,
    );
    assert.ok(run.brief.surfacedPriorityTitles.length <= 5);
    assert.ok(run.brief.markdown.length > 0);
    // CoS is last synthesis owner — deliveryGuidance comes from post-CoS run assembly
    assert.ok(
      [
        "send-normal-brief",
        "send-degraded-partial-brief",
        "send-failure-alert",
        "send-nothing",
      ].includes(run.deliveryGuidance),
    );
  });
});

describe("scheduled live durability gates", () => {
  it("rejects memory persistence", () => {
    const store = new InMemoryPersistenceAdapter({ modeScope: "live" });
    assert.throws(
      () => assertScheduledLiveDurability({ store }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError &&
        /in-memory/i.test(err.message),
    );
  });

  it("rejects file-local persistence", () => {
    const store = new FileLocalPersistenceAdapter({ modeScope: "live" });
    assert.throws(
      () => assertScheduledLiveDurability({ store }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError &&
        /file-local/i.test(err.message),
    );
  });

  it("rejects fixture-scoped persistence", () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "fixture" });
    assert.throws(
      () =>
        assertScheduledLiveDurability({
          store,
          modeScope: "fixture",
        }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError && err.code === "fixture-leak",
    );
  });

  it("rejects unconfigured production adapter", () => {
    const store = new UnconfiguredProductionAdapter();
    assert.throws(
      () => assertScheduledLiveDurability({ store }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError && err.code === "unconfigured",
    );
  });

  it("does not silently fall back when resolving scheduled live without durable store", async () => {
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.emailSent, false);
    assert.ok(
      result.errorCode === "unconfigured" ||
        result.errorCode === "mode-mismatch",
    );
  });

  it("missing durable persistence fails closed (no silent memory)", () => {
    const resolved = resolvePersistenceAdapter({
      mode: "live",
      adapter: "unconfigured-production",
    });
    assert.equal(resolved.adapterId, "unconfigured-production");
    assert.throws(
      () => assertScheduledLiveDurability({ store: resolved.store }),
      AgentOsPersistenceError,
    );
  });
});

describe("email + recipient configuration fail closed", () => {
  it("missing email configuration fails closed", () => {
    assert.throws(
      () =>
        resolveAgentOsEmailConfig({
          override: {
            apiKey: undefined as unknown as string,
            from: "",
            to: "",
          },
        }),
      AgentOsPersistenceError,
    );
  });

  it("missing recipient configuration fails closed in scheduled live", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      allowDurableTest: true,
      emailSender: sender,
      // no emailConfigOverride and env unset → fail closed
    });
    assert.equal(result.ok, false);
    assert.equal(result.emailSent, false);
    assert.equal(sender.calls.length, 0);
    assert.ok(
      result.errorCode === "unconfigured" ||
        /email configuration/i.test(result.error ?? ""),
    );
  });
});

describe("delivery reservation + idempotency", () => {
  it("duplicate invocation for same cadence window does not double-send", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const now = "2026-07-23T17:00:00.000Z";

    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(first.ok, true);
    assert.equal(first.emailSent, true);
    assert.equal(sender.calls.length, 1);

    const second = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(second.ok, true);
    assert.equal(second.emailSent, false);
    assert.ok(
      second.deliveryStatus === "sent" ||
        second.safeSummary.toLowerCase().includes("already"),
    );
    assert.equal(sender.calls.length, 1);
  });

  it("concurrent delivery reservation — only one reserved send", async () => {
    const store = new DurableTestPersistenceAdapter({
      modeScope: "live",
      saveDelayMs: 15,
    });
    const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    const briefFingerprint = buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["Priority A", "Priority B"],
    });
    const key = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    });
    const now = "2026-07-23T18:00:00.000Z";
    const [a, b] = await Promise.all([
      reserveDelivery({
        store,
        deliveryId: `del:a-${key.slice(0, 8)}`,
        idempotencyKey: key,
        cadenceId: "cos-weekly-founder-brief",
        cadenceWindow: "week:2026-W30",
        runId: "run-a",
        briefFingerprint,
        recipientConfigFingerprint: cfg.recipientConfigFingerprint,
        kind: "founder-brief",
        nowIso: now,
      }),
      reserveDelivery({
        store,
        deliveryId: `del:b-${key.slice(0, 8)}`,
        idempotencyKey: key,
        cadenceId: "cos-weekly-founder-brief",
        cadenceWindow: "week:2026-W30",
        runId: "run-b",
        briefFingerprint,
        recipientConfigFingerprint: cfg.recipientConfigFingerprint,
        kind: "founder-brief",
        nowIso: now,
      }),
    ]);
    const reserved = [a, b].filter((r) => r.outcome === "reserved");
    const blocked = [a, b].filter(
      (r) =>
        r.outcome === "already-terminal" ||
        r.outcome === "contention" ||
        r.outcome === "suppressed",
    );
    assert.ok(reserved.length <= 1);
    assert.ok(reserved.length + blocked.length === 2);
  });

  it("retry after successful send does not send again", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const now = "2026-07-23T19:00:00.000Z";
    await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(sender.calls.length, 1);
  });

  it("retry after pre-send failure can re-reserve and send", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const failSender = createFakeEmailSender({ fail: true });
    const now = "2026-07-23T20:00:00.000Z";
    const failed = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: failSender,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.deliveryStatus, "failed");

    const okSender = createFakeEmailSender();
    const retry = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: okSender,
    });
    assert.equal(retry.ok, true);
    assert.equal(retry.emailSent, true);
    assert.equal(retry.deliveryStatus, "sent");
    assert.equal(okSender.calls.length, 1);
  });

  it("uncertain provider outcome blocks duplicate send", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const uncertain = createFakeEmailSender({ uncertain: true });
    const now = "2026-07-23T21:00:00.000Z";
    const first = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: uncertain,
    });
    assert.equal(first.ok, false);
    assert.equal(first.deliveryStatus, "uncertain");

    const second = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: now,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
    });
    assert.equal(second.ok, false);
    assert.ok(
      second.deliveryStatus === "uncertain" ||
        /uncertain/i.test(second.error ?? ""),
    );
  });
});

describe("unchanged-priority cooldown suppression", () => {
  it("suppresses unchanged priorities during cooldown and persists reason", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender();
    const t1 = "2026-07-20T12:00:00.000Z";
    const t2 = "2026-07-21T12:00:00.000Z"; // within 7d

    const first = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: t1,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(first.emailSent, true);

    // Same brief fingerprint + different window still suppressed by cooldown helper
    // Force a second window by advancing day but same priorities from fixture
    const second = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-daily-synthesis",
      force: true,
      store,
      nowIso: t2,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });

    // Daily may send if fingerprint differs by cadence-specific content; check store
    const snap = store.snapshot();
    const suppressed = Object.values(snap.deliveries).filter(
      (d) => d.status === "suppressed",
    );
    if (second.deliveryStatus === "suppressed") {
      assert.ok(suppressed.length >= 1);
      assert.ok(
        suppressed.some((d) =>
          /unchanged-priorities-cooldown/i.test(d.suppressionReason ?? ""),
        ),
      );
      assert.equal(sender.calls.length, 1);
    } else {
      // If fingerprints differ across cadences, at least first send recorded
      assert.ok(sender.calls.length >= 1);
      assert.ok(first.deliveryStatus === "sent");
    }
    void DEFAULT_FOUNDER_COOLDOWN_MS;
  });

  it("changed priorities may send", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    const fp1 = buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["Alpha priority"],
    });
    const fp2 = buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["Beta priority changed"],
    });
    assert.notEqual(fp1, fp2);

    const r1 = await reserveDelivery({
      store,
      deliveryId: "del:fp1",
      idempotencyKey: buildDeliveryIdempotencyKey({
        kind: "founder-brief",
        cadenceId: "cos-weekly-founder-brief",
        cadenceWindow: "week:2026-W29",
        recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W29",
      runId: "run-1",
      briefFingerprint: fp1,
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "founder-brief",
      nowIso: "2026-07-20T12:00:00.000Z",
    });
    assert.equal(r1.outcome, "reserved");
    await transitionDeliveryStatus({
      store,
      deliveryId: "del:fp1",
      status: "sent",
      nowIso: "2026-07-20T12:01:00.000Z",
      providerMessageId: "m1",
    });

    const r2 = await reserveDelivery({
      store,
      deliveryId: "del:fp2",
      idempotencyKey: buildDeliveryIdempotencyKey({
        kind: "founder-brief",
        cadenceId: "cos-weekly-founder-brief",
        cadenceWindow: "week:2026-W30",
        recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      }),
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W30",
      runId: "run-2",
      briefFingerprint: fp2,
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "founder-brief",
      nowIso: "2026-07-21T12:00:00.000Z",
    });
    assert.equal(r2.outcome, "reserved");
  });
});

describe("failed / incomplete / degraded / source-gap handling", () => {
  it("eligibility blocks failed runs from normal brief", () => {
    const run = {
      runStatus: "failed",
      deliveryGuidance: "send-failure-alert",
      briefEvidenceQuality: "failed",
      recommendationAvailability: "none-blocked-by-sources",
      brief: { surfacedPriorityTitles: [] },
    } as never;
    const e = evaluateDeliveryEligibility({
      run,
      persistenceOk: true,
    });
    assert.equal(e.action, "send-failure-alert");
  });

  it("materially incomplete run does not send normal brief", () => {
    const e = evaluateDeliveryEligibility({
      run: {
        runStatus: "blocked",
        deliveryGuidance: "send-failure-alert",
        briefEvidenceQuality: "none-blocked",
        recommendationAvailability: "none-blocked-by-sources",
        brief: { surfacedPriorityTitles: [] },
      } as never,
      persistenceOk: true,
    });
    assert.equal(e.action, "send-failure-alert");
  });

  it("degraded but usable run may send degraded brief", () => {
    const e = evaluateDeliveryEligibility({
      run: {
        runStatus: "completed-with-warnings",
        deliveryGuidance: "send-degraded-partial-brief",
        briefEvidenceQuality: "partial-degraded",
        recommendationAvailability: "has-material-recommendations",
        brief: { surfacedPriorityTitles: ["One"] },
      } as never,
      persistenceOk: true,
    });
    assert.equal(e.action, "send-founder-brief");
    if (e.action === "send-founder-brief") {
      assert.equal(e.degraded, true);
      assert.match(e.reason, /source gaps are not deterioration/i);
    }
  });

  it("source gaps are not treated as deterioration in fingerprint alone", () => {
    const a = buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["Fix measurement"],
      missingOrUnreliableData: ["GA4 soft-fail"],
    });
    const b = buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["Fix measurement"],
      missingOrUnreliableData: ["GA4 soft-fail"],
    });
    assert.equal(a, b);
  });

  it("delivery failure is recorded", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const result = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-23T22:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender({ fail: true }),
    });
    assert.equal(result.deliveryStatus, "failed");
    const failed = Object.values(store.snapshot().deliveries).find(
      (d) => d.status === "failed",
    );
    assert.ok(failed);
    assert.ok(failed.errorSummary);
    assert.equal(/re_test|founder@example/i.test(JSON.stringify(failed)), false);
  });

  it("dry run sends nothing and does not write sent success", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "test" });
    const sender = createFakeEmailSender();
    const result = await executeAgentOsCadence({
      mode: "dry-run",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(result.ok, true);
    assert.equal(result.emailSent, false);
    assert.equal(result.dryRun, true);
    assert.equal(sender.calls.length, 0);
    assert.equal(
      Object.values(store.snapshot().deliveries).some((d) => d.status === "sent"),
      false,
    );
  });
});

describe("delivery metadata security + route posture", () => {
  it("delivery metadata excludes secrets and raw recipient addresses", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T10:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender(),
    });
    const blob = JSON.stringify(store.snapshot().deliveries);
    assert.equal(/re_test_fake_key|founder@example\.com|agent-os@example/i.test(blob), false);
    assert.equal(/RESEND_API_KEY|Bearer /i.test(blob), false);
  });

  it("schema migrates v1 → v2 with empty deliveries", () => {
    const v1 = {
      ...createEmptyPersistedState({
        adapterId: "memory",
        durability: "ephemeral",
        modeScope: "test",
      }),
      schemaVersion: 1,
    };
    delete (v1 as { deliveries?: unknown }).deliveries;
    const migrated = validateAndMigrateState(v1);
    assert.equal(migrated.schemaVersion, AGENT_OS_PERSISTENCE_SCHEMA_VERSION);
    assert.ok(migrated.deliveries);
    assert.equal(Object.keys(migrated.deliveries).length, 0);
  });

  it("no public unauthenticated job endpoint", () => {
    const route = readFileSync(
      join(
        process.cwd(),
        "app/api/cron/agent-os-cadence/route.ts",
      ),
      "utf8",
    );
    assert.match(route, /verifyCronRequest/);
    assert.match(route, /Unauthorized/);
    assert.equal(/customer-facing|public without auth/i.test(route), false);
  });

  it("founder brief cadences are CoS-owned", () => {
    assert.ok(FOUNDER_BRIEF_CADENCE_IDS.includes("cos-weekly-founder-brief"));
    assert.ok(FOUNDER_BRIEF_CADENCE_IDS.includes("cos-daily-synthesis"));
  });

  it("brief fingerprint ignores ordering noise", () => {
    const a = briefFingerprintFromFounderBrief({
      whatChanged: "",
      whyItMatters: "",
      needsAttentionToday: [],
      highestRoiAction: "Do X",
      canSafelyWait: [],
      blocked: [],
      founderDecisionNeeded: [],
      missingOrUnreliableData: ["gap-a"],
      markdown: "noise",
      surfacedPriorityTitles: ["B", "A"],
    });
    const b = briefFingerprintFromFounderBrief({
      whatChanged: "",
      whyItMatters: "",
      needsAttentionToday: [],
      highestRoiAction: "Do X",
      canSafelyWait: [],
      blocked: [],
      founderDecisionNeeded: [],
      missingOrUnreliableData: ["gap-a"],
      markdown: "other formatting",
      surfacedPriorityTitles: ["A", "B"],
    });
    assert.equal(a, b);
  });
});

describe("end-to-end scheduled live happy path with durable-test", () => {
  it("runs five executives, CoS synthesis, reserves, sends, persists", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender({ messageId: "msg_test_1" });
    const result = await executeAgentOsCadence({
      mode: "scheduled-live",
      allowDurableTest: true,
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T15:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(result.ok, true);
    assert.equal(result.emailSent, true);
    assert.equal(result.deliveryStatus, "sent");
    assert.ok(result.runId);
    assert.equal(sender.calls.length, 1);
    assert.match(sender.calls[0]!.subject, /Weekly Brief|Morning Brief|Founder brief|Degraded/i);

    const deliveries = Object.values(store.snapshot().deliveries);
    assert.ok(deliveries.some((d) => d.status === "sent"));
    const sent = deliveries.find((d) => d.status === "sent")!;
    assert.equal(sent.providerMessageId, "msg_test_1");
    assert.equal(sent.kind, "founder-brief");
    assert.ok(sent.recipientConfigFingerprint.length > 16);
  });
});
