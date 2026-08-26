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

function history(projectId: string, extra: Partial<ProjectHistory> = {}): ProjectHistory {
  return {
    projectId,
    cadJobNumber: "CAD-1",
    orderNumber: null,
    gmailThreadId: "thread-secret",
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize: "6.5",
    metal: "platinum",
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

function note(
  projectId: string,
  text: string,
  createdAt: string,
  personId: string | null = null,
): SourceNote {
  return {
    id: randomUUID(),
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

describe("Project Desk compose", () => {
  it("lists every Client Memory project without inventing lifecycle buckets", () => {
    const first = profile("Oval ring");
    const second = profile("Band");
    const data = snapshot({
      projectProfiles: [first, second],
    });
    const rows = listProjectsFromSnapshot(data);
    assert.deepEqual(
      [...rows.map((row) => row.title)].sort(),
      ["Band", "Oval ring"],
    );
    assert.equal(
      rows.every((row) => !("lifecycle" in row) && !("openedAt" in row)),
      true,
    );
  });

  it("preserves household people and does not collapse them", () => {
    const project = profile("Household band");
    const pam = { personId: randomUUID(), displayName: "Pam" };
    const travis = { personId: randomUUID(), displayName: "Travis" };
    const john = { personId: randomUUID(), displayName: "John Pennock" };
    const data = snapshot({
      projectProfiles: [project],
      people: [pam, travis, john],
      relationships: [
        relationship({ fromEntityId: pam.personId, toEntityId: project.projectId }),
        relationship({ fromEntityId: travis.personId, toEntityId: project.projectId }),
        relationship({ fromEntityId: project.projectId, toEntityId: john.personId }),
      ],
    });
    const desk = getProjectDeskFromSnapshot(data, project.projectId);
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.deepEqual(
      desk.desk.people.map((row) => row.displayName),
      ["John Pennock", "Pam", "Travis"],
    );
  });

  it("maps populated specs, omits empty fields, and hides thread ids", () => {
    const project = profile("Oval ring");
    const data = snapshot({
      projectProfiles: [project],
      projectHistories: [
        history(project.projectId, { orderNumber: null, centerStone: "  " }),
      ],
    });
    const desk = getProjectDeskFromSnapshot(data, project.projectId);
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.deepEqual(
      desk.desk.specs.map((row) => row.label),
      ["CAD", "Finger size", "Metal"],
    );
    assert.doesNotMatch(JSON.stringify(desk.desk.specs), /thread-secret|gmail/i);
    assert.equal(desk.desk.coverage.specs, "available");
  });

  it("returns notes newest first and treats missing notes as none", () => {
    const project = profile("Noted ring");
    const person = { personId: randomUUID(), displayName: "Ada" };
    const older = note(project.projectId, "First", "2026-08-01T00:00:00.000Z", person.personId);
    const newer = note(project.projectId, "Second", "2026-08-20T00:00:00.000Z", person.personId);
    const data = snapshot({
      projectProfiles: [project],
      people: [person],
      sourceNotes: [older, newer],
    });
    const desk = getProjectDeskFromSnapshot(data, project.projectId);
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.deepEqual(
      desk.desk.notes.map((row) => row.noteText),
      ["Second", "First"],
    );
    assert.equal(desk.desk.notes[0]?.personName, "Ada");
    assert.equal(desk.desk.coverage.notes, "available");
    const empty = getProjectDeskFromSnapshot(
      snapshot({ projectProfiles: [project] }),
      project.projectId,
    );
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    assert.equal(empty.desk.notes.length, 0);
    assert.equal(empty.desk.coverage.notes, "none");
  });

  it("keeps operational status unknown and never invents waiting-on", () => {
    const project = profile("Unknown");
    const opened = profile("Opened");
    const data = snapshot({
      projectProfiles: [project, opened],
      projectHistories: [history(opened.projectId)],
    });
    const unknownDesk = getProjectDeskFromSnapshot(data, project.projectId);
    const otherDesk = getProjectDeskFromSnapshot(data, opened.projectId);
    assert.equal(unknownDesk.ok && unknownDesk.desk.operationalStatus.kind, "unknown");
    assert.equal(otherDesk.ok && otherDesk.desk.operationalStatus.kind, "unknown");
    if (!unknownDesk.ok || !otherDesk.ok) return;
    assert.doesNotMatch(
      unknownDesk.desk.operationalStatus.evidence,
      /No Current Action|Waiting on|overdue|Needs Review/i,
    );
    assert.doesNotMatch(
      otherDesk.desk.operationalStatus.evidence,
      /No Current Action|Waiting on|overdue|Needs Review/i,
    );
    assert.equal(otherDesk.desk.openJobs.connected, false);
    assert.equal(otherDesk.desk.artifacts.connected, false);
    assert.equal(otherDesk.desk.coverage.jobs, "not-connected");
    assert.equal(otherDesk.desk.coverage.email, "not-connected");
    assert.equal(unknownDesk.desk.coverage.people, "missing");
    assert.equal(unknownDesk.desk.coverage.specs, "sparse");
  });

  it("fails closed for an unknown or non-project id", () => {
    const personId = randomUUID();
    const data = snapshot({
      people: [{ personId, displayName: "Ada" }],
    });
    assert.equal(getProjectDeskFromSnapshot(data, personId).ok, false);
    assert.equal(getProjectDeskFromSnapshot(snapshot(), randomUUID()).ok, false);
    assert.equal(getProjectDeskFromSnapshot(snapshot(), "not-a-uuid").ok, false);
  });
});
