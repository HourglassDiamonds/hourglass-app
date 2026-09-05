import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { unresolvedJobsForProject } from "./read";
import { InMemoryProjectJobStore } from "./store";
import { createInMemoryProjectJobWriter } from "./writer";
import type { ProjectKind } from "../project-kind";

const NOW = "2026-09-05T16:00:00.000Z";
const LATER = "2026-09-06T16:00:00.000Z";
const ACTOR = "justin";

async function seedProject(
  store: InMemoryClientMemoryStore,
  extra: {
    title?: string;
    linkPerson?: boolean;
    personId?: string;
    personName?: string;
    kind?: ProjectKind | null;
  } = {},
) {
  const person = extra.personId
    ? { record: { id: extra.personId } }
    : await store.insertEntity({
        kind: "person",
        createdAt: NOW,
        createdBy: "test",
      });
  if (!extra.personId) {
    await store.insertPersonProfile({
      personId: person.record.id,
      displayName: extra.personName ?? "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      organizationName: null,
      email: null,
      phone: null,
      streetAddress: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
      roles: ["client"],
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: extra.title ?? "Oval ring",
    visibility: "internal-only",
    importRowKey: `continuum-jobs-11:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: extra.kind ?? null,
  });
  if (extra.linkPerson !== false) {
    await store.insertRelationship({
      id: randomUUID(),
      fromEntityId: person.record.id,
      toEntityId: project.record.id,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
  }
  return { personId: person.record.id, projectId: project.record.id };
}

describe("Open Job founder controls", () => {
  it("adds, resolves, cancels, snoozes, and reactivates without deleting history", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
    const seeded = await seedProject(memory);
    const created = await writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "commitment",
      subject: "Send wax quote",
      waitingOnActor: "hourglass",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const jobId = created.job.jobId;

    const resolved = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      jobId,
      action: "resolve",
      actor: ACTOR,
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.job.state, "resolved");
    assert.equal(resolved.job.resolvedAt, NOW);
    assert.equal(jobs.getJob(jobId)?.state, "resolved");
    assert.equal(unresolvedJobsForProject(jobs.listJobs(), seeded.projectId)?.length, 0);

    const afterResolve = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      jobId,
      action: "cancel",
      actor: ACTOR,
    });
    assert.equal(afterResolve.ok, false);
    if (afterResolve.ok) return;
    assert.equal(afterResolve.code, "invalid-state");
    assert.equal(jobs.getJob(jobId)?.state, "resolved");

    const second = await writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "request",
      subject: "Confirm finger size",
      waitingOnActor: "client",
      actor: ACTOR,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const snoozed = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      jobId: second.job.jobId,
      action: "snooze",
      actor: ACTOR,
      deferredUntil: "2026-09-20T00:00:00.000Z",
    });
    assert.equal(snoozed.ok, true);
    if (!snoozed.ok) return;
    assert.equal(snoozed.job.state, "snoozed");
    assert.equal(snoozed.job.resolvedAt, null);
    assert.equal(
      unresolvedJobsForProject(jobs.listJobs(), seeded.projectId)?.length,
      1,
    );

    const laterWriter = createInMemoryProjectJobWriter(memory, jobs, () => LATER);
    const unsnoozed = await laterWriter.mutateJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      jobId: second.job.jobId,
      action: "unsnooze",
      actor: ACTOR,
    });
    assert.equal(unsnoozed.ok, true);
    if (!unsnoozed.ok) return;
    assert.equal(unsnoozed.job.state, "open");
    assert.equal(unsnoozed.job.deferredUntil, null);

    const cancelled = await laterWriter.mutateJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      jobId: second.job.jobId,
      action: "cancel",
      actor: ACTOR,
    });
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) return;
    assert.equal(cancelled.job.state, "cancelled");
    assert.equal(cancelled.job.cancelledAt, LATER);
    assert.equal(cancelled.job.resolvedAt, null);
    assert.equal(jobs.listJobs(seeded.projectId).length, 2);
    assert.equal(unresolvedJobsForProject(jobs.listJobs(), seeded.projectId)?.length, 0);
    assert.equal(jobs.listMutations(jobId).length >= 2, true);
  });

  it("changes actor and known Person only inside the Project", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
    const first = await seedProject(memory, { personName: "Ada" });
    const other = await seedProject(memory, { personName: "Travis", title: "Band" });
    const created = await writer.createJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      kind: "question",
      subject: "Need stone update",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const updated = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      jobId: created.job.jobId,
      action: "update",
      actor: ACTOR,
      waitingOnActor: "client",
      associatedPersonId: first.personId,
      subject: "Need stone update",
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.job.waitingOnActor, "client");
    assert.equal(updated.job.associatedPersonId, first.personId);

    const bleed = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      jobId: created.job.jobId,
      action: "update",
      actor: ACTOR,
      associatedPersonId: other.personId,
      subject: "Need stone update",
    });
    assert.equal(bleed.ok, false);
    if (bleed.ok) return;
    assert.equal(bleed.code, "person-not-on-project");
    assert.equal(jobs.getJob(created.job.jobId)?.associatedPersonId, first.personId);

    const freeText = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      jobId: created.job.jobId,
      action: "update",
      actor: ACTOR,
      waitingOnActor: "Ada Lovelace",
      subject: "Need stone update",
    });
    assert.equal(freeText.ok, false);
    if (freeText.ok) return;
    assert.equal(freeText.code, "invalid-actor");
  });

  it("rejects wrong-project mutation, invalid actions, and does not infer from notes", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
    const first = await seedProject(memory, { title: "Oval ring" });
    const second = await seedProject(memory, {
      title: "Band",
      personId: first.personId,
    });
    const created = await writer.createJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      kind: "blocked_issue",
      subject: "Caster waiting on metal",
      waitingOnActor: "vendor",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const wrongProject = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: second.projectId,
      jobId: created.job.jobId,
      action: "resolve",
      actor: ACTOR,
    });
    assert.equal(wrongProject.ok, false);
    if (wrongProject.ok) return;
    assert.equal(wrongProject.code, "wrong-project");
    assert.equal(jobs.getJob(created.job.jobId)?.state, "open");
    assert.equal(jobs.listJobs(second.projectId).length, 0);

    const invalidAction = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      jobId: created.job.jobId,
      action: "complete",
      actor: ACTOR,
    });
    assert.equal(invalidAction.ok, false);
    if (invalidAction.ok) return;
    assert.equal(invalidAction.code, "invalid-action");

    const unsnoozeOpen = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      jobId: created.job.jobId,
      action: "unsnooze",
      actor: ACTOR,
    });
    assert.equal(unsnoozeOpen.ok, false);
    if (unsnoozeOpen.ok) return;
    assert.equal(unsnoozeOpen.code, "invalid-state");

    const snoozeBlank = await writer.mutateJob({
      mutationId: randomUUID(),
      projectId: first.projectId,
      jobId: created.job.jobId,
      action: "snooze",
      actor: ACTOR,
    });
    assert.equal(snoozeBlank.ok, false);
    if (snoozeBlank.ok) return;
    assert.equal(snoozeBlank.code, "invalid-defer");

    await memory.insertSourceNote({
      id: randomUUID(),
      personId: first.personId,
      projectId: first.projectId,
      contextLayer: "client",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: "note",
      sourceSheet: "Notes",
      sourceField: "Notes",
      importRowKey: "row",
      gmailThreadId: null,
      noteText: "Please also send CAD.",
      createdAt: NOW,
      lifecycleStatus: "absorbed",
      updatedAt: NOW,
      updatedBy: null,
      deletedAt: null,
      previousLifecycle: null,
    });
    assert.equal(jobs.listJobs(first.projectId).length, 1);
    assert.equal(jobs.getJob(created.job.jobId)?.kind, "blocked_issue");
  });

  it("is idempotent on mutation id and keeps create history", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
    const seeded = await seedProject(memory);
    const created = await writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "approval",
      subject: "Approve render 2",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const mutationId = randomUUID();
    const first = await writer.mutateJob({
      mutationId,
      projectId: seeded.projectId,
      jobId: created.job.jobId,
      action: "resolve",
      actor: ACTOR,
    });
    const second = await writer.mutateJob({
      mutationId,
      projectId: seeded.projectId,
      jobId: created.job.jobId,
      action: "cancel",
      actor: ACTOR,
    });
    assert.equal(first.ok && first.status, "updated");
    assert.equal(second.ok && second.status, "already-present");
    if (!second.ok) return;
    assert.equal(second.job.state, "resolved");
    assert.equal(jobs.listMutations(created.job.jobId).map((row) => row.action).join(","), "create,resolve");
  });
});
