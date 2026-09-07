import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { SqlMappedCandidateStore } from "@/lib/continuum/candidates/sql-mapped-store";
import {
  effectiveCandidatePayload,
  effectiveCandidateTarget,
} from "@/lib/continuum/candidates/review";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { createInMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import { createInMemoryHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/store";
import type { HumanSourceNameLookup } from "@/lib/continuum/client-memory/human-intake/store";
import { ingestHumanIntakeCandidates } from "../candidates/ingest";
import {
  HUMAN_INTAKE_APPROVE_WRITE_ORDER,
  reviewHumanIntakeCandidate,
} from "./apply";
import { createMemoryHumanIntakeReviewDeps } from "./memory";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");
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
  return { personId: person.record.id, projectId: project.record.id };
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

describe("Human intake durable review path", () => {
  it("keeps approved, discarded, deferred, and edit overlays after reload + re-extraction", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const text = "Finger size is 6.5. She likes Render 2. I'll send the revision tomorrow.";
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: text,
      reportedCommunicationType: "call",
      personId: ids.personId,
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const input = {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.projectId, title: "Oval ring", fingerSize: "6" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text,
        confirmedPersonIds: [ids.personId],
        confirmedProjectIds: [ids.projectId],
      },
    };
    const store = new SqlMappedCandidateStore();
    const first = await ingestHumanIntakeCandidates(store, input);
    const spec = first.candidates.find(
      (row) => row.payload.kind === "structured_spec" && row.payload.fieldName === "finger_size",
    );
    const note = first.candidates.find((row) => row.candidateType === "note");
    const job = first.candidates.find((row) => row.candidateType === "open_job");
    assert.ok(spec && note && job);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates: store,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const edited = await reviewHumanIntakeCandidate(deps, {
      candidateId: spec.candidateId,
      action: "edit",
      actor: ACTOR,
      mutationId: randomUUID(),
      edits: { specValue: "7" },
    });
    assert.equal(edited.ok, true);
    const discarded = await reviewHumanIntakeCandidate(deps, {
      candidateId: note.candidateId,
      action: "discard",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(discarded.ok, true);
    const deferred = await reviewHumanIntakeCandidate(deps, {
      candidateId: job.candidateId,
      action: "defer",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(deferred.ok, true);

    const reloaded = SqlMappedCandidateStore.fromRows(store.exportRows());
    const second = await ingestHumanIntakeCandidates(reloaded, input);
    const specAfter = await reloaded.get(spec.candidateId);
    const noteAfter = await reloaded.get(note.candidateId);
    const jobAfter = await reloaded.get(job.candidateId);
    assert.equal(specAfter?.reviewStatus, "pending");
    assert.equal(specAfter?.lastReviewAction, "edit");
    const specPayload = effectiveCandidatePayload(specAfter!);
    assert.equal(specPayload.kind, "structured_spec");
    if (specPayload.kind === "structured_spec") {
      assert.equal(specPayload.proposedValue, "7");
    }
    assert.equal(effectiveCandidateTarget(specAfter!).kind, "project_spec");
    assert.equal(noteAfter?.reviewStatus, "discarded");
    assert.equal(jobAfter?.reviewStatus, "deferred");
    assert.equal(specAfter?.candidateState, "conflict");
    assert.ok(second.duplicateIds.includes(spec.candidateId));
    assert.equal(
      (await reloaded.list()).filter((row) => row.candidateId === spec.candidateId).length,
      1,
    );

    const approved = await reviewHumanIntakeCandidate(
      { ...deps, candidates: reloaded },
      {
        candidateId: spec.candidateId,
        action: "approve",
        actor: ACTOR,
        mutationId: randomUUID(),
      },
    );
    assert.equal(approved.ok, true);
    const third = await ingestHumanIntakeCandidates(reloaded, input);
    const approvedAfter = await reloaded.get(spec.candidateId);
    assert.equal(approvedAfter?.reviewStatus, "approved");
    assert.equal(approvedAfter?.candidateState, "conflict");
    assert.ok(third.duplicateIds.includes(spec.candidateId));
  });

  it("does not canonical-write date or follow_up on approve", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const before = await memory.inspectCounts();
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: names(memory),
    });
    const text = "Please follow up next week. I'll send CAD on March 15, 2026.";
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: text,
      reportedCommunicationType: "call",
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const store = new SqlMappedCandidateStore();
    const extracted = await ingestHumanIntakeCandidates(store, {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.projectId, title: "Oval ring" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text,
        capturedAt: "2026-03-01T12:00:00.000Z",
        confirmedProjectIds: [ids.projectId],
      },
    });
    const date = extracted.candidates.find((row) => row.candidateType === "date");
    const follow = extracted.candidates.find((row) => row.candidateType === "follow_up");
    assert.ok(date && follow);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates: store,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const dateResult = await reviewHumanIntakeCandidate(deps, {
      candidateId: date.candidateId,
      action: "approve",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    const followResult = await reviewHumanIntakeCandidate(deps, {
      candidateId: follow.candidateId,
      action: "approve",
      actor: ACTOR,
      mutationId: randomUUID(),
    });
    assert.equal(dateResult.ok, true);
    assert.equal(followResult.ok, true);
    if (dateResult.ok) {
      assert.equal(dateResult.appliedRecordKind, null);
      assert.equal(dateResult.record.reviewStatus, "approved");
    }
    if (followResult.ok) {
      assert.equal(followResult.appliedRecordKind, null);
    }
    const after = await memory.inspectCounts();
    assert.equal(after.notes, before.notes);
    assert.equal(jobs.listJobs().length, 0);
    assert.equal((await memory.getProjectHistory(ids.projectId))?.fingerSize, "6");
  });

  it("leaves review pending when a supported canonical writer fails", async () => {
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
    const store = new SqlMappedCandidateStore();
    const extracted = await ingestHumanIntakeCandidates(store, {
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
    const job = extracted.candidates.find((row) => row.candidateType === "open_job");
    assert.ok(job);
    const jobs = createInMemoryProjectJobStore();
    const deps = createMemoryHumanIntakeReviewDeps({
      candidates: store,
      sources,
      memory,
      jobs,
      nowIso: () => NOW,
    });
    const failed = await reviewHumanIntakeCandidate(
      {
        ...deps,
        createProjectJob: async () => ({ ok: false, reason: "unavailable" }),
      },
      {
        candidateId: job.candidateId,
        action: "approve",
        actor: ACTOR,
        mutationId: randomUUID(),
      },
    );
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.equal(failed.reason, "unavailable");
    const remaining = await store.get(job.candidateId);
    assert.equal(remaining?.reviewStatus, "pending");
    assert.equal(jobs.listJobs().length, 0);
    assert.deepEqual([...HUMAN_INTAKE_APPROVE_WRITE_ORDER], [
      "load-durable-candidate",
      "preview-effective-payload",
      "canonical-writer-if-supported",
      "persist-founder-approval",
      "refresh-source-review-status",
    ]);
  });

  it("does not use InMemoryCandidateStore as production-intended #19 persistence", () => {
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/inbox/[sourceId]/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/intake-review-actions.ts"),
      "utf8",
    );
    assert.match(page, /getAuthenticatedCandidateStore/);
    assert.match(page, /CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE/);
    assert.doesNotMatch(page, /InMemoryCandidateStore/);
    assert.match(actions, /getAuthenticatedCandidateStore/);
    assert.match(actions, /CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE/);
    assert.doesNotMatch(actions, /InMemoryCandidateStore/);
    assert.doesNotMatch(actions, /ingestHumanIntakeCandidates/);
  });
});
