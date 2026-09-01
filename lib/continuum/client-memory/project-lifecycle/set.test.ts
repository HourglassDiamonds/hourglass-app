import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { createInMemoryClientMemoryProjectSpecWriter } from "../project-spec/writer";
import { setProjectLifecycle } from "./set";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { composePersonProjectBooks } from "../project-books/compose";
import { getProjectDeskFromSnapshot } from "../project-desk/compose";
import { emptyReadSnapshot } from "../read/fixtures";
import type { ProjectKind } from "../project-kind";
import { CUSTOM_LIFECYCLE_STAGES, REPAIR_LIFECYCLE_STAGES } from "../project-lifecycle";

const NOW = "2026-08-31T16:00:00.000Z";
const ACTOR = "justin";

async function seedProject(
  store: InMemoryClientMemoryStore,
  extra: {
    title?: string;
    linkPerson?: boolean;
    personId?: string;
    personName?: string;
    kind?: ProjectKind | null;
    cad?: string | null;
    order?: string | null;
    gmail?: string | null;
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
      displayName: extra.personName ?? "Stuart Household",
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
  }
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: extra.title ?? "Stuart ring",
    visibility: "internal-only",
    importRowKey: `continuum-reconciliation-v3:ReconciledProjects:${randomUUID()}`,
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
  await store.insertProjectHistory({
    projectId: project.record.id,
    cadJobNumber: extra.cad === undefined ? "CAD-1" : extra.cad,
    orderNumber: extra.order === undefined ? "140" : extra.order,
    gmailThreadId: extra.gmail === undefined ? "thread-secret" : extra.gmail,
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: "6.5",
    metal: "platinum",
    centerStone: "oval",
    diamondSupplyNotes: "client stone",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { personId: person.record.id, projectId: project.record.id };
}

function deskSnapshot(
  store: InMemoryClientMemoryStore,
  projectId: string,
  personId?: string,
) {
  return (async () => {
    const project = await store.getProjectProfile(projectId);
    const history = await store.getProjectHistory(projectId);
    const person = personId ? await store.getPersonProfile(personId) : null;
    return {
      projectProfiles: project ? [project] : [],
      projectHistories: history ? [history] : [],
      specRevisions: store.listProjectHistoryRevisions(projectId),
      customDetails: store.listProjectCustomDetails(),
      repairDetails: store.listProjectRepairDetails(),
      lifecycleStates: store.listProjectLifecycleStates(),
      lifecycleEvents: store.listProjectLifecycleEvents(projectId),
      relationships: personId
        ? [
            {
              id: randomUUID(),
              fromEntityId: personId,
              toEntityId: projectId,
              kind: "client-project" as const,
              status: "active" as const,
              sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
              createdAt: NOW,
              createdBy: "test",
            },
          ]
        : [],
      people: person
        ? [{ personId: person.personId, displayName: person.displayName }]
        : [],
      sourceNotes: [],
    };
  })();
}

describe("Project Lifecycle mutations", () => {
  it("allows Custom and Repair stages, including non-adjacent jumps", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    const repair = await seedProject(store, {
      kind: "repair_service",
      personId: custom.personId,
    });
    for (const stage of CUSTOM_LIFECYCLE_STAGES) {
      const result = await writer.setProjectLifecycle({
        mutationId: randomUUID(),
        projectId: custom.projectId,
        newValue: stage,
        actor: ACTOR,
      });
      assert.equal(result.ok, true);
    }
    const jump = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      newValue: "design",
      actor: ACTOR,
    });
    assert.equal(jump.ok, true);
    for (const stage of REPAIR_LIFECYCLE_STAGES) {
      const result = await writer.setProjectLifecycle({
        mutationId: randomUUID(),
        projectId: repair.projectId,
        newValue: stage,
        actor: ACTOR,
      });
      assert.equal(result.ok, true);
    }
    const customDesk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, custom.projectId, custom.personId),
      custom.projectId,
    );
    const repairDesk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, repair.projectId, custom.personId),
      repair.projectId,
    );
    assert.equal(customDesk.ok && customDesk.desk.lifecycle.kind === "custom_new_jewelry"
      ? customDesk.desk.lifecycle.stage
      : null, "design");
    assert.equal(repairDesk.ok && repairDesk.desk.lifecycle.kind === "repair_service"
      ? repairDesk.desk.lifecycle.stage
      : null, "completed");
  });

  it("rejects invalid, cross-kind, and unsupported-kind writes", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    const repair = await seedProject(store, {
      kind: "repair_service",
      personId: custom.personId,
    });
    const rejectedRepairOnCustom = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      newValue: "intake",
      actor: ACTOR,
    });
    const rejectedCustomOnRepair = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      newValue: "cad",
      actor: ACTOR,
    });
    const rejectedArbitrary = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      newValue: "received",
      actor: ACTOR,
    });
    assert.equal(rejectedRepairOnCustom.ok, false);
    assert.equal(rejectedCustomOnRepair.ok, false);
    assert.equal(rejectedArbitrary.ok, false);
    for (const kind of [
      null,
      "other",
      "loose_stone_sourcing",
      "consultation_opportunity",
    ] as const) {
      const seeded = await seedProject(store, { kind, personId: custom.personId });
      const rejected = await writer.setProjectLifecycle({
        mutationId: randomUUID(),
        projectId: seeded.projectId,
        newValue: "cad",
        actor: ACTOR,
      });
      assert.equal(rejected.ok, false);
      if (!rejected.ok) {
        assert.equal(rejected.code, "unsupported-project-kind");
      }
      const desk = getProjectDeskFromSnapshot(
        await deskSnapshot(store, seeded.projectId, custom.personId),
        seeded.projectId,
      );
      assert.equal(desk.ok && desk.desk.lifecycle.kind, "none");
    }
  });

  it("supports NULL to stage, backtrack, clear, same-value no-op, and idempotent replay", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const seeded = await seedProject(store, { kind: "custom_new_jewelry" });
    const firstClear = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: null,
      actor: ACTOR,
    });
    assert.equal(firstClear.ok, true);
    if (firstClear.ok) assert.equal(firstClear.status, "already-present");
    assert.equal(
      await store.getProjectLifecycleState(seeded.projectId, "custom_new_jewelry"),
      null,
    );
    assert.equal(store.listProjectLifecycleEvents(seeded.projectId).length, 0);

    const toCad = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "cad",
      actor: ACTOR,
    });
    assert.equal(toCad.ok, true);
    const replayId = randomUUID();
    const first = await writer.setProjectLifecycle({
      mutationId: replayId,
      projectId: seeded.projectId,
      newValue: "production",
      actor: ACTOR,
    });
    const replay = await writer.setProjectLifecycle({
      mutationId: replayId,
      projectId: seeded.projectId,
      newValue: "production",
      actor: ACTOR,
    });
    assert.equal(first.ok, true);
    assert.equal(replay.ok, true);
    if (replay.ok) assert.equal(replay.status, "already-present");
    const noOp = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "production",
      actor: ACTOR,
    });
    assert.equal(noOp.ok, true);
    if (noOp.ok) assert.equal(noOp.status, "already-present");
    const back = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "design",
      actor: ACTOR,
    });
    assert.equal(back.ok, true);
    const cleared = await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: null,
      actor: ACTOR,
    });
    assert.equal(cleared.ok, true);
    const state = await store.getProjectLifecycleState(
      seeded.projectId,
      "custom_new_jewelry",
    );
    assert.equal(state?.stage ?? null, null);
    const events = store.listProjectLifecycleEvents(seeded.projectId);
    assert.equal(events.length, 4);
    assert.equal(events.some((row) => row.newStage == null), true);
    const desk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(desk.ok && desk.desk.lifecycle.kind === "custom_new_jewelry"
      ? desk.desk.lifecycle.label
      : null, "Not set");
  });

  it("rolls back when state update fails after the event insert", async () => {
    const store = new InMemoryClientMemoryStore();
    const seeded = await seedProject(store, { kind: "repair_service" });
    store.failNextLifecycleMutationAfter = "state";
    const result = await setProjectLifecycle(
      {
        nowIso: () => NOW,
        newEventId: () => randomUUID(),
        getEntity: (id) => store.getEntity(id),
        getProjectProfile: (projectId) => store.getProjectProfile(projectId),
        getLifecycleState: (projectId, kind) =>
          store.getProjectLifecycleState(projectId, kind),
        applyMutation: (input) => store.applyProjectLifecycleMutation(input),
      },
      {
        mutationId: randomUUID(),
        projectId: seeded.projectId,
        newValue: "intake",
        actor: ACTOR,
      },
    );
    assert.equal(result.ok, false);
    assert.equal(
      await store.getProjectLifecycleState(seeded.projectId, "repair_service"),
      null,
    );
    assert.equal(store.listProjectLifecycleEvents(seeded.projectId).length, 0);
  });

  it("preserves dormant lifecycle across Kind switches and Kind clear", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const seeded = await seedProject(store, { kind: "custom_new_jewelry" });
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "cad",
      actor: ACTOR,
    });
    const toRepair = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    assert.equal(toRepair.ok, true);
    assert.equal(
      (await store.getProjectLifecycleState(seeded.projectId, "custom_new_jewelry"))
        ?.stage,
      "cad",
    );
    const afterRepairKind = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(
      afterRepairKind.ok && afterRepairKind.desk.lifecycle.kind === "repair_service"
        ? afterRepairKind.desk.lifecycle.stage
        : "missing",
      null,
    );
    assert.equal(
      afterRepairKind.ok && afterRepairKind.desk.lifecycle.kind === "repair_service"
        ? afterRepairKind.desk.lifecycle.label
        : null,
      "Not set",
    );
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "evaluation",
      actor: ACTOR,
    });
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "custom_new_jewelry",
      actor: ACTOR,
    });
    const restored = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(
      restored.ok && restored.desk.lifecycle.kind === "custom_new_jewelry"
        ? restored.desk.lifecycle.stage
        : null,
      "cad",
    );
    assert.equal(
      (await store.getProjectLifecycleState(seeded.projectId, "repair_service"))
        ?.stage,
      "evaluation",
    );
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: null,
      actor: ACTOR,
    });
    const cleared = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(cleared.ok && cleared.desk.lifecycle.kind, "none");
    assert.equal(
      (await store.getProjectLifecycleState(seeded.projectId, "custom_new_jewelry"))
        ?.stage,
      "cad",
    );
    assert.equal(
      (await store.getProjectLifecycleState(seeded.projectId, "repair_service"))
        ?.stage,
      "evaluation",
    );
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    const backRepair = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(
      backRepair.ok && backRepair.desk.lifecycle.kind === "repair_service"
        ? backRepair.desk.lifecycle.stage
        : null,
      "evaluation",
    );
    assert.equal(
      (await store.getProjectProfile(seeded.projectId))?.projectKind,
      "repair_service",
    );
  });

  it("does not infer lifecycle from CAD, order, operating details, Gmail, or title", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const custom = await seedProject(store, {
      kind: "custom_new_jewelry",
      title: "Repair",
      cad: "C024594",
      order: "140",
      gmail: "gmail-thread",
    });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_design_brief",
      newValue: "Three-stone engagement ring",
      actor: ACTOR,
    });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_manufacturing_notes",
      newValue: "Cast in platinum",
      actor: ACTOR,
    });
    const repair = await seedProject(store, {
      kind: "repair_service",
      title: "Repair",
      personId: custom.personId,
    });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      fieldName: "repair_requested_service",
      newValue: "Replace head",
      actor: ACTOR,
    });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      fieldName: "repair_condition_notes",
      newValue: "Broken prong",
      actor: ACTOR,
    });
    const customDesk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, custom.projectId, custom.personId),
      custom.projectId,
    );
    const repairDesk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, repair.projectId, custom.personId),
      repair.projectId,
    );
    assert.equal(
      customDesk.ok && customDesk.desk.lifecycle.kind === "custom_new_jewelry"
        ? customDesk.desk.lifecycle.stage
        : "missing",
      null,
    );
    assert.equal(
      repairDesk.ok && repairDesk.desk.lifecycle.kind === "repair_service"
        ? repairDesk.desk.lifecycle.stage
        : "missing",
      null,
    );
    assert.equal(store.listProjectLifecycleEvents().length, 0);
  });

  it("keeps same-Person siblings, same-title Projects, and unlinked Projects isolated", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const stuart = await seedProject(store, {
      title: "STUART",
      kind: "custom_new_jewelry",
    });
    const mr = await seedProject(store, {
      title: "MR-STUART",
      kind: "repair_service",
      personId: stuart.personId,
    });
    const jesseA = await seedProject(store, {
      title: "Jesse R. C024594",
      kind: "custom_new_jewelry",
    });
    const jesseB = await seedProject(store, {
      title: "Jesse R. C025088",
      kind: "custom_new_jewelry",
    });
    const unlinked = await seedProject(store, {
      title: "Chicken ring",
      kind: "custom_new_jewelry",
      linkPerson: false,
    });
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: stuart.projectId,
      newValue: "cad",
      actor: ACTOR,
    });
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: mr.projectId,
      newValue: "bench",
      actor: ACTOR,
    });
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: jesseA.projectId,
      newValue: "design",
      actor: ACTOR,
    });
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: jesseB.projectId,
      newValue: "production",
      actor: ACTOR,
    });
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: unlinked.projectId,
      newValue: "discovery",
      actor: ACTOR,
    });
    const personBefore = await store.getPersonProfile(stuart.personId);
    const books = composePersonProjectBooks(
      {
        ...emptyReadSnapshot(),
        profiles: [
          {
            personId: stuart.personId,
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
            fromEntityId: stuart.personId,
            toEntityId: stuart.projectId,
            kind: "client-project",
            status: "active",
            sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
            createdAt: NOW,
            createdBy: "test",
          },
          {
            id: randomUUID(),
            fromEntityId: stuart.personId,
            toEntityId: mr.projectId,
            kind: "client-project",
            status: "active",
            sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
            createdAt: NOW,
            createdBy: "test",
          },
        ],
        projectProfiles: [
          (await store.getProjectProfile(stuart.projectId))!,
          (await store.getProjectProfile(mr.projectId))!,
        ],
        projectHistories: [
          (await store.getProjectHistory(stuart.projectId))!,
          (await store.getProjectHistory(mr.projectId))!,
        ],
        lifecycleStates: store.listProjectLifecycleStates(),
      },
      stuart.personId,
    );
    const stuartBook = books.find((row) => row.projectId === stuart.projectId);
    const mrBook = books.find((row) => row.projectId === mr.projectId);
    assert.equal(
      stuartBook?.lifecycle.kind === "custom_new_jewelry"
        ? stuartBook.lifecycle.stage
        : null,
      "cad",
    );
    assert.equal(
      mrBook?.lifecycle.kind === "repair_service" ? mrBook.lifecycle.stage : null,
      "bench",
    );
    assert.equal(stuartBook?.history.length, 0);
    assert.deepEqual(await store.getPersonProfile(stuart.personId), personBefore);
    assert.equal(
      (await store.getProjectLifecycleState(jesseA.projectId, "custom_new_jewelry"))
        ?.stage,
      "design",
    );
    assert.equal(
      (await store.getProjectLifecycleState(jesseB.projectId, "custom_new_jewelry"))
        ?.stage,
      "production",
    );
    const unlinkedDesk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, unlinked.projectId),
      unlinked.projectId,
    );
    assert.equal(unlinkedDesk.ok && unlinkedDesk.desk.people.length, 0);
    assert.equal(
      unlinkedDesk.ok && unlinkedDesk.desk.lifecycle.kind === "custom_new_jewelry"
        ? unlinkedDesk.desk.lifecycle.stage
        : null,
      "discovery",
    );
    assert.equal(
      store.listProjectLifecycleEvents(stuart.projectId).every(
        (row) => row.projectId === stuart.projectId,
      ),
      true,
    );
  });

  it("separates lifecycle from Kind, operating details, Open Jobs, and commercial state", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const seeded = await seedProject(store, { kind: "custom_new_jewelry" });
    const kindBefore = (await store.getProjectProfile(seeded.projectId))?.projectKind;
    await writer.setProjectLifecycle({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "client_approval",
      actor: ACTOR,
    });
    assert.equal(
      (await store.getProjectProfile(seeded.projectId))?.projectKind,
      kindBefore,
    );
    assert.equal(await store.getProjectCustomDetails(seeded.projectId), null);
    const desk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(desk.ok && desk.desk.openJobs.connected, false);
    assert.equal(desk.ok && desk.desk.operationalStatus.kind, "unknown");
    assert.equal(
      desk.ok && desk.desk.lifecycle.kind === "custom_new_jewelry"
        ? desk.desk.lifecycle.stage
        : null,
      "client_approval",
    );
    assert.doesNotMatch(
      JSON.stringify(desk.ok ? desk.desk.lifecycle : {}),
      /Waiting on|overdue|sold|deposit paid|invoice sent/i,
    );
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      fieldName: "custom_design_brief",
      newValue: "Halo",
      actor: ACTOR,
    });
    assert.equal(
      (await store.getProjectLifecycleState(seeded.projectId, "custom_new_jewelry"))
        ?.stage,
      "client_approval",
    );
    const eventCount = store.listProjectLifecycleEvents(seeded.projectId).length;
    await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "repair_service",
      actor: ACTOR,
    });
    assert.equal(store.listProjectLifecycleEvents(seeded.projectId).length, eventCount);
    assert.equal(
      (await store.getProjectLifecycleState(seeded.projectId, "custom_new_jewelry"))
        ?.stage,
      "client_approval",
    );
  });
});
