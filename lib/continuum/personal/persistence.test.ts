import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deletePerformanceSourceWithClient, loadPerformanceStateWithClient, PerformanceRevisionConflict, savePerformanceStateWithClient } from "./persistence-core";
import { createInitialPersonalState } from "./program";
import { createHash } from "node:crypto";
import type { NaturalIngestionProposal } from "./types";

type Row = Record<string, unknown>;

function fakeSupabase() {
  const states = new Map<string, Row>(); const audits = new Map<string, Row>(); const evidence = new Map<string, Row>(); const uploads = new Map<string, Uint8Array>();
  let transaction = Promise.resolve();
  const from = (table: string) => ({
    select: (columns: string) => {
      void columns; const filters: Record<string, unknown> = {};
      const query = {
        eq(key: string, value: unknown) { filters[key] = value; return query; },
        async maybeSingle() { return { data: table === "continuum_performance_state" ? states.get(String(filters.founder_key)) ?? null : null, error: null }; },
      };
      return query;
    },
  });
  const rpc = (_name: string, args: Record<string, unknown>) => {
    const run = transaction.then(async () => {
      const founder = String(args.p_founder_key); const idempotencyKey = String(args.p_idempotency_key); const auditKey = `${founder}:${idempotencyKey}`;
      const current = states.get(founder); const currentRevision = Number(current?.revision ?? 0);
      if (audits.has(auditKey)) return { data: [{ saved_state: current?.state, saved_revision: currentRevision, was_duplicate: true }], error: null };
      if (currentRevision !== Number(args.p_expected_revision)) return { data: null, error: { code: "40001", message: "performance_revision_conflict" } };
      const revision = currentRevision + 1;
      states.set(founder, { founder_key: founder, state: args.p_state, revision });
      const auditId = String(args.p_audit_id); audits.set(auditKey, { id: auditId, founder_key: founder, evidence_hash: args.p_evidence_hash });
      evidence.set(auditId, { source_storage_path: args.p_source_storage_path, source_expires_at: args.p_source_expires_at, sensitive_expires_at: args.p_sensitive_expires_at });
      return { data: [{ saved_state: args.p_state, saved_revision: revision, was_duplicate: false }], error: null };
    });
    transaction = run.then(() => undefined, () => undefined);
    return run;
  };
  const client = {
    from, rpc,
    storage: { from: (bucket: string) => {
      void bucket;
      return {
        async upload(path: string, bytes: Uint8Array) { if (uploads.has(path)) return { error: { message: "already exists" } }; uploads.set(path, bytes); return { error: null }; },
        async remove(paths: string[]) { for (const path of paths) uploads.delete(path); return { error: null }; },
      };
    } },
  } as unknown as SupabaseClient;
  return { client, states, audits, evidence, uploads };
}

test("state survives a reload, scopes rows by founder, and deduplicates a retry", async () => {
  const db = fakeSupabase(); const state = createInitialPersonalState("2026-10-12");
  const mutation = { idempotencyKey: "accept-proposal-1", action: "accept_meal" as const, entryId: "meal-1", sourceType: "meal_photo" as const };
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type: "image/jpeg" }), now: "2026-10-12T12:00:00Z" }, db.client);
  assert.equal(first.duplicate, false); assert.equal(first.revision, 1);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, now: "2026-10-12T12:01:00Z" }, db.client);
  assert.equal(retry.duplicate, true); assert.equal(retry.revision, 1);
  assert.equal(db.audits.size, 1); assert.equal(db.evidence.size, 1); assert.equal(db.uploads.size, 1);
  const reloaded = await loadPerformanceStateWithClient("founder-a", "2026-10-12", db.client);
  assert.equal(reloaded?.state.program.anchorDate, "2026-10-12");
  assert.equal(await loadPerformanceStateWithClient("founder-b", "2026-10-12", db.client), null);
});

test("two simultaneous conflicting writes against one revision cannot both succeed", async () => {
  const db = fakeSupabase(); const original = createInitialPersonalState("2026-10-12");
  await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state: original, mutation: { idempotencyKey: "bootstrap-0001", action: "bootstrap" } }, db.client);
  const left = { ...original, nutritionTargets: { ...original.nutritionTargets, calories: 2300 } };
  const right = { ...original, nutritionTargets: { ...original.nutritionTargets, calories: 2500 } };
  const results = await Promise.allSettled([
    savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: left, mutation: { idempotencyKey: "concurrent-left", action: "snapshot" } }, db.client),
    savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: right, mutation: { idempotencyKey: "concurrent-right", action: "snapshot" } }, db.client),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.ok(rejected?.reason instanceof PerformanceRevisionConflict);
  assert.equal(rejected.reason.current?.revision, 2);
  assert.equal(db.audits.size, 2, "the rejected write must not create an audit mutation");
});

test("source uploads require an accepted entry and supported private image", async () => {
  const db = fakeSupabase(); const state = createInitialPersonalState("2026-10-12");
  await assert.rejects(() => savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey: "snapshot-123", action: "snapshot" }, sourceFile: new File(["x"], "x.jpg", { type: "image/jpeg" }) }, db.client), /ownership-invalid/);
  await assert.rejects(() => savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey: "accept-123", action: "accept_activity", entryId: "a" }, sourceFile: new File(["x"], "x.svg", { type: "image/svg+xml" }) }, db.client), /source-invalid/);
});

test("founder-controlled source deletion removes the private object but retains the structured entry", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-12");
  const state = { ...initial, meals: [{ id: "meal-delete-source", timestamp: "2026-10-12T12:00:00Z", occurredOn: "2026-10-12", items: [{ id: "item-1", name: "Chicken", portion: "8 oz", calories: 360, protein: 56, carbs: 0, fat: 12, confidence: "high" as const }], calories: 360, protein: 56, carbs: 0, fat: 12, photo: { name: "meal.jpg", type: "image/jpeg", size: 3 }, provenance: ["user_confirmed" as const] }] };
  await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey: "accept-for-delete", action: "accept_meal", entryId: "meal-delete-source", sourceType: "meal_photo" }, sourceFile: new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type: "image/jpeg" }) }, db.client);
  const deleted = await deletePerformanceSourceWithClient({ founderKey: "founder-a", expectedRevision: 1, entryId: "meal-delete-source", kind: "meal", idempotencyKey: "delete-source-1" }, db.client);
  assert.equal(deleted.revision, 2); assert.equal(deleted.state.meals.length, 1);
  assert.equal(deleted.state.meals[0]?.photo?.storagePath, undefined); assert.equal(db.uploads.size, 0); assert.equal(db.audits.size, 2);
});

test("activity screenshot persistence binds dedupe identity to the exact source bytes", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-12");
  const bytes = new Uint8Array([9, 8, 7, 6]);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const idempotencyKey = `accept-activity-${digest}`;
  const entryId = `activity-${digest.slice(0, 32)}`;
  const proposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = {
    id: "proposal-a", proposedAt: "2026-10-13T12:00:00Z", sourceType: "activity_screenshot",
    confidence: "high", assumptions: [], summary: "Visible golf activity", model: "test", sourceDigest: digest,
    kind: "activity", activity: { activityType: "Golf", durationMinutes: { value: 90, evidence: "observed" } }, guidance: "Review visible values.",
  };
  const activity = {
    id: entryId, timestamp: "2026-10-13T12:01:00Z", occurredOn: "2026-10-11", facts: proposal.activity,
    sourceType: "activity_screenshot" as const, source: { name: "golf.png", type: "image/png", size: bytes.length }, sterlingProposal: proposal,
    assumptions: [], corrections: [], guidance: proposal.guidance, idempotencyKey, provenance: ["sterling" as const, "user_confirmed" as const],
  };
  const state = { ...initial, activities: [activity] };
  const mutation = { idempotencyKey, action: "accept_activity" as const, entryId, sourceType: "activity_screenshot" as const, proposal, accepted: activity };
  const source = new File([bytes], "golf.png", { type: "image/png" });
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: source }, db.client);
  assert.equal(first.duplicate, false); assert.equal(db.uploads.size, 1);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: source }, db.client);
  assert.equal(retry.duplicate, true); assert.equal(db.audits.size, 1); assert.equal(db.uploads.size, 1);
  await assert.rejects(() => savePerformanceStateWithClient({
    founderKey: "founder-a", expectedRevision: 1, state,
    mutation: { ...mutation, idempotencyKey: "accept-activity-tampered" }, sourceFile: source,
  }, db.client), /source-dedupe-invalid/);
  await assert.rejects(() => savePerformanceStateWithClient({
    founderKey: "founder-a", expectedRevision: 1, state,
    mutation: { ...mutation, proposal: { ...proposal, sourceDigest: "0".repeat(64) } }, sourceFile: source,
  }, db.client), /source-digest-invalid/);
});
