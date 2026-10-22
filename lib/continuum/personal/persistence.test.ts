import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deletePerformanceSourceWithClient, loadPerformanceStateWithClient, PerformanceRevisionConflict, savePerformanceStateWithClient } from "./persistence-core";
import { activateTrainingProgram, createInitialPersonalState } from "./program";
import { createHash } from "node:crypto";
import { correctActivityDate } from "./mutations";
import type { NaturalIngestionProposal } from "./types";

const jpegBytes = (...tail: number[]) => new Uint8Array([0xff, 0xd8, 0xff, ...tail]);
const pngBytes = (...tail: number[]) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...tail]);
import { configureTonalProgram, planTonalSessionFromScreenshot } from "./tonal-programs";

function configuredState(today = "2026-10-15") {
  return configureTonalProgram({ state: createInitialPersonalState(today), programId: "fit-over-40", weeklyFrequency: 3, source: { kind: "founder_confirmed", reference: "machine", reviewedAt: "2026-10-17T10:00:00Z" }, founderVerifiedAt: "2026-10-17T10:00:00Z" });
}

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
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: new File([jpegBytes(1, 2, 3)], "meal.jpg", { type: "image/jpeg" }), now: "2026-10-12T12:00:00Z" }, db.client);
  assert.equal(first.duplicate, false); assert.equal(first.revision, 1);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, now: "2026-10-12T12:01:00Z" }, db.client);
  assert.equal(retry.duplicate, true); assert.equal(retry.revision, 1);
  assert.equal(db.audits.size, 1); assert.equal(db.evidence.size, 1); assert.equal(db.uploads.size, 1);
  const reloaded = await loadPerformanceStateWithClient("founder-a", "2026-10-12", db.client);
  assert.equal(reloaded?.state.program.status, "setup");
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

test("an accepted adjustment uses the durable audit action and database constraint failures stay privacy-safe", async () => {
  const state = createInitialPersonalState("2026-10-12");
  const db = fakeSupabase();
  const saved = await savePerformanceStateWithClient({
    founderKey: "founder-a",
    expectedRevision: 0,
    state,
    mutation: { idempotencyKey: "adjustment-proposal-1", action: "accept_adjustment" },
  }, db.client);
  assert.equal(saved.revision, 1);

  const rejectedClient = {
    rpc: async () => ({
      data: null,
      error: {
        code: "23514",
        message: "new row violates check constraint continuum_performance_audit_action_check with private row details",
      },
    }),
    from: () => { throw new Error("state reload is not expected for a constraint failure"); },
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
  } as unknown as SupabaseClient;
  await assert.rejects(
    () => savePerformanceStateWithClient({
      founderKey: "founder-a",
      expectedRevision: 0,
      state,
      mutation: { idempotencyKey: "adjustment-proposal-2", action: "accept_adjustment" },
    }, rejectedClient),
    (error: unknown) => error instanceof Error
      && error.message === "performance-mutation-action-unavailable"
      && !error.message.includes("private row details"),
  );
});

test("founder-confirmed activation is an idempotent durable mutation", async () => {
  const db = fakeSupabase();
  const state = activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-17T12:00:00Z");
  const mutation = { idempotencyKey: "activate-program-2026-10-19", action: "activate_program" as const, accepted: { startDate: "2026-10-19" } };
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation }, db.client);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation }, db.client);
  assert.equal(first.revision, 1);
  assert.equal(retry.duplicate, true);
  assert.equal(db.audits.size, 1);
  assert.equal(first.state.program.anchorDate, "2026-10-19");
});

test("Tonal program screenshot configuration preserves digest provenance and deduplicates", async () => {
  const db = fakeSupabase();
  const bytes = pngBytes(9, 8, 7, 6);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const state = configureTonalProgram({
    state: createInitialPersonalState("2026-10-17"), programId: "fit-over-40", weeklyFrequency: 3,
    source: { kind: "tonal_app_screenshot", reference: `sha256:${digest}`, digest, reviewedAt: "2026-10-17T12:00:00Z", file: { name: "tonal.png", type: "image/png", size: bytes.length } },
    founderVerifiedAt: "2026-10-17T12:00:00Z",
  });
  const mutation = { idempotencyKey: `configure-tonal-${digest}`, action: "configure_strength_program" as const, entryId: `tonal-program-${digest.slice(0, 32)}`, sourceType: "tonal_program_screenshot" as const, accepted: { sourceDigest: digest } };
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: new File([bytes], "tonal.png", { type: "image/png" }) }, db.client);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: new File([bytes], "tonal.png", { type: "image/png" }) }, db.client);
  assert.equal(first.state.tonal.enrollment.sources[0]?.file?.storagePath?.includes(digest.slice(0, 32)), true);
  assert.equal(retry.duplicate, true);
  assert.equal(db.audits.size, 1);
  assert.equal(db.uploads.size, 1);
});

test("just-in-time Tonal plan upload is revisioned, source-bound, and idempotent", async () => {
  const db = fakeSupabase(); const bytes = pngBytes(2, 4, 6, 8); const digest = createHash("sha256").update(bytes).digest("hex");
  const active = activateTrainingProgram(configuredState(), "2026-10-19", "2026-10-18T12:00:00Z");
  const source = { kind: "tonal_app_screenshot" as const, reference: `sha256:${digest}`, digest, reviewedAt: "2026-10-18T13:00:00Z", file: { name: "upcoming.png", type: "image/png", size: bytes.length } };
  const state = planTonalSessionFromScreenshot(active, { sequencePosition: 1, title: "Visible title", movements: [{ name: "Visible movement", reps: "8–10" }], source, approvedAt: source.reviewedAt });
  const proposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = { id: "plan-proposal", proposedAt: source.reviewedAt, sourceType: "activity_screenshot", confidence: "high", assumptions: [], summary: "Visible Tonal plan", model: "test", sourceDigest: digest, normalizedSourceDigest: digest, kind: "activity", activity: { activityType: "Tonal" }, guidance: "Review visible values." };
  const mutation = { idempotencyKey: `plan-tonal-1-${digest}`, action: "plan_strength_session" as const, entryId: `tonal-plan-1-${digest.slice(0, 32)}`, sourceType: "activity_screenshot" as const, proposal, accepted: { sourceDigest: digest, sequencePosition: 1 } };
  const file = new File([bytes], "upcoming.png", { type: "image/png" });
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: file }, db.client);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation, sourceFile: file }, db.client);
  assert.equal(first.revision, 1); assert.equal(retry.duplicate, true); assert.equal(db.audits.size, 1); assert.equal(db.uploads.size, 1);
  assert.equal(first.state.tonal.enrollment.sessions[0]?.plannedSource?.file?.storagePath?.includes(digest.slice(0, 32)), true);
});

test("source uploads require an accepted entry and supported private image", async () => {
  const db = fakeSupabase(); const state = createInitialPersonalState("2026-10-12");
  await assert.rejects(() => savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey: "snapshot-123", action: "snapshot" }, sourceFile: new File(["x"], "x.jpg", { type: "image/jpeg" }) }, db.client), /ownership-invalid/);
  await assert.rejects(() => savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey: "accept-123", action: "accept_activity", entryId: "a" }, sourceFile: new File(["x"], "x.svg", { type: "image/svg+xml" }) }, db.client), /source-invalid/);
});

test("founder-controlled source deletion removes the private object but retains the structured entry", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-12");
  const state = { ...initial, meals: [{ id: "meal-delete-source", timestamp: "2026-10-12T12:00:00Z", occurredOn: "2026-10-12", items: [{ id: "item-1", name: "Chicken", portion: "8 oz", calories: 360, protein: 56, carbs: 0, fat: 12, confidence: "high" as const }], calories: 360, protein: 56, carbs: 0, fat: 12, photo: { name: "meal.jpg", type: "image/jpeg", size: 3 }, provenance: ["user_confirmed" as const] }] };
  await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey: "accept-for-delete", action: "accept_meal", entryId: "meal-delete-source", sourceType: "meal_photo" }, sourceFile: new File([jpegBytes(1, 2, 3)], "meal.jpg", { type: "image/jpeg" }) }, db.client);
  const deleted = await deletePerformanceSourceWithClient({ founderKey: "founder-a", expectedRevision: 1, entryId: "meal-delete-source", kind: "meal", idempotencyKey: "delete-source-1" }, db.client);
  assert.equal(deleted.revision, 2); assert.equal(deleted.state.meals.length, 1);
  assert.equal(deleted.state.meals[0]?.photo?.storagePath, undefined); assert.equal(db.uploads.size, 0); assert.equal(db.audits.size, 2);
});

test("activity screenshot persistence keeps original-byte dedupe identity while verifying normalized upload bytes", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-12");
  const bytes = pngBytes(9, 8, 7, 6);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const originalDigest = createHash("sha256").update("original-iphone-image-bytes").digest("hex");
  const idempotencyKey = `accept-activity-${originalDigest}`;
  const entryId = `activity-${originalDigest.slice(0, 32)}`;
  const proposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = {
    id: "proposal-a", proposedAt: "2026-10-13T12:00:00Z", sourceType: "activity_screenshot",
    confidence: "high", assumptions: [], summary: "Visible golf activity", model: "test", sourceDigest: originalDigest, normalizedSourceDigest: digest,
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
    mutation: { ...mutation, proposal: { ...proposal, normalizedSourceDigest: "0".repeat(64) } }, sourceFile: source,
  }, db.client), /source-digest-invalid/);
});

test("one screenshot can persist distinct activities against one source and one audit mutation", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-17");
  const bytes = pngBytes(1, 3, 5, 7);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const idempotencyKey = `accept-activity-${digest}`;
  const entryId = `activity-${digest.slice(0, 32)}`;
  const proposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = {
    id: "proposal-multi", proposedAt: "2026-10-17T12:00:00Z", sourceType: "activity_screenshot", confidence: "high", assumptions: [], summary: "Golf and Soccer", model: "test", sourceDigest: digest, normalizedSourceDigest: digest,
    kind: "activity", activity: { activityType: "Golf" }, activities: [{ activityType: "Golf" }, { activityType: "Soccer" }], guidance: "Review visible values.",
  };
  const source = { name: "whoop.png", type: "image/png", size: bytes.length };
  const activities = proposal.activities!.map((facts, index) => ({
    id: index === 0 ? entryId : `${entryId}-${index + 1}`, timestamp: "2026-10-17T12:01:00Z", occurredOn: "2026-10-12", facts,
    sourceType: "activity_screenshot" as const, source, sterlingProposal: proposal, assumptions: [], corrections: [], guidance: proposal.guidance, idempotencyKey, provenance: ["sterling" as const, "user_confirmed" as const],
  }));
  const state = { ...initial, activities };
  const saved = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state, mutation: { idempotencyKey, action: "accept_activity", entryId, sourceType: "activity_screenshot", proposal, accepted: activities }, sourceFile: new File([bytes], "whoop.png", { type: "image/png" }) }, db.client);
  assert.equal(saved.state.activities.length, 2);
  assert.equal(saved.state.activities[0]?.source?.storagePath, saved.state.activities[1]?.source?.storagePath);
  assert.equal(db.uploads.size, 1); assert.equal(db.audits.size, 1); assert.equal(db.evidence.size, 1);
  const deleted = await deletePerformanceSourceWithClient({ founderKey: "founder-a", expectedRevision: 1, entryId, kind: "activity", idempotencyKey: "delete-shared-source" }, db.client);
  assert.equal(deleted.state.activities.every((activity) => !activity.source?.storagePath), true);
  assert.equal(db.uploads.size, 0);
});

test("after evidence enriches the existing scheduled workout activity idempotently and a failed retry preserves it", async () => {
  const db = fakeSupabase();
  const active = activateTrainingProgram(configuredState("2026-10-19"), "2026-10-19", "2026-10-18T12:00:00Z");
  const workoutId = active.schedule.find((workout) => workout.prescription.tonalSessionOrder === 1)!.id;
  const existing = {
    id: "activity-existing", timestamp: "2026-10-20T18:00:00Z", occurredOn: "2026-10-20", facts: { activityType: "Tonal" },
    sourceType: "activity_screenshot" as const, assumptions: [], corrections: [], guidance: "Existing founder-confirmed completion.",
    idempotencyKey: "accept-activity-existing", scheduledWorkoutId: workoutId, provenance: ["sterling" as const, "user_confirmed" as const],
  };
  const accepted = await savePerformanceStateWithClient({
    founderKey: "founder-a", expectedRevision: 0, state: { ...active, activities: [existing] },
    mutation: { idempotencyKey: existing.idempotencyKey, action: "accept_activity", entryId: existing.id, accepted: existing },
  }, db.client);
  const bytes = pngBytes(6, 2, 6, 4); const digest = createHash("sha256").update(bytes).digest("hex");
  const proposal: Extract<NaturalIngestionProposal, { kind: "activity" }> = {
    id: "after-proposal", proposedAt: "2026-10-20T18:05:00Z", sourceType: "activity_screenshot", confidence: "high", assumptions: [], summary: "Visible Tonal results", model: "test",
    sourceDigest: digest, normalizedSourceDigest: digest, kind: "activity", activity: { activityType: "Tonal", reportedCalories: { value: 280, evidence: "observed" } }, guidance: "Review visible values.",
  };
  const enriched = { ...existing, facts: proposal.activity, source: { name: "after.png", type: "image/png", size: bytes.length }, sterlingProposal: proposal };
  const enrichedState = { ...accepted.state, activities: accepted.state.activities.map((activity) => activity.id === existing.id ? enriched : activity) };
  const mutation = { idempotencyKey: `enrich-activity-${existing.id}-${digest}`, action: "edit_activity" as const, entryId: existing.id, sourceType: "activity_screenshot" as const, proposal, accepted: enriched };
  const source = new File([bytes], "after.png", { type: "image/png" });

  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: enrichedState, mutation, sourceFile: source }, db.client);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: enrichedState, mutation, sourceFile: source }, db.client);
  assert.equal(first.state.activities.length, 1);
  assert.equal(first.state.activities[0]?.id, existing.id);
  assert.equal(first.state.activities[0]?.scheduledWorkoutId, workoutId);
  assert.equal(first.state.activities[0]?.source?.storagePath?.includes(existing.id), true);
  assert.equal(retry.duplicate, true); assert.equal(retry.revision, 2); assert.equal(db.audits.size, 2); assert.equal(db.uploads.size, 1);

  await assert.rejects(() => savePerformanceStateWithClient({
    founderKey: "founder-a", expectedRevision: 2, state: enrichedState,
    mutation: { ...mutation, idempotencyKey: `${mutation.idempotencyKey}-tampered`, proposal: { ...proposal, normalizedSourceDigest: "0".repeat(64) } }, sourceFile: source,
  }, db.client), /source-digest-invalid/);
  const reloaded = await loadPerformanceStateWithClient("founder-a", "2026-10-20", db.client);
  assert.deepEqual(reloaded?.state.activities, first.state.activities, "failed after uploads must preserve the existing completion and evidence");
});

test("recovery screenshots preserve private provenance and original-byte idempotency", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-20");
  const bytes = pngBytes(4, 8, 15, 16, 23, 42); const digest = createHash("sha256").update(bytes).digest("hex");
  const proposal: Extract<NaturalIngestionProposal, { kind: "recovery" }> = {
    id: "recovery-proposal", proposedAt: "2026-10-20T11:00:00Z", sourceType: "recovery_screenshot", confidence: "high", assumptions: [],
    summary: "Visible WHOOP recovery", model: "test", sourceDigest: digest, normalizedSourceDigest: digest, kind: "recovery",
    recovery: { recoveryScore: { value: 71, source: "observed" }, hrvMs: { value: 48, source: "observed" }, strain: { value: 8.4, source: "observed" } },
    sourceDate: { month: 10, day: 20, year: 2026, evidence: "observed" }, guidance: "Daily strain is not workout-specific.",
  };
  const idempotencyKey = `accept-recovery-${digest}`; const entryId = `recovery-${digest.slice(0, 32)}`;
  const entry = {
    id: entryId, date: "2026-10-20", recordedAt: "2026-10-20T11:01:00Z", ...proposal.recovery,
    sourceType: "recovery_screenshot" as const, source: { name: "whoop.png", type: "image/png", size: bytes.length }, sterlingProposal: proposal,
    assumptions: [], corrections: [], idempotencyKey, provenance: ["sterling" as const, "user_confirmed" as const],
  };
  const mutation = { idempotencyKey, action: "accept_recovery" as const, entryId, sourceType: "recovery_screenshot" as const, proposal, accepted: entry };
  const source = new File([bytes], "whoop.png", { type: "image/png" });
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state: { ...initial, recoveryEntries: [entry] }, mutation, sourceFile: source }, db.client);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state: { ...initial, recoveryEntries: [entry] }, mutation, sourceFile: source }, db.client);
  assert.equal(first.revision, 1); assert.equal(first.state.recoveryEntries[0]?.source?.storagePath?.includes(digest.slice(0, 16)), true);
  assert.equal(first.state.activities.length, 0, "daily strain must not create an activity");
  assert.equal(retry.duplicate, true); assert.equal(retry.revision, 1); assert.equal(db.audits.size, 1); assert.equal(db.uploads.size, 1);
  await assert.rejects(() => savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: { ...initial, recoveryEntries: [entry] }, mutation: { ...mutation, idempotencyKey: "accept-recovery-tampered" }, sourceFile: source }, db.client), /source-dedupe-invalid/);
  await assert.rejects(() => savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: { ...initial, recoveryEntries: [entry] }, mutation: { ...mutation, sourceType: "activity_screenshot" }, sourceFile: source }, db.client), /source-digest-invalid/);
});

test("an activity date correction persists in place and an idempotent retry creates no duplicate mutation", async () => {
  const db = fakeSupabase(); const initial = createInitialPersonalState("2026-10-17");
  const activity = {
    id: "activity-correct-date", timestamp: "2026-10-17T12:00:00Z", occurredOn: "2026-10-16", facts: { activityType: "Golf" },
    sourceType: "activity_screenshot" as const, assumptions: [], corrections: [], guidance: "Review visible values.",
    idempotencyKey: "accept-activity-correct-date", provenance: ["sterling" as const, "user_confirmed" as const],
  };
  const accepted = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 0, state: { ...initial, activities: [activity] }, mutation: { idempotencyKey: activity.idempotencyKey, action: "accept_activity", entryId: activity.id, accepted: activity } }, db.client);
  const corrected = correctActivityDate(accepted.state, activity.id, "2026-10-12");
  const mutation = { idempotencyKey: "edit-activity-date-activity-correct-date-2026-10-12", action: "edit_activity" as const, entryId: activity.id, accepted: corrected.activity, corrections: corrected.activity.corrections };
  const first = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: corrected.state, mutation }, db.client);
  const retry = await savePerformanceStateWithClient({ founderKey: "founder-a", expectedRevision: 1, state: corrected.state, mutation }, db.client);
  assert.equal(first.revision, 2); assert.equal(first.state.activities.length, 1);
  assert.equal(first.state.activities[0]?.occurredOn, "2026-10-12");
  assert.equal(retry.duplicate, true); assert.equal(retry.revision, 2); assert.equal(db.audits.size, 2);
});
