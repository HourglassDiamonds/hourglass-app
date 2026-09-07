import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { createInMemoryHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/store";
import type { HumanSourceNameLookup } from "@/lib/continuum/client-memory/human-intake/store";
import { ingestHumanIntakeCandidates } from "./ingest";
import { CANDIDATE_PARSER_HUMAN_INTAKE_V1 } from "@/lib/continuum/candidates/types";

const NOW = "2026-08-25T17:00:00.000Z";

const TRANSCRIPT = `Text from Sarah Chen today about Oval ring.
Finger size is 6.5.
I'll get the revision tomorrow.
She likes Render 2.
Email other.person@example.com is just a mention.`;

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
  return { personId: person.record.id, projectId: project.record.id };
}

function namesFromMemory(store: InMemoryClientMemoryStore): HumanSourceNameLookup {
  return {
    getEntity: (id) => store.getEntity(id),
    getPersonName: async (id) =>
      (await store.getPersonProfile(id))?.displayName ?? null,
    getProjectTitle: async (id) =>
      (await store.getProjectProfile(id))?.displayTitle ?? null,
  };
}

describe("Human intake candidate extraction", () => {
  it("keeps ingest as source capture and extracts Continuum Candidates afterwards", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const before = await memory.inspectCounts();
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: namesFromMemory(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: TRANSCRIPT,
      reportedCommunicationType: "reported-text",
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const stored = await sources.getSource(ingested.sourceId);
    assert.equal(stored?.parseStatus, "stored");

    const candidates = new InMemoryCandidateStore();
    const extracted = await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.projectId, title: "Oval ring" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: TRANSCRIPT,
        capturedAt: stored?.capturedAt ?? null,
      },
    });
    assert.ok(extracted.candidates.length > 0);
    assert.ok(extracted.candidates.every((row) => row.reviewStatus === "pending"));
    assert.ok(extracted.candidates.every((row) => row.sourceSystem === "human-intake"));
    assert.ok(extracted.candidates.every((row) => row.canonical === false));
    assert.equal(extracted.parserVersion, CANDIDATE_PARSER_HUMAN_INTAKE_V1);
    const person = extracted.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(person?.proposedTarget.kind, "person");
    if (person?.proposedTarget.kind === "person") {
      assert.equal(person.proposedTarget.personId, ids.personId);
    }
    const after = await memory.inspectCounts();
    assert.deepEqual(after, before);
  });

  it("is idempotent and does not auto-approve or write Open Jobs", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const sources = createInMemoryHumanSourceStore({
      nowIso: () => NOW,
      newSourceId: () => randomUUID(),
      names: namesFromMemory(memory),
    });
    const ingested = await sources.ingest({
      sourceType: "plaud",
      rawText: "I'll send CAD-9 tomorrow. Finger size is 7.",
      reportedCommunicationType: "call",
      projectId: ids.projectId,
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;
    const candidates = new InMemoryCandidateStore();
    const input = {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [{ projectId: ids.projectId, title: "Oval ring" }],
      },
      evidence: {
        sourceId: ingested.sourceId,
        text: "I'll send CAD-9 tomorrow. Finger size is 7.",
        confirmedProjectIds: [ids.projectId],
      },
    };
    const first = await ingestHumanIntakeCandidates(candidates, input);
    const second = await ingestHumanIntakeCandidates(candidates, input);
    assert.ok(first.insertedIds.length > 0);
    assert.deepEqual(second.insertedIds, []);
    assert.ok(second.duplicateIds.length > 0);
    const rows = await candidates.list();
    assert.ok(rows.some((row) => row.candidateType === "open_job"));
    assert.ok(rows.every((row) => row.reviewStatus === "pending"));
    assert.equal((await memory.inspectCounts()).notes, 0);
    assert.equal((await memory.inspectCounts()).facts, 0);
  });

  it("does not suggest a Person from an email mentioned in the transcript", async () => {
    const memory = new InMemoryClientMemoryStore();
    const ids = await seed(memory);
    const candidates = new InMemoryCandidateStore();
    const extracted = await ingestHumanIntakeCandidates(candidates, {
      createdAt: NOW,
      world: {
        people: [{ personId: ids.personId, displayName: "Sarah Chen" }],
        projects: [],
      },
      evidence: {
        sourceId: randomUUID(),
        text: "Ping sarah.chen@example.com about the band.",
      },
    });
    assert.equal(
      extracted.candidates.filter((row) => row.candidateType === "person_association")
        .length,
      0,
    );
  });

  it("does not resurrect an approved candidate on identical reprocess", async () => {
    const candidates = new InMemoryCandidateStore();
    const sourceId = randomUUID();
    const input = {
      createdAt: NOW,
      world: {
        people: [],
        projects: [
          {
            projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title: "Oval ring",
            fingerSize: "6",
          },
        ],
      },
      evidence: {
        sourceId,
        text: "Finger size is 6.5.",
        confirmedProjectIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      },
    };
    const first = await ingestHumanIntakeCandidates(candidates, input);
    const spec = first.candidates.find(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.ok(spec);
    await candidates.applyReview(spec!.candidateId, { action: "approve" }, NOW);
    const second = await ingestHumanIntakeCandidates(candidates, input);
    const after = await candidates.get(spec!.candidateId);
    assert.equal(after?.reviewStatus, "approved");
    assert.equal(after?.candidateState, "conflict");
    assert.ok(second.duplicateIds.includes(spec!.candidateId));
  });
});
