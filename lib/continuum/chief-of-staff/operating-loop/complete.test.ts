import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { InMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import { createInMemoryProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import { completeFounderActionable, completionWriterFor } from "./complete";
import { composeCosOperatingLoop } from "./compose";
import { proposeRecapItems } from "./reconcile";
import { fixtureCandidate as candidate, fixtureProjects as projects } from "./fixtures";

const NOW = "2026-09-07T16:00:00.000Z";
const ACTOR = "justin";

async function seedWriter() {
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
    displayName: "Lee",
    givenName: "Lee",
    familyName: "Spiegel",
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
    displayTitle: "Lee / Spiegel",
    visibility: "internal-only",
    importRowKey: `cos-loop:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: null,
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

describe("CoS operating loop completion", () => {
  it("resolves an Open Job through the existing deterministic writer and records provenance", async () => {
    const seeded = await seedWriter();
    const created = await seeded.writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "commitment",
      subject: "Send Travis the revision",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const mutationId = randomUUID();
    const completed = await completeFounderActionable(seeded.writer, {
      sourceType: "open_job",
      projectId: seeded.projectId,
      jobId: created.job.jobId,
      mutationId,
      actor: ACTOR,
    });
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    assert.equal(completed.writer, "open_job.resolve");
    assert.equal(completed.job.state, "resolved");
    assert.equal(completed.resolvedAt, NOW);
    assert.equal(completed.provenance.mutationId, mutationId);
    assert.equal(completed.provenance.changedAt, NOW);
    assert.equal(completed.provenance.changedBy, ACTOR);
    assert.equal(completed.provenance.action, "resolve");
    const record = seeded.jobs.listMutations(created.job.jobId).find(
      (row) => row.mutationId === mutationId,
    );
    assert.equal(record?.action, "resolve");
    assert.equal(record?.changedAt, NOW);
    assert.equal(record?.changedBy, ACTOR);
    assert.equal(completionWriterFor("follow_up"), null);
  });

  it("refuses a generic complete-anything path for unsupported types", async () => {
    const seeded = await seedWriter();
    const created = await seeded.writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "request",
      subject: "Send CAD",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const refused = await completeFounderActionable(seeded.writer, {
      sourceType: "follow_up",
      projectId: seeded.projectId,
      jobId: created.job.jobId,
      mutationId: randomUUID(),
      actor: ACTOR,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.reason, "unsupported-writer");
    assert.equal(seeded.jobs.getJob(created.job.jobId)?.state, "open");
  });

  it("lets founder confirmation of a recap suggestion use the Open Job writer", async () => {
    const seeded = await seedWriter();
    const created = await seeded.writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "approval",
      subject: "Revision D approval",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const recap = proposeRecapItems({
      jobs: [created.job],
      candidates: [
        candidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          proposedTarget: { kind: "project", projectId: seeded.projectId },
          payload: {
            kind: "project_context",
            topic: "client_approval",
            value: "CAD looks great",
          },
        }),
      ],
      projects: projects(),
      newMutationId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    assert.equal(recap[0]?.completable, true);
    assert.equal(recap[0]?.writer, "open_job.resolve");
    const confirmed = await completeFounderActionable(seeded.writer, {
      sourceType: "open_job",
      projectId: seeded.projectId,
      jobId: created.job.jobId,
      mutationId: recap[0]!.mutationId!,
      actor: ACTOR,
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    assert.equal(confirmed.job.state, "resolved");
  });

  it("removes a completed job from Top 5 after the canonical write", async () => {
    const seeded = await seedWriter();
    const first = await seeded.writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "commitment",
      subject: "Call Lee",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    const second = await seeded.writer.createJob({
      mutationId: randomUUID(),
      projectId: seeded.projectId,
      kind: "request",
      subject: "Send render",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    const before = composeCosOperatingLoop({
      jobs: seeded.jobs.listJobs(),
      projects: projects(),
      nowIso: NOW,
    });
    assert.equal(before.top5.length, 2);
    await completeFounderActionable(seeded.writer, {
      sourceType: "open_job",
      projectId: seeded.projectId,
      jobId: before.top5[0]!.id,
      mutationId: randomUUID(),
      actor: ACTOR,
    });
    const after = composeCosOperatingLoop({
      jobs: seeded.jobs.listJobs(),
      projects: projects(),
      nowIso: NOW,
    });
    assert.equal(after.top5.some((row) => row.id === before.top5[0]!.id), false);
    assert.equal(after.top5.length, 1);
  });
});
