import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import {
  applyFounderReview,
  effectiveCandidatePayload,
} from "@/lib/continuum/candidates/review";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { createInMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import { createInMemoryHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/store";
import type { HumanSourceNameLookup } from "@/lib/continuum/client-memory/human-intake/store";
import { ingestHumanIntakeCandidates } from "../candidates/ingest";
import { reviewHumanIntakeCandidate } from "./apply";
import { createMemoryHumanIntakeReviewDeps } from "./memory";
import { humanIntakeJobSourceRef } from "./apply";

const NOW = "2026-08-25T17:00:00.000Z";
const ACTOR = "justin";

async function seed(store: InMemoryClientMemoryStore) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  const other = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "Sarah Chen",
    givenName: "Sarah",
    familyName: "Chen",
    organizationName: null,
    email: "sarah.chen@example.com",
    phone: "305-555-0100",
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
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: "Oval ring",
    visibility: "internal-only",
    importRowKey: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await store.insertProjectProfile({
    projectId: other.record.id,
    displayTitle: "Other ring",
    visibility: "internal-only",
    importRowKey: "other-ring",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
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
  await store.insertProjectHistory({
    projectId: project.record.id,
    cadJobNumber: null,
    orderNumber: null,
    gmailThreadId: null,
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: "6",
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return {
    personId: person.record.id,
    projectId: project.record.id,
    otherProjectId: other.record.id,
  };
}

function names(store: InMemoryClientMemoryStore): HumanSourceNameLookup {
  return {
    getEntity: (id) => store.getEntity(id),
    getPersonName: async (id) =>
      (await store.getPersonProfile(id))?.displayName ?? null,
    getProjectTitle: async (id) =>
      (await store.getProjectProfile(id))?.displayTitle ?? null,
  };
}

describe("Human intake founder review", () => {
  it("approves a note through the existing writer and keeps provenance", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const before = await memory.inspectCounts();
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "She likes Render 2 but wants the cathedral lower.",
      reportedCommunicationType: "call",
      personId: ids.personId,
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.projectId, title: "Oval ring" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "She likes Render 2 but wants the cathedral lower.",
        confirmedPersonIds: [ids.personId],
        confirmedProjectIds: [ids.projectId],
      },
    });
    const note = (await candidates.list()).find((row) => row.candidateType === "note");
    assert.ok(note);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const result = await reviewHumanIntakeCandidate(deps, {
      candidateId: note!.candidateId,
      action: "approve",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "applied");
    assert.equal(result.appliedRecordKind, "source_note");
    assert.match(result.preview.summary, /kept note/);
    const saved = await candidates.get(note!.candidateId);
    assert.equal(saved?.reviewStatus, "approved");
    assert.equal(saved?.lastReviewAction, "approve");
    assert.equal(saved?.canonical, false);
    const after = await memory.inspectCounts();
    assert.equal(after.notes, before.notes + 1);
    assert.equal(after.persons, before.persons);
    assert.equal(jobs.listJobs().length, 0);
  });

  it("creates an Open Job only on approve and records intake provenance", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "I'll send the revision tomorrow.",
      reportedCommunicationType: "call",
      personId: ids.personId,
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.projectId, title: "Oval ring" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "I'll send the revision tomorrow.",
        confirmedPersonIds: [ids.personId],
        confirmedProjectIds: [ids.projectId],
      },
    });
    const commitment = (await candidates.list()).find(
      (row) =>
        row.payload.kind === "open_job" && row.payload.jobKind === "commitment",
    );
    assert.ok(commitment);
    assert.equal(commitment?.payload.kind, "open_job");
    if (commitment?.payload.kind === "open_job") {
      assert.equal(commitment.payload.createJob, false);
    }
    const jobs = createInMemoryProjectJobStore();
    assert.equal(jobs.listJobs().length, 0);
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const result = await reviewHumanIntakeCandidate(deps, {
      candidateId: commitment!.candidateId,
      action: "approve",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.appliedRecordKind, "project_job");
    const created = jobs.getJob(result.appliedRecordId ?? "");
    assert.ok(created);
    assert.equal(created?.projectId, ids.projectId);
    assert.equal(
      created?.sourceRef,
      humanIntakeJobSourceRef(ingested.sourceId, commitment!.candidateId),
    );
    assert.equal(created?.sourceSystem, "concierge-manual");
    const after = await candidates.get(commitment!.candidateId);
    assert.equal(after?.payload.kind, "open_job");
    if (after?.payload.kind === "open_job") {
      assert.equal(after.payload.createJob, false);
    }
  });

  it("shows structured-spec conflict before write and requires explicit approval", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "Finger size is 6.5.",
      reportedCommunicationType: "call",
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [],
        projects: [
          {
            projectId: ids.projectId,
            title: "Oval ring",
            fingerSize: "6",
          },
        ],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "Finger size is 6.5.",
        confirmedProjectIds: [ids.projectId],
      },
    });
    const spec = (await candidates.list()).find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.ok(spec);
    assert.equal(spec?.candidateState, "conflict");
    assert.equal(spec?.payload.kind, "structured_spec");
    if (spec?.payload.kind === "structured_spec") {
      assert.equal(spec.payload.currentValue, "6");
      assert.equal(spec.payload.proposedValue, "6.5");
      assert.equal(spec.payload.conflict, true);
    }
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const result = await reviewHumanIntakeCandidate(deps, {
      candidateId: spec!.candidateId,
      action: "approve",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.preview.conflict, true);
    assert.match(result.preview.summary, /Current canonical value/);
    const history = await memory.getProjectHistory(ids.projectId);
    assert.equal(history?.fingerSize, "6.5");
  });

  it("stores edit as overlay provenance without a standalone edit status", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "Finger size is 6.5.",
      reportedCommunicationType: "call",
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [],
        projects: [{ projectId: ids.projectId, title: "Oval ring", fingerSize: "6" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "Finger size is 6.5.",
        confirmedProjectIds: [ids.projectId],
      },
    });
    const spec = (await candidates.list()).find(
      (row) => row.payload.kind === "structured_spec",
    );
    assert.ok(spec);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const result = await reviewHumanIntakeCandidate(deps, {
      candidateId: spec!.candidateId,
      action: "edit",
      actor: ACTOR,
      mutationId: randomUUID(),
      edits: { specValue: "6.25" },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "edited");
    assert.equal(result.record.reviewStatus, "pending");
    assert.equal(result.record.lastReviewAction, "edit");
    assert.equal(result.record.payload.kind, "structured_spec");
    if (result.record.payload.kind === "structured_spec") {
      assert.equal(result.record.payload.proposedValue, "6.5");
    }
    const effective = effectiveCandidatePayload(result.record);
    assert.equal(effective.kind, "structured_spec");
    if (effective.kind === "structured_spec") {
      assert.equal(effective.proposedValue, "6.25");
    }
    const history = await memory.getProjectHistory(ids.projectId);
    assert.equal(history?.fingerSize, "6");
  });

  it("refuses cross-project Open Job apply and does not mint Persons", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "I'll send the revision tomorrow.",
      reportedCommunicationType: "call",
      personId: ids.personId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.otherProjectId, title: "Other ring" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "I'll send the revision tomorrow.",
        confirmedPersonIds: [ids.personId],
      },
    });
    const commitment = (await candidates.list()).find(
      (row) => row.candidateType === "open_job",
    );
    assert.ok(commitment);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const result = await reviewHumanIntakeCandidate(deps, {
      candidateId: commitment!.candidateId,
      action: "approve",
      actor: ACTOR,
      mutationId: randomUUID(),
      edits: {
        personId: ids.personId,
        projectId: ids.otherProjectId,
      },
    });
    assert.equal(result.ok, false);
    assert.equal(jobs.listJobs().length, 0);
    assert.equal((await memory.inspectCounts()).persons, 1);
  });

  it("discards without writing memory and does not resurrect on reprocess", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const before = await memory.inspectCounts();
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "She likes Render 2.",
      reportedCommunicationType: "call",
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    const input = {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "She likes Render 2.",
        confirmedPersonIds: [ids.personId],
      },
    };
    await ingestHumanIntakeCandidates(candidates, input);
    const note = (await candidates.list()).find((row) => row.candidateType === "note");
    assert.ok(note);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const result = await reviewHumanIntakeCandidate(deps, {
      candidateId: note!.candidateId,
      action: "discard",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "discarded");
    assert.deepEqual(await memory.inspectCounts(), before);
    assert.equal(jobs.listJobs().length, 0);
    await ingestHumanIntakeCandidates(candidates, input);
    const after = await candidates.get(note!.candidateId);
    assert.equal(after?.reviewStatus, "discarded");
    assert.notEqual(after?.reviewStatus, "pending");
  });

  it("defers without writing and keeps conflict as evidence state after approval", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "Finger size is 6.5.",
      reportedCommunicationType: "call",
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [],
        projects: [{ projectId: ids.projectId, title: "Oval ring", fingerSize: "6" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "Finger size is 6.5.",
        confirmedProjectIds: [ids.projectId],
      },
    });
    const spec = (await candidates.list()).find(
      (row) => row.payload.kind === "structured_spec",
    );
    assert.ok(spec);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const deferred = await reviewHumanIntakeCandidate(deps, {
      candidateId: spec!.candidateId,
      action: "defer",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(deferred.ok, true);
    if (!deferred.ok) return;
    assert.equal(deferred.record.reviewStatus, "deferred");
    assert.equal(deferred.record.candidateState, "conflict");
    const history = await memory.getProjectHistory(ids.projectId);
    assert.equal(history?.fingerSize, "6");
    const reviewed = applyFounderReview(spec!, { action: "approve" }, NOW);
    assert.equal(reviewed.candidateState, "conflict");
    assert.equal(reviewed.reviewStatus, "approved");
    assert.equal(reviewed.canonical, false);
  });
});
