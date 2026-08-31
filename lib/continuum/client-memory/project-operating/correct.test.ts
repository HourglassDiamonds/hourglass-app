import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { createInMemoryClientMemoryProjectSpecWriter } from "../project-spec/writer";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { composePersonProjectBooks } from "../project-books/compose";
import { getProjectDeskFromSnapshot } from "../project-desk/compose";
import { emptyReadSnapshot } from "../read/fixtures";
import type { ProjectKind } from "../project-kind";

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
    cadJobNumber: "CAD-1",
    orderNumber: "140",
    gmailThreadId: null,
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: "6.5",
    metal: "platinum",
    centerStone: "oval",
    diamondSupplyNotes: null,
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

describe("Custom / Repair operating layers", () => {
  it("A/B. Custom details only for custom_new_jewelry; Repair only for repair_service", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const custom = await seedProject(store, {
      kind: "custom_new_jewelry",
      title: "Custom A",
    });
    const repair = await seedProject(store, {
      kind: "repair_service",
      title: "Repair B",
      personId: custom.personId,
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
      projectId: repair.projectId,
      fieldName: "repair_requested_service",
      newValue: "Replace head",
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
    assert.equal(customDesk.ok, true);
    assert.equal(repairDesk.ok, true);
    if (!customDesk.ok || !repairDesk.ok) return;
    assert.equal(customDesk.desk.operatingLayer.kind, "custom_new_jewelry");
    assert.equal(
      customDesk.desk.operatingLayer.kind === "custom_new_jewelry"
        ? customDesk.desk.operatingLayer.fields.find(
            (row) => row.fieldName === "custom_design_brief",
          )?.value
        : null,
      "Three-stone engagement ring",
    );
    assert.doesNotMatch(JSON.stringify(customDesk.desk.operatingLayer), /Replace head/);
    assert.equal(repairDesk.desk.operatingLayer.kind, "repair_service");
    assert.equal(
      repairDesk.desk.operatingLayer.kind === "repair_service"
        ? repairDesk.desk.operatingLayer.fields.find(
            (row) => row.fieldName === "repair_requested_service",
          )?.value
        : null,
      "Replace head",
    );
    assert.doesNotMatch(
      JSON.stringify(repairDesk.desk.operatingLayer),
      /Three-stone engagement ring/,
    );
  });

  it("C/D/E/F. NULL, Other, Loose Stone, and Consultation show neither layer", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    for (const kind of [
      null,
      "other",
      "loose_stone_sourcing",
      "consultation_opportunity",
    ] as const) {
      const seeded = await seedProject(store, {
        kind,
        title: String(kind ?? "unset"),
      });
      const rejectedCustom = await writer.correctProjectOperatingDetail({
        mutationId: randomUUID(),
        projectId: seeded.projectId,
        fieldName: "custom_design_brief",
        newValue: "nope",
        actor: ACTOR,
      });
      const rejectedRepair = await writer.correctProjectOperatingDetail({
        mutationId: randomUUID(),
        projectId: seeded.projectId,
        fieldName: "repair_item_description",
        newValue: "nope",
        actor: ACTOR,
      });
      assert.equal(rejectedCustom.ok, false);
      assert.equal(rejectedRepair.ok, false);
      const desk = getProjectDeskFromSnapshot(
        await deskSnapshot(store, seeded.projectId, seeded.personId),
        seeded.projectId,
      );
      assert.equal(desk.ok, true);
      if (!desk.ok) return;
      assert.equal(desk.desk.operatingLayer.kind, "none");
    }
  });

  it("G/H/I. writes are kind-gated", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const repair = await seedProject(store, { kind: "repair_service" });
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    const unset = await seedProject(store, { kind: null });
    const g = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      fieldName: "custom_design_brief",
      newValue: "should fail",
      actor: ACTOR,
    });
    const h = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "repair_condition_notes",
      newValue: "should fail",
      actor: ACTOR,
    });
    const i = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: unset.projectId,
      fieldName: "custom_design_brief",
      newValue: "should fail",
      actor: ACTOR,
    });
    assert.equal(g.ok, false);
    if (!g.ok) assert.equal(g.code, "wrong-project-kind");
    assert.equal(h.ok, false);
    if (!h.ok) assert.equal(h.code, "wrong-project-kind");
    assert.equal(i.ok, false);
    if (!i.ok) assert.equal(i.code, "wrong-project-kind");
    assert.equal((await store.getProjectCustomDetails(repair.projectId)), null);
    assert.equal((await store.getProjectRepairDetails(custom.projectId)), null);
    assert.equal((await store.getProjectCustomDetails(unset.projectId)), null);
  });

  it("J/K/L. set, change, clear, and audit revision", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    const repair = await seedProject(store, { kind: "repair_service" });
    const set = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_design_brief",
      newValue: "  First brief  ",
      actor: ACTOR,
    });
    assert.equal(set.ok, true);
    const changed = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_design_brief",
      newValue: "Second brief",
      actor: ACTOR,
    });
    assert.equal(changed.ok, true);
    const cleared = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_design_brief",
      newValue: "  ",
      actor: ACTOR,
    });
    assert.equal(cleared.ok, true);
    const details = await store.getProjectCustomDetails(custom.projectId);
    assert.equal(details?.designBrief ?? null, null);
    const customRevs = store
      .listProjectHistoryRevisions(custom.projectId)
      .filter((row) => row.fieldName === "custom_design_brief");
    assert.equal(customRevs.length, 3);
    assert.equal(
      customRevs.some(
        (row) => row.priorValue == null && row.newValue === "First brief",
      ),
      true,
    );
    assert.equal(
      customRevs.some(
        (row) => row.priorValue === "First brief" && row.newValue === "Second brief",
      ),
      true,
    );
    assert.equal(
      customRevs.some(
        (row) => row.priorValue === "Second brief" && row.newValue == null,
      ),
      true,
    );
    assert.equal(
      customRevs.every((row) => row.changedBy === ACTOR),
      true,
    );

    const repairSet = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      fieldName: "repair_item_description",
      newValue: "Platinum band",
      actor: ACTOR,
    });
    assert.equal(repairSet.ok, true);
    const repairChanged = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      fieldName: "repair_item_description",
      newValue: "Yellow gold band",
      actor: ACTOR,
    });
    assert.equal(repairChanged.ok, true);
    const repairCleared = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: repair.projectId,
      fieldName: "repair_item_description",
      newValue: "",
      actor: ACTOR,
    });
    assert.equal(repairCleared.ok, true);
    assert.equal(
      (await store.getProjectRepairDetails(repair.projectId))?.itemDescription ??
        null,
      null,
    );
  });

  it("M. atomic mutation rolls back revision and detail together", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    store.failNextProjectSpecMutationAfter = "revision";
    const failedRev = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_manufacturing_notes",
      newValue: "Hidden gallery",
      actor: ACTOR,
    });
    assert.equal(failedRev.ok, false);
    assert.equal(await store.getProjectCustomDetails(custom.projectId), null);
    assert.equal(store.listProjectHistoryRevisions(custom.projectId).length, 0);

    store.failNextProjectSpecMutationAfter = "update";
    const failedUpdate = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: custom.projectId,
      fieldName: "custom_manufacturing_notes",
      newValue: "Hidden gallery",
      actor: ACTOR,
    });
    assert.equal(failedUpdate.ok, false);
    assert.equal(await store.getProjectCustomDetails(custom.projectId), null);
    assert.equal(store.listProjectHistoryRevisions(custom.projectId).length, 0);
  });

  it("N/O. same-Person and same-title siblings stay isolated", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const person = await seedProject(store, {
      kind: "custom_new_jewelry",
      title: "Jesse R. C024594",
    });
    const sibling = await seedProject(store, {
      kind: "repair_service",
      title: "Jesse R. C025088",
      personId: person.personId,
    });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: person.projectId,
      fieldName: "custom_design_requirements",
      newValue: "No halo",
      actor: ACTOR,
    });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: sibling.projectId,
      fieldName: "repair_requested_service",
      newValue: "Tighten prongs",
      actor: ACTOR,
    });
    assert.equal(
      (await store.getProjectCustomDetails(sibling.projectId)),
      null,
    );
    assert.equal(
      (await store.getProjectRepairDetails(person.projectId)),
      null,
    );
    const personProfile = await store.getPersonProfile(person.personId);
    const snapshot = {
      ...emptyReadSnapshot(),
      profiles: personProfile
        ? [
            {
              personId: personProfile.personId,
              displayName: personProfile.displayName,
              givenName: personProfile.givenName,
              familyName: personProfile.familyName,
              organizationName: personProfile.organizationName,
              email: personProfile.email,
              phone: personProfile.phone,
              streetAddress: personProfile.streetAddress,
              city: personProfile.city,
              state: personProfile.state,
              country: personProfile.country,
              postalCode: personProfile.postalCode,
              roles: personProfile.roles,
            },
          ]
        : [],
      projectProfiles: [
        (await store.getProjectProfile(person.projectId))!,
        (await store.getProjectProfile(sibling.projectId))!,
      ],
      projectHistories: [
        (await store.getProjectHistory(person.projectId))!,
        (await store.getProjectHistory(sibling.projectId))!,
      ],
      customDetails: store.listProjectCustomDetails(),
      repairDetails: store.listProjectRepairDetails(),
      relationships: [
        {
          id: randomUUID(),
          fromEntityId: person.personId,
          toEntityId: person.projectId,
          kind: "client-project" as const,
          status: "active" as const,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          createdBy: "test",
        },
        {
          id: randomUUID(),
          fromEntityId: person.personId,
          toEntityId: sibling.projectId,
          kind: "client-project" as const,
          status: "active" as const,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          createdBy: "test",
        },
      ],
    };
    const books = composePersonProjectBooks(snapshot, person.personId);
    assert.equal(books.length, 2);
    const customBook = books.find((row) => row.projectId === person.projectId);
    const repairBook = books.find((row) => row.projectId === sibling.projectId);
    assert.equal(customBook?.operatingLayer.kind, "custom_new_jewelry");
    assert.equal(repairBook?.operatingLayer.kind, "repair_service");
    assert.equal(
      customBook?.operatingLayer.kind === "custom_new_jewelry"
        ? customBook.operatingLayer.fields.find(
            (row) => row.fieldName === "custom_design_requirements",
          )?.value
        : null,
      "No halo",
    );
    assert.doesNotMatch(JSON.stringify(customBook?.operatingLayer), /Tighten prongs/);
    assert.doesNotMatch(JSON.stringify(repairBook?.operatingLayer), /No halo/);
  });

  it("P. unlinked Projects support Kind + operating details without Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const unlinked = await seedProject(store, {
      kind: "custom_new_jewelry",
      linkPerson: false,
      title: "Unlinked custom",
    });
    const result = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: unlinked.projectId,
      fieldName: "custom_design_brief",
      newValue: "Solitaire",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    const desk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, unlinked.projectId),
      unlinked.projectId,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.people.length, 0);
    assert.equal(desk.desk.operatingLayer.kind, "custom_new_jewelry");
  });

  it("Q/R/S/T. Kind switch preserves dormant data and does not infer Kind", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const seeded = await seedProject(store, { kind: "custom_new_jewelry" });
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      fieldName: "custom_design_brief",
      newValue: "Three-stone engagement ring",
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
      (await store.getProjectCustomDetails(seeded.projectId))?.designBrief,
      "Three-stone engagement ring",
    );
    const afterRepairKind = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(afterRepairKind.ok, true);
    if (!afterRepairKind.ok) return;
    assert.equal(afterRepairKind.desk.operatingLayer.kind, "repair_service");
    assert.equal(
      afterRepairKind.desk.operatingLayer.kind === "repair_service"
        ? afterRepairKind.desk.operatingLayer.fields.every((row) => row.value == null)
        : false,
      true,
    );
    const blockedCustom = await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      fieldName: "custom_design_brief",
      newValue: "should not write",
      actor: ACTOR,
    });
    assert.equal(blockedCustom.ok, false);

    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      fieldName: "repair_requested_service",
      newValue: "Replace head",
      actor: ACTOR,
    });
    const back = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "custom_new_jewelry",
      actor: ACTOR,
    });
    assert.equal(back.ok, true);
    assert.equal(
      (await store.getProjectRepairDetails(seeded.projectId))?.requestedService,
      "Replace head",
    );
    const restored = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(restored.ok, true);
    if (!restored.ok) return;
    assert.equal(restored.desk.operatingLayer.kind, "custom_new_jewelry");
    assert.equal(
      restored.desk.operatingLayer.kind === "custom_new_jewelry"
        ? restored.desk.operatingLayer.fields.find(
            (row) => row.fieldName === "custom_design_brief",
          )?.value
        : null,
      "Three-stone engagement ring",
    );
    assert.doesNotMatch(JSON.stringify(restored.desk.operatingLayer), /Replace head/);

    const cleared = await writer.correctProjectKind({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      newValue: "",
      actor: ACTOR,
    });
    assert.equal(cleared.ok, true);
    const profile = await store.getProjectProfile(seeded.projectId);
    assert.equal(profile?.projectKind ?? null, null);
    assert.equal(
      (await store.getProjectCustomDetails(seeded.projectId))?.designBrief,
      "Three-stone engagement ring",
    );
    assert.equal(
      (await store.getProjectRepairDetails(seeded.projectId))?.requestedService,
      "Replace head",
    );
    const none = getProjectDeskFromSnapshot(
      await deskSnapshot(store, seeded.projectId, seeded.personId),
      seeded.projectId,
    );
    assert.equal(none.ok, true);
    if (!none.ok) return;
    assert.equal(none.desk.operatingLayer.kind, "none");
    assert.equal(none.desk.projectKind, null);
  });

  it("U/V/W/X. does not mutate Person, sibling, lifecycle, or Open Jobs", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryProjectSpecWriter(store);
    const first = await seedProject(store, { kind: "custom_new_jewelry" });
    const sibling = await seedProject(store, {
      kind: "custom_new_jewelry",
      personId: first.personId,
      title: "Sibling",
    });
    const personBefore = await store.getPersonProfile(first.personId);
    const siblingBefore = await store.getProjectCustomDetails(sibling.projectId);
    await writer.correctProjectOperatingDetail({
      mutationId: randomUUID(),
      projectId: first.projectId,
      fieldName: "custom_design_brief",
      newValue: "Only this Project",
      actor: ACTOR,
    });
    const personAfter = await store.getPersonProfile(first.personId);
    assert.deepEqual(personAfter, personBefore);
    assert.equal(await store.getProjectCustomDetails(sibling.projectId), siblingBefore);
    const desk = getProjectDeskFromSnapshot(
      await deskSnapshot(store, first.projectId, first.personId),
      first.projectId,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.operationalStatus.kind, "unknown");
    assert.equal(desk.desk.openJobs.connected, false);
  });
});
