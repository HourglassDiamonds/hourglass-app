import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  CLIENT_MEMORY_SOURCE_SYSTEM,
  type ProjectHistory,
  type ProjectProfile,
  type SourceNote,
} from "../types";
import { relationship } from "../read/fixtures";
import {
  getProjectDeskFromSnapshot,
  listProjectsFromSnapshot,
} from "./compose";
import type { ProjectDeskSnapshot } from "./types";

const NOW = "2026-08-22T12:00:00.000Z";

function profile(title: string, projectId = randomUUID()): ProjectProfile {
  return {
    projectId,
    displayTitle: title,
    visibility: "internal-only",
    importRowKey: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function history(
  projectId: string,
  extra: Partial<ProjectHistory> = {},
): ProjectHistory {
  return {
    projectId,
    cadJobNumber: null,
    orderNumber: null,
    gmailThreadId: null,
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

function note(
  projectId: string | null,
  text: string,
  createdAt: string,
  personId: string | null = null,
  id = randomUUID(),
): SourceNote {
  return {
    id,
    personId,
    projectId,
    contextLayer: "client",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    sourceArtifact: "continuum-reconciliation-v3",
    sourceSheet: "Reconciled Projects",
    sourceField: "Notes",
    importRowKey: "row",
    gmailThreadId: null,
    noteText: text,
    createdAt,
  };
}

function snapshot(partial: Partial<ProjectDeskSnapshot> = {}): ProjectDeskSnapshot {
  return {
    projectProfiles: [],
    projectHistories: [],
    relationships: [],
    people: [],
    sourceNotes: [],
    ...partial,
  };
}

describe("Project Desk cross-project isolation", () => {
  it("keeps notes, specs, latest context, and people scoped to the requested project", () => {
    const projectA = profile("Oval ring");
    const projectB = profile("Oval ring");
    const ada = { personId: randomUUID(), displayName: "Ada" };
    const travis = { personId: randomUUID(), displayName: "Travis" };
    const household = { personId: randomUUID(), displayName: "Household member" };
    const data = snapshot({
      projectProfiles: [projectA, projectB],
      projectHistories: [
        history(projectA.projectId, { cadJobNumber: "CAD-A", metal: "platinum" }),
        history(projectB.projectId, { cadJobNumber: "CAD-B", metal: "gold" }),
      ],
      people: [ada, travis, household],
      relationships: [
        relationship({ fromEntityId: ada.personId, toEntityId: projectA.projectId }),
        relationship({ fromEntityId: ada.personId, toEntityId: projectB.projectId }),
        relationship({ fromEntityId: travis.personId, toEntityId: projectB.projectId }),
        relationship({
          fromEntityId: household.personId,
          toEntityId: projectA.projectId,
        }),
        relationship({
          fromEntityId: ada.personId,
          toEntityId: household.personId,
          kind: "household-member",
        }),
      ],
      sourceNotes: [
        note(projectA.projectId, "A-note", "2026-08-20T00:00:00.000Z", ada.personId),
        note(projectB.projectId, "B-note", "2026-08-21T00:00:00.000Z", ada.personId),
        note(null, "Person-only note", "2026-08-22T00:00:00.000Z", ada.personId),
      ],
    });

    const deskA = getProjectDeskFromSnapshot(data, projectA.projectId);
    const deskB = getProjectDeskFromSnapshot(data, projectB.projectId);
    assert.equal(deskA.ok, true);
    assert.equal(deskB.ok, true);
    if (!deskA.ok || !deskB.ok) return;

    assert.equal(deskA.desk.title, "Oval ring");
    assert.equal(deskB.desk.title, "Oval ring");
    assert.notEqual(deskA.desk.projectId, deskB.desk.projectId);

    assert.deepEqual(
      deskA.desk.people.map((row) => row.displayName).sort(),
      ["Ada", "Household member"],
    );
    assert.deepEqual(
      deskB.desk.people.map((row) => row.displayName).sort(),
      ["Ada", "Travis"],
    );
    assert.equal(
      deskA.desk.people.some((row) => row.personId === travis.personId),
      false,
    );

    assert.deepEqual(
      deskA.desk.specs.map((row) => `${row.label}:${row.value}`),
      ["CAD:CAD-A", "Metal:platinum"],
    );
    assert.deepEqual(
      deskB.desk.specs.map((row) => `${row.label}:${row.value}`),
      ["CAD:CAD-B", "Metal:gold"],
    );

    assert.deepEqual(
      deskA.desk.notes.map((row) => row.noteText),
      ["A-note"],
    );
    assert.deepEqual(
      deskB.desk.notes.map((row) => row.noteText),
      ["B-note"],
    );
    assert.equal(deskA.desk.latestNotePreview, "A-note");
    assert.equal(deskB.desk.latestNotePreview, "B-note");
    assert.equal(deskA.desk.operationalStatus.kind, "unknown");
    assert.equal(deskB.desk.operationalStatus.kind, "unknown");

    const listed = listProjectsFromSnapshot(data);
    assert.equal(listed.length, 2);
    const listedA = listed.find((row) => row.projectId === projectA.projectId);
    const listedB = listed.find((row) => row.projectId === projectB.projectId);
    assert.equal(listedA?.latestNotePreview, "A-note");
    assert.equal(listedB?.latestNotePreview, "B-note");
    assert.equal(listedB?.people.some((row) => row.displayName === "Household member"), false);
  });

  it("does not duplicate a project when multiple people are linked", () => {
    const project = profile("Shared band");
    const ada = { personId: randomUUID(), displayName: "Ada" };
    const pam = { personId: randomUUID(), displayName: "Pam" };
    const data = snapshot({
      projectProfiles: [project],
      people: [ada, pam],
      relationships: [
        relationship({ fromEntityId: ada.personId, toEntityId: project.projectId }),
        relationship({ fromEntityId: pam.personId, toEntityId: project.projectId }),
        relationship({ fromEntityId: ada.personId, toEntityId: project.projectId }),
      ],
    });
    const rows = listProjectsFromSnapshot(data);
    assert.equal(rows.length, 1);
    assert.deepEqual(
      rows[0]?.people.map((row) => row.displayName),
      ["Ada", "Pam"],
    );
  });

  it("ignores ended links and missing people without inventing rows", () => {
    const project = profile("Sparse ring");
    const missing = randomUUID();
    const former = { personId: randomUUID(), displayName: "Former" };
    const data = snapshot({
      projectProfiles: [project],
      people: [former],
      relationships: [
        relationship({ fromEntityId: missing, toEntityId: project.projectId }),
        relationship({
          fromEntityId: former.personId,
          toEntityId: project.projectId,
          status: "ended",
        }),
      ],
    });
    const desk = getProjectDeskFromSnapshot(data, project.projectId);
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.people.length, 0);
    assert.equal(desk.desk.notes.length, 0);
    assert.equal(desk.desk.specs.length, 0);
    assert.equal(desk.desk.latestNotePreview, null);
    assert.equal(desk.desk.coverage.people, "missing");
    assert.equal(desk.desk.coverage.notes, "none");
    assert.equal(desk.desk.coverage.specs, "sparse");
  });

  it("sorts same-timestamp notes deterministically and never lists a person as a project", () => {
    const project = profile("Tie ring");
    const personId = randomUUID();
    const olderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const newerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const stamp = "2026-08-20T12:00:00.000Z";
    const data = snapshot({
      projectProfiles: [project],
      people: [{ personId, displayName: "Ada" }],
      sourceNotes: [
        note(project.projectId, "alpha", stamp, personId, olderId),
        note(project.projectId, "beta", stamp, personId, newerId),
      ],
    });
    const desk = getProjectDeskFromSnapshot(data, project.projectId);
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.deepEqual(
      desk.desk.notes.map((row) => row.noteText),
      ["beta", "alpha"],
    );
    assert.equal(getProjectDeskFromSnapshot(data, personId).ok, false);
    assert.equal(listProjectsFromSnapshot(data).length, 1);
    assert.equal(listProjectsFromSnapshot(data)[0]?.projectId, project.projectId);
  });
});
