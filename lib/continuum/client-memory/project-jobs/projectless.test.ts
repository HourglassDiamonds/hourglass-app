import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { InMemoryProjectJobStore } from "./store";
import { createInMemoryProjectJobWriter } from "./writer";
import { rowToProjectJob } from "./rows";
import { projectJobToRow } from "./write-row";
import { loadProjectJobs } from "./load";
import { openJobsReadModel } from "./read";
import { collectCanonicalActionables } from "../../chief-of-staff/operating-loop/collect";
import { presentTop5Item } from "../../chief-of-staff/operating-loop/present";
import { completeFounderActionable } from "../../chief-of-staff/operating-loop/complete";

import { disposeDocketItem } from "../../chief-of-staff/operating-loop/disposition";

const NOW = "2026-09-29T12:00:00.000Z";
function setup() {
  const memory = new InMemoryClientMemoryStore();
  const jobs = new InMemoryProjectJobStore();
  return { memory, jobs, writer: createInMemoryProjectJobWriter(memory, jobs, () => NOW) };
}
const input = () => ({ mutationId: randomUUID(), projectId: null, kind: "required_action", subject: "Prepare founder plan", waitingOnActor: "founder", actor: "founder" });

it("round trips projectless jobs, isolates explicit null reads, and preserves mutation history on retry", async () => {
  const { jobs, writer } = setup();
  const create = input();
  const result = await writer.createJob(create);
  assert.ok(result.ok);
  assert.deepEqual(rowToProjectJob(projectJobToRow(result.job)), result.job);
  assert.equal((await writer.getJob(null, result.job.jobId))?.projectId, null);
  const projectId = randomUUID();
  jobs.insertJob({ ...result.job, jobId: randomUUID(), projectId, createdMutationId: randomUUID() });
  assert.equal(jobs.listJobs().length, 2);
  assert.equal(jobs.listJobs(null).length, 1);
  assert.equal(jobs.listJobs(projectId).length, 1);
  const desk = openJobsReadModel(jobs.listJobs(), projectId, []);
  assert.ok(desk.connected);
  assert.equal(desk.unresolvedCount, 1);
  assert.equal((await writer.createJob(create)).ok, true);
  assert.equal(jobs.listMutations(result.job.jobId).length, 1);
  assert.equal(jobs.listMutations(result.job.jobId)[0].projectId, null);

  const calls: unknown[][] = [];
  const query = {
    select() { return this; },
    is(...args: unknown[]) { calls.push(["is", ...args]); return this; },
    eq(...args: unknown[]) { calls.push(["eq", ...args]); return this; },
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [projectJobToRow(result.job)], error: null }).then(resolve); },
  };
  const client = { from() { return query; } };
  assert.equal((await loadProjectJobs(client as never, null))?.[0].projectId, null);
  assert.deepEqual(calls.pop(), ["is", "project_id", null]);
  await loadProjectJobs(client as never, projectId);
  assert.deepEqual(calls.pop(), ["eq", "project_id", projectId]);
  await loadProjectJobs(client as never);
  assert.equal(calls.length, 0);
});

for (const action of ["resolve", "cancel", "snooze", "update"] as const) {
  it(`supports projectless ${action}, identity-only routing, and idempotent history`, async () => {
    const { writer, jobs } = setup();
    const created = await writer.createJob(input());
    assert.ok(created.ok);
    const mutation = { mutationId: randomUUID(), jobId: created.job.jobId, action, actor: "founder", deferredUntil: "2026-10-01T12:00:00.000Z", subject: "Updated plan" };
    const result = await writer.mutateJob(mutation);
    assert.ok(result.ok);
    assert.equal(result.job.projectId, null);
    assert.equal(result.job.state, action === "resolve" ? "resolved" : action === "cancel" ? "cancelled" : action === "snooze" ? "snoozed" : "open");
    const retry = await writer.mutateJob(mutation);
    assert.ok(retry.ok);
    assert.equal(retry.status, "already-present");
    assert.equal(jobs.listMutations(created.job.jobId).length, 2);
    if (action === "snooze") {
      const unsnooze = await writer.mutateJob({ ...mutation, mutationId: randomUUID(), projectId: null, action: "unsnooze" });
      assert.ok(unsnooze.ok);
      assert.equal(unsnooze.job.state, "open");
      assert.equal(unsnooze.job.deferredUntil, null);
      assert.equal(jobs.listMutations(created.job.jobId).length, 3);
    }
    const wrongProject = await writer.mutateJob({ ...mutation, mutationId: randomUUID(), projectId: randomUUID() });
    assert.equal(wrongProject.ok, false);
  });
}

it("validates Person independently and does not accept blank Project IDs as projectless", async () => {
  const { writer } = setup();
  assert.equal((await writer.createJob({ ...input(), associatedPersonId: randomUUID() })).ok, false);
  assert.equal((await writer.createJob({ ...input(), projectId: "" })).ok, false);
  assert.equal((await writer.createJob({ ...input(), actor: "" })).ok, false);
});

it("presents neutral founder work without Project links and completes by job identity", async () => {
  const { writer, jobs } = setup();
  const created = await writer.createJob(input());
  assert.ok(created.ok);
  const [work] = collectCanonicalActionables({ jobs: jobs.listJobs(), projects: new Map(), nowIso: NOW });
  assert.equal(work.projectTitle, "Founder work");
  const view = presentTop5Item({ ...work, score: 0, factors: [], rankingModelId: "test" }, NOW, randomUUID());
  assert.equal(view.projectId, null);
  assert.equal(view.accordionHref, null);
  assert.equal(view.jobHref, null);
  assert.equal(view.editHref, null);
  assert.equal((await completeFounderActionable(writer, { sourceType: "open_job", jobId: created.job.jobId, mutationId: randomUUID(), actor: "founder" })).ok, true);
});

for (const verb of ["complete", "snooze", "dismiss"] as const) {
  it(`routes Today ${verb} for a projectless Job without Project context`, async () => {
    const { writer, jobs } = setup();
    const created = await writer.createJob(input());
    assert.ok(created.ok);
    const result = await disposeDocketItem({ jobs: writer, nowIso: () => NOW }, {
      verb, origin: "open_job", itemId: created.job.jobId, projectId: null,
      jobId: created.job.jobId, candidateIds: [], mutationId: randomUUID(), actor: "founder",
      snoozeUntil: "2026-10-01T12:00:00.000Z",
    });
    assert.ok(result.ok);
    assert.equal(jobs.getJob(created.job.jobId)?.state, verb === "complete" ? "resolved" : verb === "snooze" ? "snoozed" : "cancelled");
  });
}
