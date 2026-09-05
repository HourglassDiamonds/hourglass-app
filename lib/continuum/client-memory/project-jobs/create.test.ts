import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { createProjectJob, type CreateProjectJobDeps } from "./create";
import { InMemoryProjectJobStore } from "./store";
import { OPEN_JOB_KINDS } from "./types";
import type { ProjectKind } from "../project-kind";

const NOW = "2026-09-05T16:00:00.000Z";
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
    importRowKey: `continuum-jobs-10:${randomUUID()}`,
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

function deps(
  store: InMemoryClientMemoryStore,
  jobs: InMemoryProjectJobStore,
): CreateProjectJobDeps {
  return {
    nowIso: () => NOW,
    newJobId: () => randomUUID(),
    getEntity: (id) => store.getEntity(id),
    getProjectProfile: (projectId) => store.getProjectProfile(projectId),
    getPersonProfile: (personId) => store.getPersonProfile(personId),
    hasActiveClientProjectRelationship: (projectId, personId) =>
      store.hasActiveClientProjectLink(personId, projectId),
    applyCreate: (input) => Promise.resolve(jobs.insertJob(input)),
  };
}

describe("Open Job create primitive", () => {
  it("accepts every bounded kind and stores canonical open state", async () => {
    const store = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const seeded = await seedProject(store);
    for (const kind of OPEN_JOB_KINDS) {
      const result = await createProjectJob(deps(store, jobs), {
        mutationId: randomUUID(),
        projectId: seeded.projectId,
        kind,
        subject: `${kind} work`,
        waitingOnActor: "founder",
        actor: ACTOR,
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.job.kind, kind);
      assert.equal(result.job.state, "open");
      assert.equal(result.job.resolvedAt, null);
      assert.equal(result.job.sourceSystem, "concierge-manual");
    }
    assert.equal(jobs.listJobs(seeded.projectId).length, OPEN_JOB_KINDS.length);
  });

  it("rejects invalid kind, actor, subject, and gmail body provenance", async () => {
    const store = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const seeded = await seedProject(store);
    const base = {
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "request",
      subject: "Need revised CAD",
      waitingOnActor: "founder",
      actor: ACTOR,
    };
    const invalidKind = await createProjectJob(deps(store, jobs), {
      ...base,
      mutationId: randomUUID(),
      kind: "todo",
    });
    assert.equal(invalidKind.ok, false);
    if (invalidKind.ok) return;
    assert.equal(invalidKind.code, "invalid-kind");
    const invalidActor = await createProjectJob(deps(store, jobs), {
      ...base,
      mutationId: randomUUID(),
      waitingOnActor: "Ada Lovelace",
    });
    assert.equal(invalidActor.ok, false);
    if (invalidActor.ok) return;
    assert.equal(invalidActor.code, "invalid-actor");
    const blank = await createProjectJob(deps(store, jobs), {
      ...base,
      mutationId: randomUUID(),
      subject: "   ",
    });
    assert.equal(blank.ok, false);
    const gmailBody = await createProjectJob(deps(store, jobs), {
      ...base,
      mutationId: randomUUID(),
      sourceSystem: "gmail",
      sourceRef: "From: ada@example.com\n\nPlease send Render 2.",
    });
    assert.equal(gmailBody.ok, false);
    if (gmailBody.ok) return;
    assert.equal(gmailBody.code, "invalid-source");
    assert.equal(jobs.listJobs().length, 0);
  });

  it("keeps jobs inside the requested Project and rejects a Person id", async () => {
    const store = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const first = await seedProject(store, { title: "Oval ring" });
    const second = await seedProject(store, {
      title: "Oval ring",
      personId: first.personId,
    });
    const created = await createProjectJob(deps(store, jobs), {
      mutationId: randomUUID(),
      projectId: first.projectId,
      kind: "commitment",
      subject: "Quote the wax",
      waitingOnActor: "hourglass",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    const other = jobs.listJobs(second.projectId);
    assert.equal(other.length, 0);
    const asPerson = await createProjectJob(deps(store, jobs), {
      mutationId: randomUUID(),
      projectId: first.personId,
      kind: "request",
      subject: "Should not exist",
      waitingOnActor: "client",
      actor: ACTOR,
    });
    assert.equal(asPerson.ok, false);
    if (asPerson.ok) return;
    assert.equal(asPerson.reason, "entity-kind-mismatch");
  });

  it("allows a known linked Person and rejects a Person from another Project", async () => {
    const store = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const first = await seedProject(store, { personName: "Ada" });
    const other = await seedProject(store, { personName: "Travis", title: "Band" });
    const linked = await createProjectJob(deps(store, jobs), {
      mutationId: randomUUID(),
      projectId: first.projectId,
      kind: "question",
      subject: "Confirm finger size",
      waitingOnActor: "client",
      associatedPersonId: first.personId,
      actor: ACTOR,
    });
    assert.equal(linked.ok, true);
    if (!linked.ok) return;
    assert.equal(linked.job.associatedPersonId, first.personId);
    const bleed = await createProjectJob(deps(store, jobs), {
      mutationId: randomUUID(),
      projectId: first.projectId,
      kind: "question",
      subject: "Wrong household",
      waitingOnActor: "client",
      associatedPersonId: other.personId,
      actor: ACTOR,
    });
    assert.equal(bleed.ok, false);
    if (bleed.ok) return;
    assert.equal(bleed.code, "person-not-on-project");
  });

  it("is idempotent on created_mutation_id and does not infer from notes", async () => {
    const store = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const seeded = await seedProject(store);
    await store.insertSourceNote({
      id: randomUUID(),
      personId: seeded.personId,
      projectId: seeded.projectId,
      contextLayer: "client",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: "note",
      sourceSheet: "Notes",
      sourceField: "Notes",
      importRowKey: "row",
      gmailThreadId: null,
      noteText: "Justin promised a quote while walking.",
      createdAt: NOW,
      lifecycleStatus: "absorbed",
      updatedAt: NOW,
      updatedBy: null,
      deletedAt: null,
      previousLifecycle: null,
    });
    const mutationId = randomUUID();
    const first = await createProjectJob(deps(store, jobs), {
      mutationId,
      projectId: seeded.projectId,
      kind: "commitment",
      subject: "Send quote",
      waitingOnActor: "hourglass",
      actor: ACTOR,
      dueAt: "2026-09-12T16:00:00.000Z",
    });
    const second = await createProjectJob(deps(store, jobs), {
      mutationId,
      projectId: seeded.projectId,
      kind: "commitment",
      subject: "Send quote",
      waitingOnActor: "hourglass",
      actor: ACTOR,
    });
    assert.equal(first.ok && first.status, "created");
    assert.equal(second.ok && second.status, "already-present");
    assert.equal(jobs.listJobs().length, 1);
  });
});
