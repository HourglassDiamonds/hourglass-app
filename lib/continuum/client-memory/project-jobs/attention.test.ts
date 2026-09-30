import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { evaluateAttentionEligibility } from "./attention-eligibility";
import { nextAttentionBoundary } from "./attention-boundary";
import { attentionCreationEnabled, PHASE_1_ATTENTION_CREATION_ENABLED } from "./attention-creation-gate";
import { parseAttention, parseAttentionMetadata } from "./attention";
import { reminderDispositionMutation, watchingDispositionMutation } from "./attention-disposition";
import { createProjectJob } from "./create";
import { jobsShareActionIdentity } from "./identity";
import { applyOpenJobStateChange } from "./mutate";
import { createInMemoryProjectJobStore } from "./store";
import type { AttentionMetadataV1, ProjectJob } from "./types";
import { snapshotBoundaryIsFuture } from "@/lib/continuum/today-snapshot";

const metadata = (extra: Partial<AttentionMetadataV1> = {}): AttentionMetadataV1 => ({
  version: 1, timingPrecision: "exact-instant", timezone: "America/New_York",
  originalWording: "remind me tomorrow at 9 AM", referenceInstant: "2026-09-29T14:00:00.000Z",
  originalLocalDateTime: "2026-09-30T09:00:00", conditionPolicy: "review-only", assumptions: [], ...extra,
});
const job = (extra: Partial<ProjectJob> = {}): ProjectJob => ({
  jobId: "00000000-0000-4000-8000-000000000001", projectId: null, kind: "required_action",
  subject: "Follow up", detail: null, waitingOnActor: "founder", associatedPersonId: null,
  state: "open", dueAt: null, deferredUntil: null, resolvedAt: null, cancelledAt: null,
  createdAt: "2026-09-29T14:00:00.000Z", updatedAt: "2026-09-29T14:00:00.000Z",
  createdBy: "founder", sourceSystem: "concierge-manual", sourceRef: null,
  createdMutationId: "10000000-0000-4000-8000-000000000001", attentionMode: "action",
  activationAt: null, checkpointAt: null, attentionMetadata: null, ...extra,
});

test("attention metadata is closed, versioned, and bounded", () => {
  assert.equal(parseAttentionMetadata(metadata()).ok, true);
  assert.deepEqual(parseAttentionMetadata({ ...metadata(), surprise: true }), { ok: false, code: "invalid-attention-metadata" });
  assert.deepEqual(parseAttentionMetadata({ ...metadata(), version: 2 }), { ok: false, code: "unsupported-attention-metadata-version" });
  assert.equal(parseAttentionMetadata(metadata({ originalWording: "x".repeat(501) })).ok, false);
  assert.equal(parseAttentionMetadata(metadata({ conditionText: "x".repeat(501) })).ok, false);
  assert.equal(parseAttentionMetadata(metadata({ assumptions: Array.from({ length: 9 }, () => "bounded") })).ok, false);
  assert.equal(parseAttentionMetadata(metadata({ originalWording: "é".repeat(4200) })).ok, false);
});

test("action reminder and watching invariants are distinct", () => {
  assert.equal(parseAttention({ attentionMode: "action", activationAt: null, checkpointAt: null,
    attentionMetadata: null, waitingOnActor: "vendor" }).ok, true);
  assert.equal(parseAttention({ attentionMode: "action", activationAt: "2026-09-30T00:00:00Z",
    attentionMetadata: null, waitingOnActor: "founder" }).ok, false);
  assert.equal(parseAttention({ attentionMode: "reminder", activationAt: "2026-09-30T00:00:00Z",
    checkpointAt: null, attentionMetadata: metadata(), waitingOnActor: "founder" }).ok, true);
  assert.equal(parseAttention({ attentionMode: "reminder", activationAt: "2026-09-30T00:00:00Z",
    checkpointAt: null, attentionMetadata: metadata(), waitingOnActor: "vendor" }).ok, false);
  assert.equal(parseAttention({ attentionMode: "watching", activationAt: null, checkpointAt: null,
    attentionMetadata: metadata(), waitingOnActor: "vendor" }).ok, false);
  assert.equal(parseAttention({ attentionMode: "watching", activationAt: null, checkpointAt: null,
    attentionMetadata: metadata({ unscheduledConfirmed: true }), waitingOnActor: "vendor" }).ok, true);
});

test("eligibility observes exact boundaries, snooze, terminal state, and ball-holder", () => {
  const activationAt = "2026-10-01T14:00:00.000Z";
  const reminder = job({ attentionMode: "reminder", activationAt, attentionMetadata: metadata() });
  assert.equal(evaluateAttentionEligibility(reminder, { now: new Date("2026-10-01T13:59:59.999Z") }).reason, "scheduled");
  assert.equal(evaluateAttentionEligibility(reminder, { now: new Date(activationAt) }).eligible, true);
  assert.equal(evaluateAttentionEligibility(reminder, { now: new Date("2026-10-01T14:00:00.001Z") }).eligible, true);
  const snoozed = job({ ...reminder, state: "snoozed", deferredUntil: "2026-10-02T14:00:00.000Z" });
  assert.equal(evaluateAttentionEligibility(snoozed, { now: new Date("2026-10-01T15:00:00Z") }).reason, "deferred");
  assert.equal(evaluateAttentionEligibility(snoozed, { now: new Date("2026-10-02T14:00:00Z") }).eligible, true);
  const beforeActivation = job({ ...snoozed, activationAt: "2026-10-03T14:00:00Z", deferredUntil: "2026-10-02T14:00:00Z" });
  assert.equal(evaluateAttentionEligibility(beforeActivation, { now: new Date("2026-10-02T15:00:00Z") }).reason, "scheduled");
  const unsnoozedBeforeActivation = job({ ...reminder, activationAt: "2026-10-03T14:00:00Z", state: "open", deferredUntil: null });
  assert.equal(evaluateAttentionEligibility(unsnoozedBeforeActivation, { now: new Date("2026-10-02T15:00:00Z") }).reason, "scheduled");
  assert.equal(evaluateAttentionEligibility(job({ state: "resolved", resolvedAt: activationAt }), { now: new Date(activationAt) }).reason, "terminal");
  assert.equal(evaluateAttentionEligibility(job({ waitingOnActor: "vendor" }), { now: new Date(activationAt) }).reason, "waiting-on-external");
  assert.equal(evaluateAttentionEligibility(job({ dueAt: "2020-01-01" }), { now: new Date(activationAt) }).reason, "founder-action");
  assert.equal(evaluateAttentionEligibility(job({ activationAt }), { now: new Date(activationAt) }).reason, "repair-required");
});

test("watching remains waiting until checkpoint and missing evidence yields review wording", () => {
  const watch = job({ attentionMode: "watching", waitingOnActor: "vendor",
    checkpointAt: "2026-10-01T14:00:00Z", attentionMetadata: metadata() });
  assert.equal(evaluateAttentionEligibility(watch, { now: new Date("2026-10-01T13:59:59Z") }).reason, "scheduled");
  const elapsed = evaluateAttentionEligibility(watch, { now: new Date("2026-10-01T14:00:00Z") });
  assert.equal(elapsed.reason, "watch-review"); assert.match(elapsed.prompt ?? "", /^Check whether/);
  assert.equal(evaluateAttentionEligibility(watch, { now: new Date("2026-10-01T14:00:00Z"),
    target: { status: "satisfied", authoritative: true } }).reason, "target-satisfied");
  assert.equal(evaluateAttentionEligibility(watch, { now: new Date("2026-10-01T14:00:00Z"),
    target: { status: "superseded", authoritative: true } }).reason, "target-superseded");
  const unscheduled = job({ attentionMode: "watching", waitingOnActor: "vendor", attentionMetadata: metadata({ unscheduledConfirmed: true }) });
  assert.equal(evaluateAttentionEligibility(unscheduled, { now: new Date() }).reason, "watching-unscheduled");
  const snoozed = { ...watch, state: "snoozed" as const, deferredUntil: "2026-10-02T14:00:00Z" };
  assert.equal(evaluateAttentionEligibility(snoozed, { now: new Date("2026-10-01T15:00:00Z") }).reason, "deferred");
  assert.equal(evaluateAttentionEligibility(snoozed, { now: new Date("2026-10-02T14:00:00Z") }).reason, "watch-review");
});

test("subject similarity cannot collapse attention identities", () => {
  const base = job({ subject: "Check CAD", attentionMode: "reminder", activationAt: "2026-10-01T14:00:00Z", attentionMetadata: metadata() });
  const later = { ...base, activationAt: "2026-10-02T14:00:00Z" };
  const watching = { ...base, attentionMode: "watching" as const, activationAt: null, checkpointAt: "2026-10-01T14:00:00Z" };
  assert.equal(jobsShareActionIdentity(base, later), false);
  assert.equal(jobsShareActionIdentity(base, watching), false);
  assert.equal(jobsShareActionIdentity(job({ associatedPersonId: "00000000-0000-4000-8000-000000000010" }),
    job({ associatedPersonId: "00000000-0000-4000-8000-000000000011" })), false);
  const exactA = job({ attentionMode: "watching", attentionMetadata: metadata({ sourceReference: "thread-1", revisionReference: "CAD-1" }) });
  assert.equal(jobsShareActionIdentity(exactA, { ...exactA, attentionMetadata: metadata({ sourceReference: "thread-1", revisionReference: "CAD-2" }) }), false);
  assert.equal(jobsShareActionIdentity(exactA, { ...exactA, subject: "Renamed" }), true);
});

test("operation identity includes changed attention schedule and exact retry is idempotent", () => {
  const store = createInMemoryProjectJobStore(); const first = job({ attentionMode: "reminder",
    activationAt: "2026-10-01T14:00:00Z", attentionMetadata: metadata() });
  assert.equal(store.insertJob(first, { operation: "create" }).status, "created");
  assert.equal(store.insertJob(first, { operation: "create" }).status, "already-present");
  assert.throws(() => store.insertJob({ ...first, activationAt: "2026-10-02T14:00:00Z" }, { operation: "create" }), /idempotency-conflict/);
});

test("shared boundary sees non-actionable jobs below any visible Top N and performs no write", () => {
  const store = createInMemoryProjectJobStore();
  for (let index = 0; index < 6; index += 1) store.insertJob(job({ jobId: `00000000-0000-4000-8000-00000000000${index + 1}`,
    createdMutationId: `10000000-0000-4000-8000-00000000000${index + 1}`,
    attentionMode: index === 5 ? "watching" : "action", waitingOnActor: index === 5 ? "vendor" : "founder",
    checkpointAt: index === 5 ? "2026-10-01T14:00:00Z" : null,
    attentionMetadata: index === 5 ? metadata() : null }), { operation: "create", index });
  const before = store.listMutations().length;
  assert.equal(nextAttentionBoundary(store.listJobs(), new Date("2026-10-01T13:00:00Z")), "2026-10-01T14:00:00.000Z");
  evaluateAttentionEligibility(store.listJobs()[0], { now: new Date("2026-10-01T15:00:00Z") });
  assert.equal(store.listMutations().length, before);
});

test("creation capability remains fail closed until all four deployment facts are verified", () => {
  assert.equal(PHASE_1_ATTENTION_CREATION_ENABLED, false);
  assert.equal(attentionCreationEnabled({ projectlessAtomicMigration: true, attentionMigration: true,
    attentionAwareReadersWriters: true, todayCapturePhase2: false }), false);
  assert.equal(attentionCreationEnabled({ projectlessAtomicMigration: true, attentionMigration: true,
    attentionAwareReadersWriters: true, todayCapturePhase2: true }), true);
});

test("Phase 1 rejects durable Reminder creation before touching persistence", async () => {
  const never = async (): Promise<never> => { throw new Error("must not reach persistence"); };
  const result = await createProjectJob({ findAppliedOperation: never, nowIso: () => "", newJobId: () => "",
    getEntity: never, getProjectProfile: never, getPersonProfile: never,
    hasActiveClientProjectRelationship: never, listUnresolvedJobs: never, applyCreate: never }, {
    mutationId: "20000000-0000-4000-8000-000000000001", projectId: null, kind: "required_action",
    subject: "Call Ada", waitingOnActor: "founder", actor: "founder", attentionMode: "reminder",
    activationAt: "2026-10-01T14:00:00Z", attentionMetadata: metadata(),
  });
  assert.deepEqual(result, { ok: false, reason: "feature-disabled", code: "attention-creation-disabled" });
});

test("typed dispositions keep schedule history explicit and never alter the ball-holder", () => {
  const base = { mutationId: "30000000-0000-4000-8000-000000000001",
    jobId: "00000000-0000-4000-8000-000000000001", projectId: null, actor: "founder" };
  assert.equal(reminderDispositionMutation(base, { kind: "done" }).action, "resolve");
  assert.equal(reminderDispositionMutation(base, { kind: "cancel" }).action, "cancel");
  assert.equal(reminderDispositionMutation(base, { kind: "snooze", deferredUntil: "2026-10-02T14:00:00Z" }).action, "snooze");
  assert.equal(reminderDispositionMutation(base, { kind: "reschedule", activationAt: "2026-10-03T14:00:00Z", metadata: metadata() }).action,
    "reschedule_attention");
  const watch = job({ attentionMode: "watching", waitingOnActor: "vendor", checkpointAt: "2026-10-01T14:00:00Z", attentionMetadata: metadata() });
  const checked = applyOpenJobStateChange(watch, { action: "watch_checked", now: "2026-10-01T14:00:00Z",
    attention: { attentionMode: "watching", activationAt: null, checkpointAt: null,
      attentionMetadata: metadata({ unscheduledConfirmed: true }) } });
  assert.equal(checked.ok && checked.next.waitingOnActor, "vendor");
  assert.equal(checked.ok && checked.next.checkpointAt, null);
  assert.equal(watchingDispositionMutation(base, { kind: "stop-watching" }).action, "stop_watching");
  assert.equal(watchingDispositionMutation(base, { kind: "dependency-resolved" }).action, "dependency_resolved");
});

test("migration is additive, indexed, v2 snapshot compatible, and prerequisite guarded", () => {
  const sql = readFileSync("supabase/migrations/20260930010000_attention_persistence.sql", "utf8");
  assert.match(sql, /attention_mode text not null default 'action'/i);
  assert.match(sql, /where state in \('open', 'snoozed'\).*attention_mode = 'reminder'/i);
  assert.doesNotMatch(sql, /where[^;]*(?:now\(\)|current_timestamp)/i);
  assert.match(sql, /applied\.operation->>'version' = '1'/);
  assert.match(sql, /legacy_operation_snapshot/);
  assert.match(sql, /incoming\.attention_mode <> 'action'/);
  assert.match(sql, /requires verified projectless\/atomic foundation/i);
});

test("snapshot publication rejects an elapsed shared attention boundary", () => {
  const payload = { readModelVersion: "continuum-today-read-model-v3" as const,
    validUntil: "2026-10-01T14:00:00Z", docket: { items: [], watching: [] } } as never;
  assert.equal(snapshotBoundaryIsFuture(payload, "2026-10-01T13:59:59.999Z"), true);
  assert.equal(snapshotBoundaryIsFuture(payload, "2026-10-01T14:00:00.000Z"), false);
});
