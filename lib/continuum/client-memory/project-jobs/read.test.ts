import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  CLIENT_MEMORY_SOURCE_SYSTEM,
  type ProjectProfile,
} from "../types";
import { getProjectDeskFromSnapshot } from "../project-desk/compose";
import type { ProjectDeskSnapshot } from "../project-desk/types";
import type { ProjectJob } from "./types";
import { rowToProjectJob } from "./rows";
import { openJobsReadModel } from "./read";

const NOW = "2026-09-05T16:00:00.000Z";

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

function job(
  projectId: string,
  extra: Partial<ProjectJob> & Pick<ProjectJob, "jobId" | "subject" | "kind" | "state">,
): ProjectJob {
  const row: ProjectJob = {
    projectId,
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: null,
    dueAt: null,
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: "justin",
    sourceSystem: "concierge-manual",
    sourceRef: null,
    createdMutationId: randomUUID(),
    ...extra,
  };
  if (row.state === "snoozed" && row.deferredUntil == null) {
    row.deferredUntil = NOW;
  }
  if (row.state === "resolved" && row.resolvedAt == null) {
    row.resolvedAt = NOW;
  }
  if (row.state === "cancelled" && row.cancelledAt == null) {
    row.cancelledAt = NOW;
  }
  return row;
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

describe("Open Job read model", () => {
  it("treats a missing jobs load as disconnected, not empty", () => {
    const project = profile("Unknown ring");
    const desk = getProjectDeskFromSnapshot(
      snapshot({ projectProfiles: [project] }),
      project.projectId,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok) return;
    assert.equal(desk.desk.openJobs.connected, false);
    assert.equal(desk.desk.coverage.jobs, "not-connected");
  });

  it("shows zero, one, and multiple unresolved jobs without inventing waiting-on", () => {
    const project = profile("Active ring");
    const empty = getProjectDeskFromSnapshot(
      snapshot({ projectProfiles: [project], projectJobs: [] }),
      project.projectId,
    );
    assert.equal(empty.ok && empty.desk.openJobs.connected, true);
    assert.equal(empty.ok && empty.desk.coverage.jobs, "none");
    assert.equal(empty.ok && empty.desk.operationalStatus.kind, "unknown");

    const oneId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const twoId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const many = getProjectDeskFromSnapshot(
      snapshot({
        projectProfiles: [project],
        projectJobs: [
          job(project.projectId, {
            jobId: oneId,
            kind: "request",
            subject: "Need metal confirmation",
            state: "open",
            waitingOnActor: "client",
            createdAt: "2026-09-01T00:00:00.000Z",
          }),
          job(project.projectId, {
            jobId: twoId,
            kind: "commitment",
            subject: "Revise CAD",
            state: "open",
            waitingOnActor: "founder",
            createdAt: "2026-09-02T00:00:00.000Z",
          }),
        ],
      }),
      project.projectId,
    );
    assert.equal(many.ok, true);
    if (!many.ok) return;
    assert.equal(many.desk.openJobs.connected, true);
    if (!many.desk.openJobs.connected) return;
    assert.deepEqual(
      many.desk.openJobs.unresolved.map((row) => row.subject),
      ["Revise CAD", "Need metal confirmation"],
    );
    assert.equal(many.desk.coverage.jobs, "available");
    assert.doesNotMatch(
      many.desk.operationalStatus.evidence,
      /Waiting on|No Current Action|overdue/i,
    );
    assert.equal(many.desk.artifacts.connected, false);
  });

  it("excludes resolved and cancelled history from the unresolved read", () => {
    const project = profile("History ring");
    const openId = randomUUID();
    const jobs: ProjectJob[] = [
      job(project.projectId, {
        jobId: openId,
        kind: "approval",
        subject: "Approve render",
        state: "open",
        waitingOnActor: "client",
      }),
      job(project.projectId, {
        jobId: randomUUID(),
        kind: "request",
        subject: "Old request",
        state: "resolved",
        waitingOnActor: "hourglass",
      }),
      job(project.projectId, {
        jobId: randomUUID(),
        kind: "question",
        subject: "Cancelled question",
        state: "cancelled",
        waitingOnActor: "unknown",
      }),
    ];
    const desk = getProjectDeskFromSnapshot(
      snapshot({ projectProfiles: [project], projectJobs: jobs }),
      project.projectId,
    );
    assert.equal(desk.ok, true);
    if (!desk.ok || !desk.desk.openJobs.connected) return;
    assert.deepEqual(
      desk.desk.openJobs.unresolved.map((row) => row.jobId),
      [openId],
    );
    const model = openJobsReadModel(jobs, project.projectId, []);
    assert.equal(model.connected, true);
    if (!model.connected) return;
    assert.equal(model.unresolvedCount, 1);
  });

  it("keeps same-title Projects isolated and does not leak source_ref into the desk", () => {
    const first = profile("Oval ring");
    const second = profile("Oval ring");
    const person = { personId: randomUUID(), displayName: "Ada" };
    const jobs: ProjectJob[] = [
      job(first.projectId, {
        jobId: randomUUID(),
        kind: "blocked_issue",
        subject: "Vendor wax delay",
        state: "open",
        waitingOnActor: "vendor",
        associatedPersonId: person.personId,
        sourceRef: "gmail:thread:secret-thread",
      }),
      job(second.projectId, {
        jobId: randomUUID(),
        kind: "required_action",
        subject: "Other project action",
        state: "snoozed",
        waitingOnActor: "founder",
        deferredUntil: "2026-09-20T00:00:00.000Z",
      }),
    ];
    const data = snapshot({
      projectProfiles: [first, second],
      people: [person],
      relationships: [
        {
          id: randomUUID(),
          fromEntityId: person.personId,
          toEntityId: first.projectId,
          kind: "client-project",
          status: "active",
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          createdBy: "test",
        },
      ],
      projectJobs: jobs,
    });
    const deskA = getProjectDeskFromSnapshot(data, first.projectId);
    const deskB = getProjectDeskFromSnapshot(data, second.projectId);
    assert.equal(deskA.ok && deskB.ok, true);
    if (!deskA.ok || !deskB.ok) return;
    assert.equal(deskA.desk.openJobs.connected, true);
    assert.equal(deskB.desk.openJobs.connected, true);
    if (!deskA.desk.openJobs.connected || !deskB.desk.openJobs.connected) return;
    assert.deepEqual(
      deskA.desk.openJobs.unresolved.map((row) => row.subject),
      ["Vendor wax delay"],
    );
    assert.deepEqual(
      deskB.desk.openJobs.unresolved.map((row) => row.subject),
      ["Other project action"],
    );
    assert.equal(JSON.stringify(deskA.desk.openJobs).includes("secret-thread"), false);
    assert.equal(deskA.desk.openJobs.unresolved[0]?.associatedPersonName, "Ada");
  });

  it("drops invalid rows instead of inferring a job", () => {
    const mapped = rowToProjectJob({
      job_id: randomUUID(),
      project_id: randomUUID(),
      kind: "todo",
      subject: "Not a job",
      waiting_on_actor: "founder",
      state: "open",
      created_at: NOW,
      updated_at: NOW,
      created_by: "justin",
      source_system: "concierge-manual",
      created_mutation_id: randomUUID(),
    });
    assert.equal(mapped, null);
    const body = rowToProjectJob({
      job_id: randomUUID(),
      project_id: randomUUID(),
      kind: "request",
      subject: "Need CAD",
      waiting_on_actor: "founder",
      state: "open",
      created_at: NOW,
      updated_at: NOW,
      created_by: "justin",
      source_system: "concierge-manual",
      source_ref: "From: ada\n\nPlease send the CAD and the quote.",
      created_mutation_id: randomUUID(),
    });
    assert.equal(body, null);
  });
});
