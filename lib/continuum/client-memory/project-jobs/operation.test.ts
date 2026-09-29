import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { InMemoryProjectJobStore } from "./store";
import { createInMemoryProjectJobWriter } from "./writer";
import type { CreateProjectJobInput } from "./create";
import { mutateOpenJob, type MutateOpenJobInput } from "./mutate";

function setup() {
  const jobs = new InMemoryProjectJobStore();
  let tick = 0;
  const writer = createInMemoryProjectJobWriter(new InMemoryClientMemoryStore(), jobs,
    () => new Date(Date.UTC(2026, 8, 29, 12, 0, tick++)).toISOString());
  const input: CreateProjectJobInput = { mutationId: randomUUID(), projectId: null,
    kind: "required_action", subject: "Prepare founder plan", detail: "First draft",
    waitingOnActor: "founder", actor: "founder", sourceSystem: "continuum", sourceRef: "capture:one" };
  return { jobs, writer, input };
}

it("binds a create ID to all caller fields before subject deduplication", async () => {
  const { jobs, writer, input } = setup();
  const first = await writer.createJob(input);
  assert.ok(first.ok);
  const retry = await writer.createJob(input);
  assert.ok(retry.ok);
  assert.equal(retry.status, "already-present");
  assert.deepEqual(retry.job, first.job);
  const patches: Partial<CreateProjectJobInput>[] = [
    { subject: "Different plan" }, { detail: "Different draft" }, { detail: null },
    { projectId: randomUUID() }, { associatedPersonId: randomUUID() },
    { actor: "another-founder" }, { dueAt: "2026-10-01T12:00:00.000Z" },
    { kind: "commitment" }, { waitingOnActor: "vendor" },
    { sourceSystem: "concierge-manual" }, { sourceRef: "capture:two" },
  ];
  for (const patch of patches) {
    const result = await writer.createJob({ ...input, ...patch });
    assert.deepEqual(result, { ok: false, reason: "invalid-input", code: "idempotency-conflict" }, JSON.stringify(patch));
    assert.deepEqual(jobs.getJob(first.job.jobId), first.job);
    assert.equal(jobs.listMutations().length, 1);
  }
});

for (const action of ["update", "resolve", "cancel", "snooze", "unsnooze"] as const) {
  it(`binds ${action} retries to the original operation even after subsequent changes`, async () => {
    const { jobs, writer, input } = setup();
    const first = await writer.createJob(input);
    assert.ok(first.ok);
    if (action === "unsnooze") {
      assert.ok((await writer.mutateJob({ mutationId: randomUUID(), jobId: first.job.jobId,
        actor: "founder", action: "snooze", deferredUntil: "2026-10-01T12:00:00.000Z" })).ok);
    }
    const mutation: MutateOpenJobInput = { mutationId: randomUUID(), jobId: first.job.jobId,
      action, actor: "founder", ...(action === "update" ? { detail: "Revised" } : {}),
      ...(action === "snooze" ? { deferredUntil: "2026-10-01T12:00:00.000Z" } : {}) };
    const applied = await writer.mutateJob(mutation);
    assert.ok(applied.ok);
    assert.equal((await writer.mutateJob(mutation)).ok, true);
    const count = jobs.listMutations().length;
    for (const patch of [
      { action: action === "cancel" ? "resolve" : "cancel" },
      { detail: "Changed payload" }, { subject: "Changed subject" },
      { deferredUntil: "2026-10-02T12:00:00.000Z" },
      { dueAt: "2026-10-03T12:00:00.000Z" }, { actor: "other" },
      { associatedPersonId: randomUUID() }, { jobId: randomUUID() }, { projectId: randomUUID() },
      { clearDueAt: true }, { clearAssociatedPerson: true },
    ]) {
      assert.deepEqual(await writer.mutateJob({ ...mutation, ...patch }),
        { ok: false, reason: "invalid-input", code: "idempotency-conflict" });
      assert.deepEqual(jobs.getJob(first.job.jobId), applied.job);
      assert.equal(jobs.listMutations().length, count);
    }
    // Create retries compare the immutable request, not the now-mutated Job.
    assert.equal((await writer.createJob(input)).ok, true);
    if (action === "update") {
      assert.ok((await writer.mutateJob({ ...mutation, mutationId: randomUUID(), detail: "Later edit" })).ok);
      const latest = jobs.getJob(first.job.jobId);
      assert.equal((await writer.mutateJob(mutation)).ok, true);
      assert.deepEqual(jobs.getJob(first.job.jobId), latest);
      assert.equal(jobs.listMutations().length, count + 1);
    }
  });
}

it("concurrent application creates recover the winning server allocated identity", async () => {
  const { jobs, writer, input } = setup();
  const results = await Promise.all([writer.createJob(input), writer.createJob(input)]);
  assert.ok(results.every(row => row.ok));
  assert.equal(jobs.listJobs().length, 1);
  assert.equal(jobs.listMutations().length, 1);
  const conflictInput = { ...input, mutationId: randomUUID(), subject: "Another task" };
  const conflicts = await Promise.all([writer.createJob(conflictInput), writer.createJob({ ...conflictInput, detail: "Conflicting" })]);
  assert.equal(conflicts.filter(row => row.ok).length, 1);
  assert.equal(jobs.listJobs().length, 2);
  assert.equal(jobs.listMutations().length, 2);
});


it("recovers a retry when the winner commits between history and canonical reads", async () => {
  const { writer, input } = setup();
  const created = await writer.createJob(input);
  assert.ok(created.ok);
  const request: MutateOpenJobInput = { mutationId: randomUUID(), jobId: created.job.jobId, action: "unsnooze", actor: "founder" };
  // The winner has already changed snoozed -> open by the canonical read.
  // Reapplying unsnooze to that post-state would incorrectly reject this retry.
  let historyReads = 0;
  const never = async (): Promise<never> => { throw new Error("must recover persisted operation"); };
  const result = await mutateOpenJob({
    nowIso: () => created.job.updatedAt,
    findAppliedOperation: async () => ++historyReads === 1 ? null : { request: { ...request, operation: "mutate" }, job: created.job },
    getJob: async () => created.job,
    getEntity: never, getProjectProfile: never, getPersonProfile: never,
    hasActiveClientProjectRelationship: never, applyMutation: never,
  }, request);
  assert.ok(result.ok);
  assert.equal(result.status, "already-present");
  assert.equal(historyReads, 2);
});
