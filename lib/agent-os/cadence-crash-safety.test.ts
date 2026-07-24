/**
 * Crash-safety + production Supabase adapter verification (no live credentials).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DurableTestPersistenceAdapter,
  createSharedDurableTestBackend,
  SupabasePersistenceAdapter,
  createFakeAgentOsSupabaseDb,
  DELIVERY_CLAIM_LEASE_MS,
  AgentOsPersistenceError,
  AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
} from "./index";
import {
  reserveDelivery,
  transitionDeliveryStatus,
  resolveUncertainDelivery,
  createFakeEmailSender,
  buildDeliveryIdempotencyKey,
  buildFounderBriefFingerprintFromTitles,
  resolveAgentOsEmailConfig,
  executeAgentOsCadence,
} from "./cadence-delivery";
import {
  decideClaimConflict,
  isLeaseExpired,
} from "./persistence/adapters/claim-lease-policy";
import type { AgentOsDeliveryRecord } from "./persistence/types";

const EMAIL_OVERRIDE = {
  apiKey: "re_test_fake_key",
  from: "agent-os@example.com",
  to: "founder@example.com",
  recipientAlias: "founder",
};

function sampleRecord(
  overrides: Partial<AgentOsDeliveryRecord> = {},
): AgentOsDeliveryRecord {
  const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
  const key = buildDeliveryIdempotencyKey({
    kind: "founder-brief",
    cadenceId: "cos-weekly-founder-brief",
    cadenceWindow: "week:2026-W40",
    recipientConfigFingerprint: cfg.recipientConfigFingerprint,
  });
  return {
    schemaVersion: AGENT_OS_PERSISTENCE_SCHEMA_VERSION,
    deliveryId: "del:sample",
    idempotencyKey: key,
    cadenceId: "cos-weekly-founder-brief",
    cadenceWindow: "week:2026-W40",
    runId: "run-1",
    briefFingerprint: buildFounderBriefFingerprintFromTitles({
      surfacedPriorityTitles: ["A"],
    }),
    recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    kind: "founder-brief",
    status: "reserved",
    suppressionReason: null,
    providerMessageId: null,
    errorSummary: null,
    reservedAt: "2026-07-23T10:00:00.000Z",
    updatedAt: "2026-07-23T10:00:00.000Z",
    sentAt: null,
    leaseExpiresAt: "2026-07-23T10:15:00.000Z",
    claimOwner: "owner-a",
    resolutionAudit: [],
    ...overrides,
  };
}

describe("claim lease policy", () => {
  it("expired reserved is reclaimable; expired sending becomes uncertain", () => {
    const reserved = sampleRecord({
      status: "reserved",
      leaseExpiresAt: "2026-07-23T09:00:00.000Z",
    });
    const sending = sampleRecord({
      status: "sending",
      leaseExpiresAt: "2026-07-23T09:00:00.000Z",
    });
    const now = "2026-07-23T10:20:00.000Z";
    assert.equal(isLeaseExpired(reserved, now), true);
    assert.equal(decideClaimConflict(reserved, now).action, "reclaim-reserved");
    assert.equal(
      decideClaimConflict(sending, now).action,
      "mark-sending-uncertain",
    );
  });
});

describe("crash-after-send lease safety (durable-test)", () => {
  it("crash after reservation before send → expired reserved is reclaimable", async () => {
    const shared = createSharedDurableTestBackend({ modeScope: "live" });
    const a = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const b = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const rec = sampleRecord();
    const claimed = await a.atomicClaimDelivery!({
      record: rec,
      claimOwner: "owner-a",
      nowIso: "2026-07-23T10:00:00.000Z",
      leaseMs: 1000,
    });
    assert.equal(claimed.outcome, "claimed");

    const later = await b.atomicClaimDelivery!({
      record: { ...rec, deliveryId: "del:b", runId: "run-b" },
      claimOwner: "owner-b",
      nowIso: "2026-07-23T10:00:02.000Z",
      leaseMs: 1000,
    });
    assert.equal(later.outcome, "reclaimed");
    assert.equal(later.record.claimOwner, "owner-b");
    assert.equal(later.record.status, "reserved");
  });

  it("crash after transition to sending → expired claim becomes uncertain", async () => {
    const shared = createSharedDurableTestBackend({ modeScope: "live" });
    const a = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const b = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const rec = sampleRecord();
    await a.atomicClaimDelivery!({
      record: rec,
      claimOwner: "owner-a",
      nowIso: "2026-07-23T10:00:00.000Z",
      leaseMs: 1000,
    });
    await a.atomicUpdateDelivery!({
      ...rec,
      status: "sending",
      claimOwner: "owner-a",
      leaseExpiresAt: "2026-07-23T10:00:01.000Z",
      updatedAt: "2026-07-23T10:00:00.500Z",
    });

    const later = await b.atomicClaimDelivery!({
      record: { ...rec, deliveryId: "del:b" },
      claimOwner: "owner-b",
      nowIso: "2026-07-23T10:00:05.000Z",
      leaseMs: 1000,
    });
    assert.equal(later.outcome, "marked-uncertain");
    assert.equal(later.record.status, "uncertain");
    assert.ok(
      later.record.resolutionAudit.some(
        (e) => e.action === "expired-sending-to-uncertain",
      ),
    );
  });

  it("expired sending cannot cause an automatic resend", async () => {
    const shared = createSharedDurableTestBackend({ modeScope: "live" });
    const store = new DurableTestPersistenceAdapter({
      modeScope: "live",
      shared,
    });
    const cfg = resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE });
    const key = buildDeliveryIdempotencyKey({
      kind: "founder-brief",
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W41",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
    });
    const nowReserve = "2026-07-23T11:00:00.000Z";
    const r = await reserveDelivery({
      store,
      deliveryId: "del:send-crash",
      idempotencyKey: key,
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W41",
      runId: "run-1",
      briefFingerprint: "fp",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "founder-brief",
      nowIso: nowReserve,
      claimOwner: "owner-a",
    });
    assert.equal(r.outcome, "reserved");
    await transitionDeliveryStatus({
      store,
      deliveryId: r.record.deliveryId,
      status: "sending",
      nowIso: nowReserve,
      expectedStatus: "reserved",
      expectedClaimOwner: "owner-a",
    });
    // Force lease expiry in claim map
    const snap = store.snapshot();
    const d = snap.deliveries[r.record.deliveryId]!;
    d.leaseExpiresAt = "2026-07-23T10:59:00.000Z";
    d.status = "sending";
    shared.save({
      ...snap,
      updatedAt: nowReserve,
      deliveries: { ...snap.deliveries, [d.deliveryId]: d },
    });

    const again = await reserveDelivery({
      store,
      deliveryId: "del:send-crash-2",
      idempotencyKey: key,
      cadenceId: "cos-weekly-founder-brief",
      cadenceWindow: "week:2026-W41",
      runId: "run-2",
      briefFingerprint: "fp",
      recipientConfigFingerprint: cfg.recipientConfigFingerprint,
      kind: "founder-brief",
      nowIso: "2026-07-23T11:20:00.000Z",
      claimOwner: "owner-b",
    });
    assert.equal(again.outcome, "blocked-uncertain");
  });

  it("manual resolve uncertain as sent blocks retry", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const result = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T14:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender({ uncertain: true }),
    });
    assert.equal(result.deliveryStatus, "uncertain");
    const id = Object.values(store.snapshot().deliveries).find(
      (d) => d.status === "uncertain",
    )!.deliveryId;
    await resolveUncertainDelivery({
      store,
      deliveryId: id,
      resolveAs: "sent",
      nowIso: "2026-07-24T14:05:00.000Z",
    });
    const retrySender = createFakeEmailSender();
    const retry = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T14:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: retrySender,
    });
    assert.equal(retry.emailSent, false);
    assert.equal(retry.deliveryStatus, "sent");
    assert.equal(retrySender.calls.length, 0);
  });

  it("manual resolve uncertain as failed allows exactly one new claim", async () => {
    const shared = createSharedDurableTestBackend({ modeScope: "live" });
    const store = new DurableTestPersistenceAdapter({
      modeScope: "live",
      shared,
    });
    const uncertainRun = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T15:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender({ uncertain: true }),
    });
    assert.equal(uncertainRun.deliveryStatus, "uncertain");
    const id = Object.values(store.snapshot().deliveries).find(
      (d) => d.status === "uncertain",
    )!.deliveryId;
    await resolveUncertainDelivery({
      store,
      deliveryId: id,
      resolveAs: "failed",
      nowIso: "2026-07-24T15:05:00.000Z",
    });

    const a = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const b = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const senderA = createFakeEmailSender();
    const senderB = createFakeEmailSender();
    const [r1, r2] = await Promise.all([
      executeAgentOsCadence({
        mode: "test",
        cadenceId: "cos-weekly-founder-brief",
        force: true,
        store: a,
        nowIso: "2026-07-24T15:00:00.000Z",
        emailConfigOverride: EMAIL_OVERRIDE,
        emailSender: senderA,
      }),
      executeAgentOsCadence({
        mode: "test",
        cadenceId: "cos-weekly-founder-brief",
        force: true,
        store: b,
        nowIso: "2026-07-24T15:00:00.000Z",
        emailConfigOverride: EMAIL_OVERRIDE,
        emailSender: senderB,
      }),
    ]);
    const sent = [r1, r2].filter((r) => r.emailSent);
    assert.equal(sent.length, 1);
    assert.equal(senderA.calls.length + senderB.calls.length, 1);
  });

  it("concurrent uncertain resolution cannot both authorize retry", async () => {
    const shared = createSharedDurableTestBackend({ modeScope: "live" });
    const seed = new DurableTestPersistenceAdapter({
      modeScope: "live",
      shared,
    });
    await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store: seed,
      nowIso: "2026-07-24T16:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: createFakeEmailSender({ uncertain: true }),
    });
    const id = Object.values(seed.snapshot().deliveries).find(
      (d) => d.status === "uncertain",
    )!.deliveryId;

    const a = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const b = new DurableTestPersistenceAdapter({ modeScope: "live", shared });
    const results = await Promise.allSettled([
      resolveUncertainDelivery({
        store: a,
        deliveryId: id,
        resolveAs: "failed",
        nowIso: "2026-07-24T16:05:00.000Z",
      }),
      resolveUncertainDelivery({
        store: b,
        deliveryId: id,
        resolveAs: "failed",
        nowIso: "2026-07-24T16:05:00.000Z",
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
  });

  it("provider-level idempotency key is passed and honored by fake", async () => {
    const store = new DurableTestPersistenceAdapter({ modeScope: "live" });
    const sender = createFakeEmailSender({
      honorIdempotencyKey: true,
      messageId: "prov-1",
    });
    const first = await executeAgentOsCadence({
      mode: "test",
      cadenceId: "cos-weekly-founder-brief",
      force: true,
      store,
      nowIso: "2026-07-24T17:00:00.000Z",
      emailConfigOverride: EMAIL_OVERRIDE,
      emailSender: sender,
    });
    assert.equal(first.emailSent, true);
    assert.ok(sender.calls[0]?.idempotencyKey);
    assert.match(sender.calls[0]!.idempotencyKey!, /^[a-f0-9:]/i);
    assert.equal(/@|re_test/.test(sender.calls[0]!.idempotencyKey!), false);

    // Simulate second provider call with same key (defense in depth)
    const again = await sender({
      config: resolveAgentOsEmailConfig({ override: EMAIL_OVERRIDE }),
      rendered: {
        subject: "x",
        html: "<p>x</p>",
        text: "x",
      },
      idempotencyKey: sender.calls[0]!.idempotencyKey,
    });
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.providerMessageId, "prov-1");
    assert.equal(sender.calls.length, 2);
  });
});

describe("SupabasePersistenceAdapter direct atomic verification", () => {
  function twoAdapters() {
    const db = createFakeAgentOsSupabaseDb();
    const a = new SupabasePersistenceAdapter({
      modeScope: "live",
      scope: "test",
      db,
    });
    const b = new SupabasePersistenceAdapter({
      modeScope: "live",
      scope: "test",
      db,
    });
    return { db, a, b };
  }

  it("create-if-absent conflict → exactly one claim owner", async () => {
    const { a, b } = twoAdapters();
    const rec = sampleRecord({
      cadenceWindow: "week:2026-W50",
      idempotencyKey: "key:w50",
    });
    const [r1, r2] = await Promise.all([
      a.atomicClaimDelivery!({
        record: { ...rec, deliveryId: "del:a" },
        claimOwner: "a",
        nowIso: "2026-07-23T12:00:00.000Z",
      }),
      b.atomicClaimDelivery!({
        record: { ...rec, deliveryId: "del:b" },
        claimOwner: "b",
        nowIso: "2026-07-23T12:00:00.000Z",
      }),
    ]);
    const claimed = [r1, r2].filter((r) => r.outcome === "claimed");
    const exists = [r1, r2].filter((r) => r.outcome === "exists");
    assert.equal(claimed.length, 1);
    assert.equal(exists.length, 1);
    assert.equal(claimed[0]!.record.claimOwner, exists[0]!.record.claimOwner);
  });

  it("active lease cannot be stolen", async () => {
    const { a, b } = twoAdapters();
    const rec = sampleRecord({
      cadenceWindow: "week:2026-W51",
      idempotencyKey: "key:w51",
    });
    const first = await a.atomicClaimDelivery!({
      record: rec,
      claimOwner: "a",
      nowIso: "2026-07-23T12:00:00.000Z",
    });
    assert.equal(first.outcome, "claimed");
    const second = await b.atomicClaimDelivery!({
      record: { ...rec, deliveryId: "del:b" },
      claimOwner: "b",
      nowIso: "2026-07-23T12:01:00.000Z",
    });
    assert.equal(second.outcome, "exists");
    assert.equal(second.record.claimOwner, "a");
  });

  it("expired reserved can be reclaimed; expired sending is not", async () => {
    const { a, b } = twoAdapters();
    const rec = sampleRecord({
      cadenceWindow: "week:2026-W52",
      idempotencyKey: "key:w52",
    });
    await a.atomicClaimDelivery!({
      record: rec,
      claimOwner: "a",
      nowIso: "2026-07-23T12:00:00.000Z",
      leaseMs: 1000,
    });
    const reclaimed = await b.atomicClaimDelivery!({
      record: { ...rec, deliveryId: "del:b" },
      claimOwner: "b",
      nowIso: "2026-07-23T12:00:02.000Z",
      leaseMs: 1000,
    });
    assert.equal(reclaimed.outcome, "reclaimed");

    await b.atomicUpdateDelivery!({
      ...reclaimed.record,
      status: "sending",
      leaseExpiresAt: "2026-07-23T12:00:03.000Z",
      updatedAt: "2026-07-23T12:00:02.500Z",
    });
    const afterSendCrash = await a.atomicClaimDelivery!({
      record: { ...rec, deliveryId: "del:c" },
      claimOwner: "a",
      nowIso: "2026-07-23T12:00:10.000Z",
      leaseMs: 1000,
    });
    assert.equal(afterSendCrash.outcome, "marked-uncertain");
    assert.equal(afterSendCrash.record.status, "uncertain");
  });

  it("claim-owner mismatch prevents state transition", async () => {
    const { a } = twoAdapters();
    const rec = sampleRecord({
      cadenceWindow: "week:2026-W53",
      idempotencyKey: "key:w53",
    });
    const claimed = await a.atomicClaimDelivery!({
      record: rec,
      claimOwner: "owner-a",
      nowIso: "2026-07-23T12:00:00.000Z",
    });
    assert.equal(claimed.outcome, "claimed");
    await assert.rejects(
      () =>
        a.atomicUpdateDelivery!(
          { ...claimed.record, status: "sending", updatedAt: "2026-07-23T12:00:01.000Z" },
          { expectedClaimOwner: "owner-other", expectedStatus: "reserved" },
        ),
      AgentOsPersistenceError,
    );
  });

  it("stale expected version fails CAS and does not overwrite prior state", async () => {
    const { a, b } = twoAdapters();
    const empty = await a.load();
    empty.updatedAt = "2026-07-23T12:00:00.000Z";
    await a.save(empty);
    assert.equal(a.version, 1);

    const loadedA = await a.load();
    const loadedB = await b.load();
    assert.equal(b.version, 1);

    loadedA.updatedAt = "2026-07-23T12:01:00.000Z";
    await a.save(loadedA, { expectedVersion: 1 });
    assert.equal(a.version, 2);

    loadedB.updatedAt = "2026-07-23T12:02:00.000Z";
    await assert.rejects(
      () => b.save(loadedB, { expectedVersion: 1 }),
      (err: unknown) =>
        err instanceof AgentOsPersistenceError && err.code === "write-failed",
    );

    const final = await a.load();
    assert.equal(final.updatedAt, "2026-07-23T12:01:00.000Z");
  });

  it("uncertain resolution requires expected status; concurrent resolve is exclusive", async () => {
    const { a, b, db } = twoAdapters();
    const rec = sampleRecord({
      cadenceWindow: "week:2026-W54",
      idempotencyKey: "key:w54",
      status: "uncertain",
      claimOwner: "owner-a",
    });
    // Seed uncertain claim directly
    await db.insertClaim({
      idempotency_key: rec.idempotencyKey,
      delivery_id: rec.deliveryId,
      kind: rec.kind,
      cadence_id: rec.cadenceId,
      cadence_window: rec.cadenceWindow,
      status: "uncertain",
      brief_fingerprint: rec.briefFingerprint,
      recipient_config_fingerprint: rec.recipientConfigFingerprint,
      run_id: rec.runId,
      provider_message_id: null,
      error_summary: "prior uncertain",
      suppression_reason: null,
      reserved_at: rec.reservedAt,
      updated_at: rec.updatedAt,
      sent_at: null,
      lease_expires_at: rec.leaseExpiresAt!,
      claim_owner: "owner-a",
      resolution_audit: [],
    });
    await a.save(await a.load());

    const [r1, r2] = await Promise.allSettled([
      a.atomicUpdateDelivery!(
        {
          ...rec,
          status: "failed",
          updatedAt: "2026-07-23T13:00:00.000Z",
          resolutionAudit: [
            {
              at: "2026-07-23T13:00:00.000Z",
              action: "resolve-failed",
              fromStatus: "uncertain",
              toStatus: "failed",
              note: "op-a",
            },
          ],
        },
        { expectedStatus: "uncertain" },
      ),
      b.atomicUpdateDelivery!(
        {
          ...rec,
          status: "failed",
          updatedAt: "2026-07-23T13:00:00.000Z",
          resolutionAudit: [
            {
              at: "2026-07-23T13:00:00.000Z",
              action: "resolve-failed",
              fromStatus: "uncertain",
              toStatus: "failed",
              note: "op-b",
            },
          ],
        },
        { expectedStatus: "uncertain" },
      ),
    ]);
    const ok = [r1, r2].filter((r) => r.status === "fulfilled");
    const fail = [r1, r2].filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(fail.length, 1);
  });

  it("two independent adapter instances cannot both obtain ownership", async () => {
    const { a, b } = twoAdapters();
    const rec = sampleRecord({
      cadenceWindow: "week:2026-W55",
      idempotencyKey: "key:w55",
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        (i % 2 === 0 ? a : b).atomicClaimDelivery!({
          record: { ...rec, deliveryId: `del:${i}` },
          claimOwner: i % 2 === 0 ? "a" : "b",
          nowIso: "2026-07-23T14:00:00.000Z",
        }),
      ),
    );
    assert.equal(results.filter((r) => r.outcome === "claimed").length, 1);
  });
});

describe("schema repeatability and constraints", () => {
  it("schema SQL is idempotent-friendly and documents retention accurately", () => {
    const sql = readFileSync(
      join(process.cwd(), "lib/supabase/agent-os-schema.sql"),
      "utf8",
    );
    assert.match(sql, /create table if not exists agent_os_persisted_state/);
    assert.match(sql, /create table if not exists agent_os_delivery_claims/);
    assert.match(sql, /create index if not exists/);
    assert.match(sql, /founder-brief.*failure-alert|failure-alert.*founder-brief/s);
    assert.match(sql, /'uncertain'/);
    assert.match(sql, /agent_os_delivery_claims_window_kind_recipient_uq/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /do not add anon\/authenticated RLS policies|SERVICE-ROLE ONLY/i);
    assert.match(sql, /Automatic purge: NOT YET ENABLED/i);
    assert.match(sql, /approximately 90 days/i);
    assert.equal(/\bcreate\s+policy\b/i.test(sql), false);
    assert.equal(/\brecipient_email\b/i.test(sql), false);
    assert.equal(/\bapi_key\b/i.test(sql), false);
  });

  it("documents lease constant", () => {
    assert.equal(DELIVERY_CLAIM_LEASE_MS, 15 * 60 * 1000);
  });
});
