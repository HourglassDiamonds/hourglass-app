import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { InMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import { createInMemoryProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import { createInMemoryClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/writer";
import { composeTodayDocket } from "./docket";
import { composeCosOperatingLoop } from "./compose";
import { disposeDocketItem } from "./disposition";
import { fixtureCandidate, fixtureJob, COS_LOOP_NOW } from "./fixtures";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { CosProjectContext } from "./types";

const ACTOR = "justin";
const NOW = COS_LOOP_NOW;

async function seedWorld(fingerSize = "12.5") {
  const memory = new InMemoryClientMemoryStore();
  const jobs = new InMemoryProjectJobStore();
  const jobWriter = createInMemoryProjectJobWriter(memory, jobs, () => NOW);
  const specWriter = createInMemoryClientMemoryProjectSpecWriter(memory);
  const person = await memory.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await memory.insertPersonProfile({
    personId: person.record.id,
    displayName: "Travis Morse",
    givenName: "Travis",
    familyName: "Morse",
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
    displayTitle: "Chicken ring",
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
  await memory.insertProjectHistory({
    projectId: project.record.id,
    cadJobNumber: null,
    orderNumber: null,
    gmailThreadId: "abc123def0",
    matchJudgment: "exact",
    matchJudgmentRaw: "Exact",
    fingerSize,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return {
    memory,
    jobs,
    jobWriter,
    specWriter,
    projectId: project.record.id,
    personId: person.record.id,
  };
}

function specCandidate(
  projectId: string,
  extra: Partial<ContinuumCandidate> = {},
): ContinuumCandidate {
  return fixtureCandidate({
    candidateId: extra.candidateId ?? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    candidateType: "structured_spec",
    candidateState: "conflict",
    sourceRef: "gc1|abc123def0|aaa111bbb2",
    proposedTarget: { kind: "project_spec", projectId, fieldName: "finger_size" },
    payload: {
      kind: "structured_spec",
      fieldName: "finger_size",
      proposedValue: "11",
      currentValue: "12.5",
      conflict: true,
    },
    evidenceBasis: {
      ruleIds: ["spec_conflict_review_required"],
      matchedText: "I'm an 11 now",
    },
    ...extra,
  });
}

function projectsOf(projectId: string): Map<string, CosProjectContext> {
  return new Map([
    [
      projectId,
      {
        projectId,
        title: "Chicken ring",
        personName: "Travis Morse",
        people: [{ personId: "person", displayName: "Travis Morse", role: "client" }],
        isCurrent: true,
        specs: [{ fieldName: "finger_size", value: "12.5" }],
        gmailThreadId: "abc123def0",
      },
    ],
  ]);
}

describe("Today founder disposition", () => {
  it("records Keep without mutating canonical finger size", async () => {
    const world = await seedWorld();
    const store = new InMemoryCandidateStore();
    const candidate = specCandidate(world.projectId);
    await store.replace(candidate);
    const result = await disposeDocketItem(
      {
        nowIso: () => NOW,
        candidates: store,
        jobs: world.jobWriter,
        correctProjectSpec: (input) => world.specWriter.correctProjectSpec(input),
      },
      {
        verb: "keep_canonical",
        origin: "brief",
        itemId: "brief:project",
        projectId: world.projectId,
        jobId: null,
        candidateIds: [candidate.candidateId],
        specFieldName: "finger_size",
        mutationId: randomUUID(),
        actor: ACTOR,
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mutatedSpec, false);
    const saved = await store.get(candidate.candidateId);
    assert.equal(saved?.reviewStatus, "discarded");
    assert.equal(saved?.lastReviewAction, "discard");
    assert.equal(saved?.reviewedAt, NOW);
    assert.equal(saved?.candidateState, "conflict");
    assert.equal((await world.memory.getProjectHistory(world.projectId))?.fingerSize, "12.5");
  });

  it("updates canonical finger size only through correctProjectSpec after founder confirmation", async () => {
    const world = await seedWorld();
    const store = new InMemoryCandidateStore();
    const candidate = specCandidate(world.projectId);
    await store.replace(candidate);
    const result = await disposeDocketItem(
      {
        nowIso: () => NOW,
        candidates: store,
        jobs: world.jobWriter,
        correctProjectSpec: (input) => world.specWriter.correctProjectSpec(input),
      },
      {
        verb: "adopt_evidence",
        origin: "brief",
        itemId: "brief:project",
        projectId: world.projectId,
        jobId: null,
        candidateIds: [candidate.candidateId],
        specFieldName: "finger_size",
        specProposedValue: "11",
        mutationId: randomUUID(),
        actor: ACTOR,
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mutatedSpec, true);
    assert.equal((await world.memory.getProjectHistory(world.projectId))?.fingerSize, "11");
    assert.equal((await store.get(candidate.candidateId))?.reviewStatus, "approved");
    const refused = await disposeDocketItem(
      {
        nowIso: () => NOW,
        candidates: store,
        correctProjectSpec: (input) => world.specWriter.correctProjectSpec(input),
      },
      {
        verb: "adopt_evidence",
        origin: "brief",
        itemId: "brief:project",
        projectId: world.projectId,
        jobId: null,
        candidateIds: [candidate.candidateId],
        specFieldName: "finger_size",
        specProposedValue: "fourteen",
        mutationId: randomUUID(),
        actor: ACTOR,
      },
    );
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.reason, "unsupported-mutation");
    assert.equal((await world.memory.getProjectHistory(world.projectId))?.fingerSize, "11");
  });

  it("parks Need to verify without picking a spec value, then replenishes UP NEXT", async () => {
    const world = await seedWorld();
    const secondProject = await world.memory.insertEntity({
      kind: "project",
      createdAt: NOW,
      createdBy: "test",
    });
    await world.memory.insertProjectProfile({
      projectId: secondProject.record.id,
      displayTitle: "Band",
      visibility: "internal-only",
      importRowKey: `cos-loop:${randomUUID()}`,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
      projectKind: null,
    });
    await world.memory.insertProjectHistory({
      projectId: secondProject.record.id,
      cadJobNumber: null,
      orderNumber: null,
      gmailThreadId: "def456aaa0",
      matchJudgment: "exact",
      matchJudgmentRaw: "Exact",
      fingerSize: "6",
      metal: null,
      centerStone: null,
      diamondSupplyNotes: null,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const store = new InMemoryCandidateStore();
    const first = specCandidate(world.projectId);
    const second = specCandidate(secondProject.record.id, {
      candidateId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      sourceRef: "gc1|def456aaa0|bbb222ccc3",
      payload: {
        kind: "structured_spec",
        fieldName: "finger_size",
        proposedValue: "7",
        currentValue: "6",
        conflict: true,
      },
    });
    await store.replace(first);
    await store.replace(second);
    const map = projectsOf(world.projectId);
    map.set(secondProject.record.id, {
      projectId: secondProject.record.id,
      title: "Band",
      personName: "Lee",
      people: [{ personId: "person-2", displayName: "Lee", role: "client" }],
      isCurrent: true,
      specs: [{ fieldName: "finger_size", value: "6" }],
      gmailThreadId: "def456aaa0",
    });
    const before = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: [],
        candidates: await store.list(),
        projects: map,
        nowIso: NOW,
      }),
    );
    assert.equal(before.items.length, 2);
    const firstId = before.items[0]!.id;
    const parked = await disposeDocketItem(
      {
        nowIso: () => NOW,
        candidates: store,
      },
      {
        verb: "need_to_verify",
        origin: "brief",
        itemId: firstId,
        projectId: before.items[0]!.brief?.projectId ?? world.projectId,
        jobId: null,
        candidateIds: before.items[0]!.brief?.candidateIds ?? [first.candidateId],
        specFieldName: "finger_size",
        mutationId: randomUUID(),
        actor: ACTOR,
        snoozeUntil: "2026-09-12T00:00:00.000Z",
      },
    );
    assert.equal(parked.ok, true);
    const after = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: [],
        candidates: await store.list(),
        projects: map,
        nowIso: NOW,
      }),
    );
    assert.equal(after.items.some((item) => item.id === firstId), false);
    assert.equal(after.items.length, 1);
    assert.equal((await world.memory.getProjectHistory(world.projectId))?.fingerSize, "12.5");
    const later = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: [],
        candidates: await store.list(),
        projects: map,
        nowIso: "2026-09-12T16:00:00.000Z",
      }),
    );
    assert.equal(later.items.some((item) => item.id === firstId), true);
  });

  it("records disregard without deleting candidate evidence or project history", async () => {
    const world = await seedWorld();
    const store = new InMemoryCandidateStore();
    const candidate = specCandidate(world.projectId);
    await store.replace(candidate);
    const result = await disposeDocketItem(
      {
        nowIso: () => NOW,
        candidates: store,
      },
      {
        verb: "disregard",
        origin: "brief",
        itemId: "brief:project",
        projectId: world.projectId,
        jobId: null,
        candidateIds: [candidate.candidateId],
        mutationId: randomUUID(),
        actor: ACTOR,
      },
    );
    assert.equal(result.ok, true);
    const saved = await store.get(candidate.candidateId);
    assert.ok(saved);
    assert.equal(saved?.reviewStatus, "discarded");
    assert.equal(saved?.payload.kind, "structured_spec");
    assert.equal((await world.memory.getProjectHistory(world.projectId))?.fingerSize, "12.5");
  });

  it("snoozes an Open Job off UP NEXT and completes the next queued job", async () => {
    const world = await seedWorld();
    const first = await world.jobWriter.createJob({
      mutationId: randomUUID(),
      projectId: world.projectId,
      kind: "required_action",
      subject: "Call the setter",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    const second = await world.jobWriter.createJob({
      mutationId: randomUUID(),
      projectId: world.projectId,
      kind: "request",
      subject: "Send the recap",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    const third = await world.jobWriter.createJob({
      mutationId: randomUUID(),
      projectId: world.projectId,
      kind: "commitment",
      subject: "Confirm shop ETA",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    const fourth = await world.jobWriter.createJob({
      mutationId: randomUUID(),
      projectId: world.projectId,
      kind: "question",
      subject: "Ask about engraving",
      waitingOnActor: "founder",
      actor: ACTOR,
    });
    assert.equal(first.ok && second.ok && third.ok && fourth.ok, true);
    if (!first.ok || !second.ok || !third.ok || !fourth.ok) return;
    const map = projectsOf(world.projectId);
    const before = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: world.jobs.listJobs(),
        projects: map,
        nowIso: NOW,
      }),
    );
    assert.equal(before.items.length, 3);
    const queuedBefore = before.queuedCount;
    const topId = before.items[0]!.id;
    const snoozed = await disposeDocketItem(
      {
        nowIso: () => NOW,
        jobs: world.jobWriter,
      },
      {
        verb: "snooze",
        origin: "open_job",
        itemId: topId,
        projectId: world.projectId,
        jobId: topId,
        candidateIds: [],
        mutationId: randomUUID(),
        actor: ACTOR,
        snoozeUntil: "2026-09-16T00:00:00.000Z",
      },
    );
    assert.equal(snoozed.ok, true);
    const afterSnooze = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: world.jobs.listJobs(),
        projects: map,
        nowIso: NOW,
      }),
    );
    assert.equal(afterSnooze.items.some((item) => item.id === topId), false);
    assert.equal(afterSnooze.items.length, 3);
    assert.ok(afterSnooze.queuedCount <= queuedBefore);
    const nextId = afterSnooze.items[0]!.id;
    const completed = await disposeDocketItem(
      {
        nowIso: () => NOW,
        jobs: world.jobWriter,
      },
      {
        verb: "complete",
        origin: "open_job",
        itemId: nextId,
        projectId: world.projectId,
        jobId: nextId,
        candidateIds: [],
        mutationId: randomUUID(),
        actor: ACTOR,
      },
    );
    assert.equal(completed.ok, true);
    const afterComplete = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: world.jobs.listJobs(),
        projects: map,
        nowIso: NOW,
      }),
    );
    assert.equal(afterComplete.items.some((item) => item.id === nextId), false);
    assert.equal(world.jobs.getJob(nextId)?.state, "resolved");
    assert.equal(world.jobs.getJob(topId)?.state, "snoozed");
  });

  it("does not treat a fixture job helper as live seed", () => {
    const job = fixtureJob({
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      subject: "unused",
    });
    assert.equal(job.state, "open");
  });
});
