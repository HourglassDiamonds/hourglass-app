import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientWebsiteIntake } from "./read/website-intake";
import { InMemoryClientMemoryStore } from "./store";
import { InMemoryProjectJobStore } from "./project-jobs/store";
import { createInMemoryProjectJobWriter } from "./project-jobs/writer";
import { createInMemoryFounderProjectWriter } from "./founder-project/writer";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";
import { transitionWebsiteIntakeWithWriters } from "./website-intake-transition";
import {
  applyWebsiteIntakeLifecycle,
  websiteIntakeContactDetail,
  websiteIntakeDispositionFromDetail,
  websiteIntakeOperationId,
  websiteIntakeOpportunityPlan,
  websiteIntakeNextAction,
  withWebsiteIntakeDispositionMarker,
  withoutWebsiteIntakeDispositionMarker,
  type WebsiteIntakeLifecycleJob,
} from "./website-intake-lifecycle";

const cases = [
  ["Justin Smith", "test_submission", null],
  ["Lindsey Bleu Rice", "solicitation", null],
  ["Ty Sheffield", "contacted", "ty-project"],
  ["Morgan Jines", "contacted", "morgan-project"],
  ["Zane Kennedy", "contacted", "zane-project"],
] as const;

function intake(name: string, index: number): ClientWebsiteIntake {
  return {
    intakeId: `00000000-0000-4000-8000-00000000000${index}`,
    jobId: `10000000-0000-4000-8000-00000000000${index}`,
    status: "ready",
    identityStatus: "matched",
    personId: `20000000-0000-4000-8000-00000000000${index}`,
    fullName: name,
    email: `${index}@example.test`,
    phone: null,
    preferredContactMethod: "email",
    category: "engagement_ring",
    projectType: "Engagement Ring",
    shapeInterest: "",
    designDirection: "",
    ringPresence: "",
    timeline: "",
    budgetRange: "",
    inspirationNotes: "",
    attribution: {},
    source: "representative-preview-fixture",
    submittedAt: "2026-10-21T12:00:00.000Z",
    lifecycle: {
      disposition: "new",
      label: "New inquiry",
      activeJobId: `10000000-0000-4000-8000-00000000000${index}`,
      jobState: "open",
      projectId: null,
      projectTitle: null,
      projectStage: null,
    },
    correspondenceReview: index >= 3 ? {
      candidateId: `30000000-0000-4000-8000-00000000000${index}`,
      status: "approved",
      confidence: "high",
      sourceTimestamp: "2026-10-24T16:00:27.000Z",
    } : null,
  };
}

describe("website intake CRM lifecycle", () => {
  it("durably transitions all five representative founder cases through the real CRM writers", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobStore = new InMemoryProjectJobStore();
    const now = () => "2026-10-27T14:00:00.000Z";
    const jobs = createInMemoryProjectJobWriter(memory, jobStore, now);
    const projects = createInMemoryFounderProjectWriter(memory, jobStore, now);
    const rows: ClientWebsiteIntake[] = [];
    for (const [name, disposition] of cases) {
      const index = rows.length;
      const entity = await memory.insertEntity({ kind: "person", createdAt: now(), createdBy: "fixture" });
      await memory.insertPersonProfile({
        personId: entity.record.id,
        displayName: name,
        givenName: name.split(" ")[0]!,
        familyName: name.split(" ").slice(1).join(" "),
        organizationName: null,
        email: `${index}@example.test`,
        phone: null,
        streetAddress: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        roles: ["prospect"],
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: now(),
        updatedAt: now(),
      });
      const base = { ...intake(name, index), personId: entity.record.id };
      const created = await jobs.createJob({
        mutationId: websiteIntakeOperationId(base.intakeId, "fixture:create"),
        projectId: null,
        kind: "required_action",
        subject: `Website inquiry — ${name}`,
        detail: "Original source-grounded inquiry.",
        waitingOnActor: "founder",
        associatedPersonId: entity.record.id,
        actor: "founder",
        sourceSystem: "continuum",
        sourceRef: `website-intake:${base.intakeId}`,
      });
      assert.equal(created.ok, true);
      if (!created.ok) continue;
      const row = {
        ...base,
        jobId: created.job.jobId,
        lifecycle: { ...base.lifecycle, activeJobId: created.job.jobId },
        correspondenceReview: name === "Morgan Jines" || name === "Zane Kennedy"
          ? { candidateId: `candidate-${index}`, status: "approved" as const, confidence: "high" as const, sourceTimestamp: now() }
          : null,
      };
      const result = await transitionWebsiteIntakeWithWriters({
        intake: row,
        disposition,
        jobs,
        projects,
        actor: "founder",
        nextActionOwner: name === "Ty Sheffield" ? "founder" : name === "Morgan Jines" ? "unknown" : "client",
      });
      assert.equal(result.ok, true, name);
      rows.push(row);
    }

    const projectRows = await Promise.all(rows.map(async (row) => projects.listActiveClientProjects(row.personId!)));
    assert.deepEqual(projectRows.map((projectsForPerson) => projectsForPerson.length), [0, 0, 1, 1, 1]);
    const snapshots: WebsiteIntakeLifecycleJob[] = jobStore.listJobs().map((job) => ({
      jobId: job.jobId,
      projectId: job.projectId,
      state: job.state,
      detail: job.detail,
      sourceRef: job.sourceRef,
    }));
    const refreshed = applyWebsiteIntakeLifecycle(rows, snapshots);
    assert.deepEqual(refreshed.map((row) => row.lifecycle.disposition), cases.map(([, disposition]) => disposition));
    assert.equal(refreshed.filter((row) => row.lifecycle.activeJobId).length, 0);
    assert.deepEqual(
      jobStore.listJobs().filter((job) => job.sourceRef?.startsWith("website-intake-contact:")).map((job) => job.waitingOnActor).sort(),
      ["client", "founder", "unknown"],
    );
    for (const row of rows.slice(2)) {
      const linked = (await projects.listActiveClientProjects(row.personId!))[0]!;
      assert.equal((await memory.getProjectLifecycleState(linked.projectId, "custom_new_jewelry"))?.stage, "discovery");
    }
  });

  it("reconstructs the five founder-declared cases after refresh and removes all from New Concierge", () => {
    const intakes = cases.map(([name], index) => intake(name, index));
    const jobs: WebsiteIntakeLifecycleJob[] = cases.flatMap(([, disposition, projectId], index) => {
      const intakeId = intakes[index]!.intakeId;
      const terminal: WebsiteIntakeLifecycleJob = {
        jobId: intakes[index]!.jobId!,
        projectId: null,
        state: disposition === "contacted" ? "resolved" : "cancelled",
        detail: withWebsiteIntakeDispositionMarker("Original inquiry retained.", disposition),
        sourceRef: `website-intake:${intakeId}`,
      };
      return projectId ? [
        terminal,
        {
          jobId: `40000000-0000-4000-8000-00000000000${index}`,
          projectId,
          state: "open",
          detail: websiteIntakeContactDetail({ correspondenceApproved: index >= 3, nextActionOwner: index === 2 ? "founder" : index === 3 ? "unknown" : "client" }),
          sourceRef: `website-intake-contact:${intakeId}`,
        },
      ] : [terminal];
    });
    const titles = new Map(cases.flatMap(([name, , projectId]) => projectId ? [[projectId, `${name} — Engagement Ring`] as const] : []));
    const stages = new Map(cases.flatMap(([, , projectId]) => projectId ? [[projectId, "discovery"] as const] : []));
    const refreshed = applyWebsiteIntakeLifecycle(intakes, jobs, titles, stages);

    assert.deepEqual(refreshed.map((row) => [row.fullName, row.lifecycle.disposition]), cases.map(([name, disposition]) => [name, disposition]));
    assert.equal(refreshed.filter((row) => row.lifecycle.disposition === "new" && row.lifecycle.activeJobId).length, 0);
    assert.deepEqual(refreshed.filter((row) => row.lifecycle.projectId).map((row) => row.fullName), ["Ty Sheffield", "Morgan Jines", "Zane Kennedy"]);
    assert.ok(refreshed.filter((row) => row.lifecycle.projectId).every((row) => row.lifecycle.projectStage === "discovery"));
  });

  it("restores a dismissed inquiry with a new active job without deleting its prior history", () => {
    const original = intake("Justin Smith", 0);
    const dismissed: WebsiteIntakeLifecycleJob = {
      jobId: original.jobId!,
      projectId: null,
      state: "cancelled",
      detail: withWebsiteIntakeDispositionMarker("Founder smoke test.", "test_submission"),
      sourceRef: `website-intake:${original.intakeId}`,
    };
    const before = applyWebsiteIntakeLifecycle([original], [dismissed])[0]!;
    assert.equal(before.lifecycle.disposition, "test_submission");
    const restored: WebsiteIntakeLifecycleJob = {
      ...dismissed,
      jobId: "50000000-0000-4000-8000-000000000000",
      state: "open",
      detail: withoutWebsiteIntakeDispositionMarker(dismissed.detail),
    };
    const after = applyWebsiteIntakeLifecycle([original], [restored, dismissed])[0]!;
    assert.equal(after.lifecycle.disposition, "new");
    assert.equal(after.lifecycle.activeJobId, restored.jobId);
    assert.equal(websiteIntakeDispositionFromDetail(dismissed.detail), "test_submission");
  });

  it("creates stable operations and never fabricates correspondence when none is verified", () => {
    assert.equal(websiteIntakeOperationId("abc", "contacted:project"), websiteIntakeOperationId("abc", "contacted:project"));
    assert.match(websiteIntakeOperationId("abc", "contacted:project"), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.match(websiteIntakeContactDetail({ correspondenceApproved: false, nextActionOwner: "unknown" }), /does not claim an email was sent/);
    assert.deepEqual(websiteIntakeNextAction({ fullName: "Ty Sheffield", projectType: "Engagement Ring", owner: "founder" }), {
      subject: "Follow up with Ty Sheffield about Engagement Ring",
      waitingOnActor: "founder",
    });
    assert.deepEqual(websiteIntakeNextAction({ fullName: "Morgan Jines", projectType: "Engagement Ring", owner: "unknown" }), {
      subject: "Clarify the next step for Morgan Jines about Engagement Ring",
      waitingOnActor: "unknown",
    });
    const plan = websiteIntakeOpportunityPlan({ fullName: "Zane Kennedy", category: "wedding_bands", projectType: "Wedding Band" });
    assert.equal(plan.projectKind, "custom_new_jewelry");
    assert.equal(plan.lifecycleStage, "discovery");
  });
});
