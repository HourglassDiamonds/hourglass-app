import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { createInMemoryClientMemoryProjectSpecWriter } from "./writer";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { composePersonProjectBooks } from "../project-books/compose";
import { getProjectDeskFromSnapshot } from "../project-desk/compose";
import { emptyReadSnapshot } from "../read/fixtures";

const NOW = "2026-08-31T12:00:00.000Z";
const ACTOR = "justin";
const ROOT = resolve(process.cwd());

async function seedProject(
  store: InMemoryClientMemoryStore,
  extra: {
    title?: string;
    linkPerson?: boolean;
    fingerSize?: string | null;
    orderNumber?: string | null;
    metal?: string | null;
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
    displayName: extra.title ?? "A. Achedekal",
    givenName: "A.",
    familyName: extra.title ?? "Achedekal",
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
    importRowKey: `continuum-reconciliation-v3:ReconciledProjects:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
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
  await store.insertProjectHistory({
    projectId: project.record.id,
    cadJobNumber: "CAD-1",
    orderNumber: extra.orderNumber ?? "140",
    gmailThreadId: null,
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: extra.fingerSize ?? "6.5",
    metal: extra.metal ?? "platinum",
    centerStone: "oval",
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { personId: person.record.id, projectId: project.record.id };
}

describe("project kind correction", () => {
  it("A/C. accepts a canonical kind and leaves unset as null", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    const before = await store.getProjectProfile(projectId);
    assert.equal(before?.projectKind ?? null, null);
    const result = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId,
      newValue: "custom_new_jewelry",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.projectKind, "custom_new_jewelry");
    const profile = await store.getProjectProfile(projectId);
    assert.equal(profile?.projectKind, "custom_new_jewelry");
  });

  it("B. rejects invalid kind values", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    for (const value of ["ring", "repair", "custom", "SP13040", "C010657", "unknown"]) {
      const result = await writer.correctProjectKind({
        mutationId: randomUUID(),
        projectId,
        newValue: value,
        actor: ACTOR,
      });
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.reason, "invalid-input");
      assert.equal(result.code, "invalid-value");
    }
    const profile = await store.getProjectProfile(projectId);
    assert.equal(profile?.projectKind ?? null, null);
    assert.equal(store.listProjectHistoryRevisions(projectId).length, 0);
  });

  it("D/O. setting Kind changes only the targeted Project", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const a = await seedProject(store, { title: "STUART" });
    const b = await seedProject(store, { title: "MR-STUART" });
    const result = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: a.projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    const target = await store.getProjectProfile(a.projectId);
    const sibling = await store.getProjectProfile(b.projectId);
    const historyA = await store.getProjectHistory(a.projectId);
    const historyB = await store.getProjectHistory(b.projectId);
    assert.equal(target?.projectKind, "repair_service");
    assert.equal(sibling?.projectKind ?? null, null);
    assert.equal(historyA?.fingerSize, "6.5");
    assert.equal(historyB?.fingerSize, "6.5");
    assert.equal(store.listProjectHistoryRevisions(b.projectId).length, 0);
  });

  it("E. clearing Kind restores Not set and keeps an audit trail", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const { projectId } = await seedProject(store);
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    const cleared = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId,
      newValue: "",
      actor: ACTOR,
    });
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.projectKind, null);
    const profile = await store.getProjectProfile(projectId);
    assert.equal(profile?.projectKind, null);
    const revisions = store.listProjectHistoryRevisions(projectId);
    assert.equal(revisions.length, 2);
    const clearedRev = revisions.find((row) => row.newValue == null);
    const setRev = revisions.find((row) => row.newValue === "repair_service");
    assert.equal(clearedRev?.fieldName, "project_kind");
    assert.equal(clearedRev?.priorValue, "repair_service");
    assert.equal(clearedRev?.changedBy, ACTOR);
    assert.equal(setRev?.priorValue, null);
  });

  it("F. STUART and MR-STUART keep independent kinds", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const stuart = await seedProject(store, { title: "STUART" });
    const mr = await seedProject(store, { title: "MR-STUART" });
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: stuart.projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: mr.projectId,
      newValue: "custom_new_jewelry",
      actor: ACTOR,
    });
    assert.equal((await store.getProjectProfile(stuart.projectId))?.projectKind, "repair_service");
    assert.equal(
      (await store.getProjectProfile(mr.projectId))?.projectKind,
      "custom_new_jewelry",
    );
  });

  it("G. same-title Jesse R. Projects stay independent", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const first = await seedProject(store, { title: "Jesse R.", orderNumber: "C024594" });
    const second = await seedProject(store, { title: "Jesse R.", orderNumber: "C025088" });
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: first.projectId,
      newValue: "consultation_opportunity",
      actor: ACTOR,
    });
    assert.equal(
      (await store.getProjectProfile(first.projectId))?.projectKind,
      "consultation_opportunity",
    );
    assert.equal((await store.getProjectProfile(second.projectId))?.projectKind ?? null, null);
    const historySecond = await store.getProjectHistory(second.projectId);
    assert.equal(historySecond?.orderNumber, "C025088");
  });

  it("H. unlinked Project can have Kind without a Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const unlinked = await seedProject(store, {
      title: "Kaleb H.",
      linkPerson: false,
    });
    const result = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: unlinked.projectId,
      newValue: "loose_stone_sourcing",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    const profile = await store.getProjectProfile(unlinked.projectId);
    assert.equal(profile?.projectKind, "loose_stone_sourcing");
    const relationships = store
      .listProjectHistoryRevisions(unlinked.projectId)
      .map((row) => row.projectId);
    assert.deepEqual(relationships, [unlinked.projectId]);
  });

  it("I/J/K. Person Project Books display canonical Kind, unset, and Other distinctly", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const person = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    await store.insertPersonProfile({
      personId: person.record.id,
      displayName: "Stuart Household",
      givenName: "Stuart",
      familyName: "Household",
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
    const stuart = await seedProject(store, { title: "STUART" });
    const other = await seedProject(store, { title: "Other book" });
    await store.insertRelationship({
      id: randomUUID(),
      fromEntityId: person.record.id,
      toEntityId: stuart.projectId,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    await store.insertRelationship({
      id: randomUUID(),
      fromEntityId: person.record.id,
      toEntityId: other.projectId,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: other.projectId,
      newValue: "other",
      actor: ACTOR,
    });
    const books = composePersonProjectBooks(
      {
        ...emptyReadSnapshot(),
        profiles: [
          {
            personId: person.record.id,
            displayName: "Stuart Household",
            givenName: "Stuart",
            familyName: "Household",
            organizationName: null,
            email: null,
            phone: null,
            streetAddress: null,
            city: null,
            state: null,
            country: null,
            postalCode: null,
            roles: ["client"],
          },
        ],
        relationships: [
          {
            id: randomUUID(),
            fromEntityId: person.record.id,
            toEntityId: stuart.projectId,
            kind: "client-project",
            status: "active",
            sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
            createdAt: NOW,
            createdBy: "test",
          },
          {
            id: randomUUID(),
            fromEntityId: person.record.id,
            toEntityId: other.projectId,
            kind: "client-project",
            status: "active",
            sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
            createdAt: NOW,
            createdBy: "test",
          },
        ],
        projectProfiles: [
          (await store.getProjectProfile(stuart.projectId))!,
          (await store.getProjectProfile(other.projectId))!,
        ],
        projectHistories: [
          (await store.getProjectHistory(stuart.projectId))!,
          (await store.getProjectHistory(other.projectId))!,
        ],
      },
      person.record.id,
    );
    const unset = books.find((row) => row.projectId === stuart.projectId);
    const classified = books.find((row) => row.projectId === other.projectId);
    assert.equal(unset?.projectKind, null);
    assert.equal(classified?.projectKind, "other");
    assert.notEqual(unset?.projectKind, classified?.projectKind);
  });

  it("L. reconstruction/title/filename cannot auto-classify Kind", () => {
    const apply = readFileSync(resolve(ROOT, "lib/continuum/client-memory/apply.ts"), "utf8");
    const proposal = readFileSync(
      resolve(ROOT, "lib/continuum/gmail/reconstruction-proposal.ts"),
      "utf8",
    );
    const workbook = readFileSync(
      resolve(ROOT, "lib/continuum/client-memory/workbook.ts"),
      "utf8",
    );
    for (const source of [apply, proposal, workbook]) {
      assert.doesNotMatch(source, /projectKind\s*:/);
      assert.doesNotMatch(source, /correctProjectKind/);
      assert.doesNotMatch(source, /project_kind\s*=/);
    }
  });

  it("M/N. Kind change does not alter lifecycle, specs, or Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const seeded = await seedProject(store, {
      title: "Chicken ring",
      fingerSize: "7",
      metal: "gold",
      orderNumber: "SP13040",
    });
    const personBefore = await store.getPersonProfile(seeded.personId);
    const historyBefore = await store.getProjectHistory(seeded.projectId);
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    const personAfter = await store.getPersonProfile(seeded.personId);
    const historyAfter = await store.getProjectHistory(seeded.projectId);
    const profile = await store.getProjectProfile(seeded.projectId);
    assert.equal(profile?.displayTitle, "Chicken ring");
    assert.equal(profile?.projectKind, "repair_service");
    assert.deepEqual(personAfter, personBefore);
    assert.equal(historyAfter?.fingerSize, historyBefore?.fingerSize);
    assert.equal(historyAfter?.metal, historyBefore?.metal);
    assert.equal(historyAfter?.orderNumber, historyBefore?.orderNumber);
    assert.equal(historyAfter?.cadJobNumber, historyBefore?.cadJobNumber);
    assert.equal(historyAfter?.centerStone, historyBefore?.centerStone);
    assert.equal(historyAfter?.updatedAt, historyBefore?.updatedAt);
    const desk = getProjectDeskFromSnapshot(
      {
        projectProfiles: [profile!],
        projectHistories: [historyAfter!],
        specRevisions: store.listProjectHistoryRevisions(seeded.projectId),
        relationships: [],
        people: [],
        sourceNotes: [],
      },
      seeded.projectId,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.projectKind, "repair_service");
    assert.equal(desk.desk.operationalStatus.kind, "unknown");
    assert.equal(desk.desk.openJobs.connected, false);
  });

  it("requires a project entity and does not write from hover-style missing actor", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const seeded = await seedProject(store);
    const missing = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: randomUUID(),
      newValue: "other",
      actor: ACTOR,
    });
    assert.equal(missing.ok, false);
    const noActor = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "other",
      actor: "  ",
    });
    assert.equal(noActor.ok, false);
    if (!noActor.ok) assert.equal(noActor.code, "invalid-id");
    const person = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.personId,
      newValue: "other",
      actor: ACTOR,
    });
    assert.equal(person.ok, false);
    if (!person.ok) assert.equal(person.reason, "entity-kind-mismatch");
  });
});
