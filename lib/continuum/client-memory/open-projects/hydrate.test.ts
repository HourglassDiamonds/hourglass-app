import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { InMemoryProjectJobStore } from "../project-jobs/store";
import { createInMemoryProjectJobWriter } from "../project-jobs/writer";
import { composeCosOperatingLoop } from "../../chief-of-staff/operating-loop/compose";
import { COS_TOP_5_LIMIT } from "../../chief-of-staff/operating-loop/types";
import { completeFounderActionable } from "../../chief-of-staff/operating-loop/complete";
import type { CurrentProjectCard } from "./card";
import {
  canPromoteCurrentAction,
  explicitActionFromCurrentProject,
  lifecycleDoesNotCreateOpenJob,
} from "./hydrate";
import { founderManualActionInput } from "./manual-action";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = "2026-09-08T16:00:00.000Z";
const ACTOR = "justin";

function card(extra: Partial<CurrentProjectCard> = {}): CurrentProjectCard {
  return {
    projectId: PROJECT_A,
    title: "C. Binder",
    href: `/executive-dashboard/concierge/projects/${PROJECT_A}`,
    collapsedLine: "IN PRODUCTION",
    collapsedLineKind: "lifecycle",
    currentAction: {
      label: "IN PRODUCTION",
      detail: null,
      source: "lifecycle",
    },
    currentJobId: null,
    snapshot: [],
    latestFile: null,
    files: [],
    fileCount: 0,
    progress: [],
    lifecycleStage: "production",
    founderOwnedUnresolved: false,
    actionDueAt: null,
    waitingSince: null,
    updatedAt: null,
    ...extra,
  };
}

async function seedProject() {
  const memory = new InMemoryClientMemoryStore();
  const jobs = new InMemoryProjectJobStore();
  const writer = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
  const person = await memory.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await memory.insertPersonProfile({
    personId: person.record.id,
    displayName: "C. Binder",
    givenName: "C",
    familyName: "Binder",
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
  const project = await memory.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await memory.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: "C. Binder",
    visibility: "internal-only",
    importRowKey: `hydrate:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: "custom_new_jewelry",
  });
  await memory.insertRelationship({
    id: randomUUID(),
    fromEntityId: person.record.id,
    toEntityId: project.record.id,
    kind: "client-project",
    status: "active",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    createdBy: "test",
  });
  return { memory, jobs, writer, projectId: project.record.id };
}

describe("Current Projects Open Job hydration", () => {
  it("does not treat lifecycle or waiting-state labels as explicit next actions", () => {
    const lifecycle = card();
    assert.equal(canPromoteCurrentAction(lifecycle), false);
    assert.equal(explicitActionFromCurrentProject(lifecycle), null);
    assert.equal(lifecycleDoesNotCreateOpenJob(lifecycle), true);

    const waiting = card({
      title: "D. Doerner",
      collapsedLine: "WAITING FOR CLIENT APPROVAL",
      collapsedLineKind: "lifecycle",
      currentAction: {
        label: "WAITING FOR CLIENT APPROVAL",
        detail: null,
        source: "lifecycle",
      },
    });
    assert.equal(canPromoteCurrentAction(waiting), false);
    assert.equal(lifecycleDoesNotCreateOpenJob(waiting), true);
  });

  it("promotes only an explicit Open Job subject already on the accordion", () => {
    const jobCard = card({
      collapsedLine: "YOUR TURN — Confirm engraving",
      collapsedLineKind: "ownership",
      currentAction: {
        label: "YOUR TURN",
        detail: "Confirm engraving",
        source: "ownership",
      },
    });
    const explicit = explicitActionFromCurrentProject(jobCard);
    assert.equal(canPromoteCurrentAction(jobCard), true);
    assert.equal(explicit?.subject, "Confirm engraving");
    assert.equal(lifecycleDoesNotCreateOpenJob(jobCard), false);
  });

  it("feeds Top 5 from founder-created canonical Open Jobs and replenishes after complete", async () => {
    const seeded = await seedProject();
    const created = [];
    for (let index = 0; index < 6; index += 1) {
      const parsed = founderManualActionInput({
        mutationId: randomUUID(),
        projectId: seeded.projectId,
        subject: `Founder action ${index}`,
        actor: ACTOR,
      });
      assert.equal(parsed.ok, true);
      if (!parsed.ok) return;
      const result = await seeded.writer.createJob(parsed.input);
      assert.equal(result.ok && result.status, "created");
      if (result.ok) created.push(result.job);
    }
    const duplicate = founderManualActionInput({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      subject: "Founder action 0",
      actor: ACTOR,
    });
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok) return;
    const again = await seeded.writer.createJob(duplicate.input);
    assert.equal(again.ok && again.status, "already-present");
    assert.equal(seeded.jobs.listUnresolvedJobs(seeded.projectId).length, 6);

    const first = composeCosOperatingLoop({
      jobs: seeded.jobs.listJobs(),
      nowIso: NOW,
      newMutationId: () => randomUUID(),
    });
    assert.equal(first.status, "active");
    assert.equal(first.top5.length, COS_TOP_5_LIMIT);
    assert.equal(first.remainingCount, 1);
    assert.equal(new Set(first.top5.map((row) => row.id)).size, 5);

    const sixth = created[5]!.jobId;
    const completedId = first.top5.find((row) => row.id !== sixth)!.id;
    const completed = await completeFounderActionable(seeded.writer, {
      sourceType: "open_job",
      jobId: completedId,
      projectId: seeded.projectId,
      mutationId: randomUUID(),
      actor: ACTOR,
    });
    assert.equal(completed.ok, true);

    const next = composeCosOperatingLoop({
      jobs: seeded.jobs.listJobs(),
      nowIso: NOW,
      newMutationId: () => randomUUID(),
    });
    assert.equal(next.top5.length, 5);
    assert.equal(next.top5.some((row) => row.id === completedId), false);
    assert.equal(next.top5.some((row) => row.id === sixth), true);

    let remaining = seeded.jobs.listJobs();
    for (let step = 0; step < 10; step += 1) {
      const view = composeCosOperatingLoop({
        jobs: remaining.filter((row) => row.state === "open" || row.state === "snoozed"),
        nowIso: NOW,
      });
      if (view.status === "caught-up") break;
      const current = view.top5[0]!;
      await completeFounderActionable(seeded.writer, {
        sourceType: "open_job",
        jobId: current.id,
        projectId: seeded.projectId,
        mutationId: randomUUID(),
        actor: ACTOR,
      });
      remaining = seeded.jobs.listJobs();
    }
    const caught = composeCosOperatingLoop({
      jobs: seeded.jobs.listJobs().filter((row) => row.state === "open"),
      nowIso: NOW,
    });
    assert.equal(caught.status, "caught-up");
    assert.equal(caught.top5.length, 0);
  });

  it("does not auto-create Open Jobs from lifecycle-only Current Projects", async () => {
    const seeded = await seedProject();
    const lifecycle = card({ projectId: seeded.projectId });
    assert.equal(canPromoteCurrentAction(lifecycle), false);
    const parsed = founderManualActionInput({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      subject: lifecycle.currentAction.label,
      actor: ACTOR,
    });
    assert.equal(parsed.ok, false);
    assert.equal(seeded.jobs.listJobs().length, 0);
    const view = composeCosOperatingLoop({
      jobs: seeded.jobs.listJobs(),
      nowIso: NOW,
    });
    assert.equal(view.status, "caught-up");
  });

  it("keeps approved open_job Candidates on the existing createProjectJob writer", () => {
    const apply = readFileSync(
      join(ROOT, "lib/continuum/human-intake/review/apply.ts"),
      "utf8",
    );
    const proposeGmail = readFileSync(
      join(ROOT, "lib/continuum/gmail/candidates/propose.ts"),
      "utf8",
    );
    const proposeHuman = readFileSync(
      join(ROOT, "lib/continuum/human-intake/candidates/propose.ts"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/intake-review-actions.ts"),
      "utf8",
    );
    const gmailDir = join(ROOT, "lib/continuum/gmail/candidates");
    assert.match(apply, /preview.applyKind === "project_job"/);
    assert.match(apply, /deps.createProjectJob/);
    assert.match(actions, /createProjectJob: \(input\) => jobs.writer.createJob/);
    assert.match(proposeHuman, /createJob: false/);
    assert.match(proposeGmail, /createJob: false/);
    assert.doesNotMatch(proposeGmail, /createProjectJob\(/);
    const gmailPropose = readFileSync(join(gmailDir, "propose.ts"), "utf8");
    assert.doesNotMatch(gmailPropose, /createProjectJob\(/);
  });
});
