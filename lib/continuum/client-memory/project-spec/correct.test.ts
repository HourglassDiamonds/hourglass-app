import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { createInMemoryClientMemoryProjectSpecWriter } from "./writer";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { currentSpecValue } from "./types";
import { mergeImportedProjectHistory } from "./import-guard";
import { composePersonCockpit } from "../read/cockpit";
import { getProjectDeskFromSnapshot } from "../project-desk/compose";
import type { ProjectDeskSnapshot } from "../project-desk/types";
import { emptyReadSnapshot } from "../read/fixtures";

const NOW = "2026-08-27T12:00:00.000Z";
const ACTOR = "justin";

async function seedProject(
  store: InMemoryClientMemoryStore,
  extra: {
    title?: string;
    fingerSize?: string | null;
    orderNumber?: string | null;
  } = {},
) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "A. Achedekal",
    givenName: "A.",
    familyName: "Achedekal",
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
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: extra.title ?? "Achedekal ring",
    visibility: "internal-only",
    importRowKey:
      extra.title === "Project B"
        ? "continuum-reconciliation-v3:ReconciledProjects:achedekal-b"
        : extra.title === "Project A"
          ? "continuum-reconciliation-v3:ReconciledProjects:achedekal-a"
          : `continuum-reconciliation-v3:ReconciledProjects:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
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
  await store.insertProjectHistory({
    projectId: project.record.id,
    cadJobNumber: "CAD-1",
    orderNumber: extra.orderNumber ?? "140",
    gmailThreadId: null,
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: extra.fingerSize ?? "141",
    metal: "platinum",
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { personId: person.record.id, projectId: project.record.id };
}

describe("project spec correction", () => {
  it("replaces current finger size and keeps 141 in revision history", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    const mutationId = randomUUID();
    const result = await writer.correctProjectSpec({
      mutationId,
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "updated");
    const history = await store.getProjectHistory(projectId);
    assert.equal(history?.fingerSize, "6.5");
    assert.equal(history?.orderNumber, "140");
    const revisions = store.listProjectHistoryRevisions(projectId);
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0]?.priorValue, "141");
    assert.equal(revisions[0]?.newValue, "6.5");
    assert.equal(revisions[0]?.fieldName, "finger_size");
    assert.equal(revisions[0]?.changedBy, ACTOR);
    assert.deepEqual(history?.founderCorrectedFields, ["finger_size"]);
  });

  it("corrects order number as an identifier and leaves finger size untouched", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store, {
      fingerSize: "6.5",
      orderNumber: "140",
    });
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "order_number",
      newValue: "140-A",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    const history = await store.getProjectHistory(projectId);
    assert.equal(history?.orderNumber, "140-A");
    assert.equal(history?.fingerSize, "6.5");
    assert.equal(store.listProjectHistoryRevisions(projectId)[0]?.priorValue, "140");
  });

  it("records two successive corrections in order", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    const first = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    const second = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.75",
      actor: ACTOR,
    });
    assert.equal(first.ok && second.ok, true);
    const history = await store.getProjectHistory(projectId);
    assert.equal(history?.fingerSize, "6.75");
    const revisions = store.listProjectHistoryRevisions(projectId);
    assert.equal(revisions.length, 2);
    assert.equal(
      revisions.some((row) => row.priorValue === "141" && row.newValue === "6.5"),
      true,
    );
    assert.equal(
      revisions.some((row) => row.priorValue === "6.5" && row.newValue === "6.75"),
      true,
    );
  });

  it("retries the same mutation_id without duplicating revisions", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    const mutationId = randomUUID();
    const first = await writer.correctProjectSpec({
      mutationId,
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    const retry = await writer.correctProjectSpec({
      mutationId,
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.status, "already-present");
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 1);
    assert.equal((await store.getProjectHistory(projectId))?.fingerSize, "6.5");
  });

  it("does not create junk revisions for same-value corrections", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store, { fingerSize: "6.5" });
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "already-present");
    assert.equal(result.revisionId, null);
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 0);
  });

  it("fails closed when a Person UUID is supplied as the project", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { personId } = await seedProject(store);
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId: personId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "entity-kind-mismatch");
    assert.equal(store.listProjectHistoryRevisions().length, 0);
  });

  it("fails closed for an unknown project", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId: randomUUID(),
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "project-not-found");
  });

  it("rejects an invalid editable field without writing", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "gmail_thread_id",
      newValue: "secret",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "invalid-field");
    assert.equal((await store.getProjectHistory(projectId))?.gmailThreadId, null);
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 0);
  });

  it("rejects 141 submitted as a new finger size", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store, { fingerSize: "6.5" });
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "141",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "implausible-finger-size");
    assert.equal((await store.getProjectHistory(projectId))?.fingerSize, "6.5");
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 0);
  });

  it("allows an unusual but plausible large ring size", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "20",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    assert.equal((await store.getProjectHistory(projectId))?.fingerSize, "20");
  });

  it("does not alter another project's snapshot", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const a = await seedProject(store, { title: "Project A" });
    const b = await seedProject(store, {
      title: "Project B",
      fingerSize: "7",
      orderNumber: "200",
    });
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId: a.projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    assert.equal((await store.getProjectHistory(a.projectId))?.fingerSize, "6.5");
    assert.equal((await store.getProjectHistory(b.projectId))?.fingerSize, "7");
    assert.equal((await store.getProjectHistory(b.projectId))?.orderNumber, "200");
    assert.equal(store.listProjectHistoryRevisions(b.projectId).length, 0);
  });

  it("rolls back when the current snapshot update fails after a revision insert", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    store.failNextProjectSpecMutationAfter = "update";
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    assert.equal((await store.getProjectHistory(projectId))?.fingerSize, "141");
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 0);
  });

  it("rolls back when the revision write fails", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    store.failNextProjectSpecMutationAfter = "revision";
    const result = await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    assert.equal((await store.getProjectHistory(projectId))?.fingerSize, "141");
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 0);
  });

  it("protects founder-corrected finger size from stale import replay", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    const current = await store.getProjectHistory(projectId);
    assert.ok(current);
    const incoming = {
      ...current!,
      fingerSize: "141",
      orderNumber: "140",
      metal: "gold",
    };
    const merged = mergeImportedProjectHistory(current!, incoming);
    assert.equal(merged.fingerSize, "6.5");
    assert.equal(merged.orderNumber, "140");
    assert.equal(merged.metal, "gold");
    const replay = await store.applyImportedProjectHistory(incoming);
    assert.equal(replay.record.fingerSize, "6.5");
    assert.equal(replay.record.orderNumber, "140");
    assert.equal((await store.getProjectHistory(projectId))?.fingerSize, "6.5");
    assert.equal(currentSpecValue(replay.record, "finger_size"), "6.5");
  });

  it("feeds the same corrected snapshot to Project Desk and Person cockpit", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { personId, projectId } = await seedProject(store);
    await writer.correctProjectSpec({
      mutationId: randomUUID(),
      projectId,
      fieldName: "finger_size",
      newValue: "6.5",
      actor: ACTOR,
    });
    const history = await store.getProjectHistory(projectId);
    const profile = await store.getProjectProfile(projectId);
    assert.ok(history && profile);
    const snapshot: ProjectDeskSnapshot = {
      projectProfiles: [profile],
      projectHistories: [history],
      specRevisions: store.listProjectHistoryRevisions(projectId),
      relationships: [
        {
          id: randomUUID(),
          fromEntityId: personId,
          toEntityId: projectId,
          kind: "client-project",
          status: "active",
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          createdBy: "test",
        },
      ],
      people: [{ personId, displayName: "A. Achedekal" }],
      sourceNotes: [],
    };
    const desk = getProjectDeskFromSnapshot(snapshot, projectId);
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(
      desk.desk.specs.find((row) => row.fieldName === "finger_size")?.value,
      "6.5",
    );
    assert.equal(
      desk.desk.specs.find((row) => row.fieldName === "order_number")?.value,
      "140",
    );
    assert.equal(desk.desk.specCorrections.length, 1);
    assert.equal(desk.desk.specCorrections[0]?.priorValue, "141");

    const cockpit = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [
          {
            personId,
            displayName: "A. Achedekal",
            givenName: "A.",
            familyName: "Achedekal",
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
          },
        ],
        projectProfiles: [profile],
        projectHistories: [history],
        relationships: snapshot.relationships,
      },
      personId,
    );
    assert.equal(cockpit.ok, true);
    if (!cockpit.ok) return;
    assert.equal(cockpit.cockpit.projects[0]?.internalHistory?.fingerSize, "6.5");
    assert.equal(cockpit.cockpit.projects[0]?.internalHistory?.orderNumber, "140");
  });
});
