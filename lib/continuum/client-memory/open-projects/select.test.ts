import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProjectDeskSummary } from "../project-desk/types";
import { selectOpenProjectWork } from "./select";
import type { ProjectWorkSummary } from "../project-jobs/intelligence";

const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PERSON_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERSON_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function emptyWork(): Extract<ProjectWorkSummary, { connected: true }> {
  return {
    connected: true,
    unresolvedCount: 0,
    activeCount: 0,
    deferredCount: 0,
    waitingOn: {
      founder: 0,
      hourglass: 0,
      client: 0,
      vendor: 0,
      unknown: 0,
    },
    blocked: false,
    dueSoonCount: 0,
    pastDueCount: 0,
    forgottenRiskCount: 0,
    nextDueAt: null,
  };
}

function summary(
  extra: Partial<ProjectDeskSummary> & Pick<ProjectDeskSummary, "projectId" | "title">,
): ProjectDeskSummary {
  return {
    projectKind: null,
    people: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "missing",
      specs: "sparse",
      notes: "none",
      jobs: "none",
      files: "not-connected",
      email: "not-connected",
    },
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    projectWork: emptyWork(),
    lifecycleStage: null,
    lifecycleLabel: null,
    ...extra,
  };
}

describe("Open Project work selection", () => {
  it("returns zero, one, and several current Projects", () => {
    assert.deepEqual(selectOpenProjectWork([]), []);
    const one = selectOpenProjectWork([
      summary({
        projectId: PROJECT_A,
        title: "Oval ring",
        projectWork: { ...emptyWork(), unresolvedCount: 1, activeCount: 1 },
      }),
    ]);
    assert.equal(one.length, 1);
    assert.equal(one[0]?.title, "Oval ring");
    assert.equal(
      one[0]?.href,
      "/executive-dashboard/concierge/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const several = selectOpenProjectWork([
      summary({
        projectId: PROJECT_B,
        title: "Band",
        projectWork: { ...emptyWork(), unresolvedCount: 2, activeCount: 2 },
      }),
      summary({
        projectId: PROJECT_A,
        title: "Oval ring",
        projectWork: { ...emptyWork(), unresolvedCount: 1, activeCount: 1 },
      }),
    ]);
    assert.deepEqual(
      several.map((row) => row.title),
      ["Band", "Oval ring"],
    );
  });

  it("includes lifecycle-active Projects without jobs and snoozed-only work", () => {
    const rows = selectOpenProjectWork([
      summary({
        projectId: PROJECT_A,
        title: "Quiet complete",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "completed",
        lifecycleLabel: "Complete",
      }),
      summary({
        projectId: PROJECT_B,
        title: "In production",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "production",
        lifecycleLabel: "Production",
      }),
      summary({
        projectId: PROJECT_C,
        title: "Deferred only",
        projectWork: {
          ...emptyWork(),
          unresolvedCount: 1,
          deferredCount: 1,
        },
      }),
    ]);
    assert.deepEqual(
      rows.map((row) => row.title),
      ["Deferred only", "In production"],
    );
  });

  it("keeps lifecycle plus jobs on the same Project", () => {
    const rows = selectOpenProjectWork([
      summary({
        projectId: PROJECT_A,
        title: "Ada ring",
        projectKind: "custom_new_jewelry",
        lifecycleStage: "cad",
        lifecycleLabel: "CAD",
        people: [{ personId: PERSON_A, displayName: "Ada" }],
        projectWork: {
          ...emptyWork(),
          unresolvedCount: 2,
          activeCount: 2,
          waitingOn: { ...emptyWork().waitingOn, founder: 1, client: 1 },
          nextDueAt: "2026-09-12T00:00:00.000Z",
        },
      }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.lifecycleLabel, "CAD");
    assert.equal(rows[0]?.projectWork.connected && rows[0].projectWork.nextDueAt, "2026-09-12T00:00:00.000Z");
    assert.deepEqual(
      rows[0]?.people.map((person) => person.displayName),
      ["Ada"],
    );
  });

  it("does not treat a bare Project row or Kind as current work", () => {
    const rows = selectOpenProjectWork([
      summary({ projectId: PROJECT_A, title: "Historical ring" }),
      summary({
        projectId: PROJECT_B,
        title: "Kind only",
        projectKind: "repair_service",
        lifecycleStage: null,
        lifecycleLabel: "Not set",
      }),
    ]);
    assert.equal(rows.length, 0);
  });

  it("keeps people scoped to the Project and does not mix Agent OS or CoS fields", () => {
    const rows = selectOpenProjectWork([
      summary({
        projectId: PROJECT_A,
        title: "Ada ring",
        people: [{ personId: PERSON_A, displayName: "Ada" }],
        projectWork: { ...emptyWork(), unresolvedCount: 1, activeCount: 1 },
      }),
      summary({
        projectId: PROJECT_B,
        title: "Travis band",
        people: [{ personId: PERSON_B, displayName: "Travis" }],
        projectWork: { ...emptyWork(), unresolvedCount: 1, activeCount: 1 },
      }),
    ]);
    assert.deepEqual(
      rows.find((row) => row.title === "Ada ring")?.people.map((p) => p.displayName),
      ["Ada"],
    );
    assert.equal(
      JSON.stringify(rows).includes("Travis"),
      true,
    );
    assert.equal(
      JSON.stringify(rows.find((row) => row.title === "Ada ring")).includes("Travis"),
      false,
    );
    assert.equal("priority" in (rows[0] ?? {}), false);
    assert.equal("today" in (rows[0] ?? {}), false);
    assert.equal("agentOs" in (rows[0] ?? {}), false);
  });
});
