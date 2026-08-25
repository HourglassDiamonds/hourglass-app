import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import {
  createInMemoryHumanSourceStore,
  extractPlaudRawText,
  isFounderReportedProvenance,
  provenanceClassForCommunication,
  sha256Utf8,
  sourcePreview,
} from "./index";
import type { HumanSourceNameLookup } from "./store";

const NOW = "2026-08-25T17:00:00.000Z";

const REPORTED_TEXT = `Text from Sarah today.
She likes Render 2 but wants the cathedral lower.
I told her I’d get the revision tomorrow.`;

async function seedPersonAndProject(store: InMemoryClientMemoryStore) {
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

function humanStore(memory: InMemoryClientMemoryStore) {
  return createInMemoryHumanSourceStore({
    nowIso: () => NOW,
    newSourceId: () => randomUUID(),
    names: namesFromMemory(memory),
  });
}

describe("Human intake PLAUD ingest", () => {
  it("saves a pasted recap without Person or Project", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = humanStore(memory);
    const result = await store.ingest({
      sourceType: "plaud",
      rawText: "Quick voice memo about metal preference.",
      reportedCommunicationType: "voice-memo",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "inserted");
    const source = await store.getSource(result.sourceId);
    assert.equal(source?.sourceType, "plaud");
    assert.equal(source?.parseStatus, "stored");
    assert.equal(source?.reviewStatus, "pending");
    assert.equal(source?.parserVersion, null);
    assert.equal(source?.parsedText, null);
    assert.equal((await store.listLinks(result.sourceId)).length, 0);
  });

  it("accepts txt, vtt, json, and md transcripts", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = humanStore(memory);
    const json = extractPlaudRawText({
      kind: "json",
      decoded: JSON.stringify({ transcript: "JSON voice recap about the band." }),
    });
    const vtt = extractPlaudRawText({
      kind: "vtt",
      decoded: "WEBVTT\n\n00:00.000 --> 00:02.000\nVTT recap of the fitting.\n",
    });
    const md = extractPlaudRawText({
      kind: "md",
      decoded: "# Memo\n\nMarkdown recap of the studio visit.",
    });
    const txt = extractPlaudRawText({
      kind: "txt",
      decoded: "Plain text recap of the call.",
    });
    const results = await Promise.all([
      store.ingest({
        sourceType: "plaud",
        rawText: txt,
        reportedCommunicationType: "call",
      }),
      store.ingest({
        sourceType: "plaud",
        rawText: vtt,
        reportedCommunicationType: "call",
      }),
      store.ingest({
        sourceType: "plaud",
        rawText: json,
        reportedCommunicationType: "voice-memo",
      }),
      store.ingest({
        sourceType: "plaud",
        rawText: md,
        reportedCommunicationType: "in-person",
      }),
    ]);
    assert.ok(results.every((row) => row.ok && row.status === "inserted"));
    assert.equal((await store.listSources()).length, 4);
    assert.equal(json, "JSON voice recap about the band.");
  });

  it("links a valid Person and linked Project as confirmed only", async () => {
    const memory = new InMemoryClientMemoryStore();
    const { personId, projectId } = await seedPersonAndProject(memory);
    const store = humanStore(memory);
    const result = await store.ingest({
      sourceType: "plaud",
      rawText: "Call notes for the oval.",
      reportedCommunicationType: "call",
      personId,
      projectId,
      contextLayerConfirmed: "client",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const links = await store.listLinks(result.sourceId);
    assert.equal(links.length, 2);
    assert.ok(links.every((row) => row.linkStatus === "confirmed"));
    assert.deepEqual(
      links.map((row) => row.entityKind).sort(),
      ["person", "project"],
    );
  });

  it("fails closed for unknown ids and kind mismatches", async () => {
    const memory = new InMemoryClientMemoryStore();
    const { personId, projectId } = await seedPersonAndProject(memory);
    const store = humanStore(memory);
    const missing = await store.ingest({
      sourceType: "plaud",
      rawText: "hello",
      reportedCommunicationType: "unknown",
      personId: randomUUID(),
    });
    assert.deepEqual(missing, { ok: false, reason: "entity-not-found" });
    const personAsProject = await store.ingest({
      sourceType: "plaud",
      rawText: "hello",
      reportedCommunicationType: "unknown",
      projectId: personId,
    });
    assert.deepEqual(personAsProject, { ok: false, reason: "entity-kind-mismatch" });
    const projectAsPerson = await store.ingest({
      sourceType: "plaud",
      rawText: "hello",
      reportedCommunicationType: "unknown",
      personId: projectId,
    });
    assert.deepEqual(projectAsPerson, { ok: false, reason: "entity-kind-mismatch" });
    assert.equal((await store.listSources()).length, 0);
    assert.equal((await memory.inspectCounts()).persons, 1);
  });

  it("is idempotent on checksum and external id without duplicating links", async () => {
    const memory = new InMemoryClientMemoryStore();
    const { personId } = await seedPersonAndProject(memory);
    const store = humanStore(memory);
    const input = {
      sourceType: "plaud" as const,
      rawText: "Same PLAUD recap twice.",
      reportedCommunicationType: "unknown" as const,
      externalSourceId: "plaud-note-1",
      personId,
    };
    const first = await store.ingest(input);
    const second = await store.ingest(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.status, "inserted");
    assert.equal(second.status, "already-present");
    assert.equal(second.sourceId, first.sourceId);
    assert.equal((await store.listSources()).length, 1);
    assert.equal((await store.listLinks(first.sourceId)).length, 1);
    const checksumOnly = await store.ingest({
      sourceType: "plaud",
      rawText: "Same PLAUD recap twice.",
      reportedCommunicationType: "unknown",
    });
    assert.equal(checksumOnly.ok, true);
    if (!checksumOnly.ok) return;
    assert.equal(checksumOnly.status, "already-present");
  });

  it("fails closed when external id and checksum disagree", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = humanStore(memory);
    const first = await store.ingest({
      sourceType: "plaud",
      rawText: "Original PLAUD body.",
      reportedCommunicationType: "call",
      externalSourceId: "plaud-1",
    });
    assert.equal(first.ok, true);
    const changedBody = await store.ingest({
      sourceType: "plaud",
      rawText: "Different PLAUD body.",
      reportedCommunicationType: "call",
      externalSourceId: "plaud-1",
    });
    assert.deepEqual(changedBody, { ok: false, reason: "idempotency-conflict" });
    const stolenChecksum = await store.ingest({
      sourceType: "plaud",
      rawText: "Original PLAUD body.",
      reportedCommunicationType: "call",
      externalSourceId: "plaud-2",
    });
    assert.deepEqual(stolenChecksum, { ok: false, reason: "idempotency-conflict" });
    assert.equal((await store.listSources()).length, 1);
  });

  it("stores reported-text as founder-reported source only", async () => {
    const memory = new InMemoryClientMemoryStore();
    const before = await memory.inspectCounts();
    const store = humanStore(memory);
    const result = await store.ingest({
      sourceType: "plaud",
      rawText: REPORTED_TEXT,
      reportedCommunicationType: "reported-text",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const source = await store.getSource(result.sourceId);
    assert.equal(source?.sourceType, "plaud");
    assert.equal(source?.reportedCommunicationType, "reported-text");
    assert.equal(
      provenanceClassForCommunication("reported-text"),
      "founder-reported",
    );
    assert.equal(isFounderReportedProvenance("reported-text"), true);
    assert.equal(isFounderReportedProvenance("call"), false);
    assert.equal(source?.rawText?.includes("cathedral lower"), true);
    const after = await memory.inspectCounts();
    assert.deepEqual(after, before);
    assert.equal(after.facts, 0);
    assert.equal(after.notes, 0);
    assert.equal(after.wishes, 0);
    assert.equal(after.histories, 0);
    assert.equal(sourcePreview(source?.rawText ?? null)?.includes("\n"), false);
    assert.ok((sourcePreview(REPORTED_TEXT)?.length ?? 0) <= 141);
    assert.equal(sha256Utf8(source?.rawText ?? ""), source?.contentSha256);
  });

  it("does not create entities, candidates, or rewrite authority text", async () => {
    const memory = new InMemoryClientMemoryStore();
    const store = humanStore(memory);
    const messy = "  Line one.\r\nLine two.  ";
    const result = await store.ingest({
      sourceType: "plaud",
      rawText: messy,
      reportedCommunicationType: "unknown",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const source = await store.getSource(result.sourceId);
    assert.equal(source?.rawText, "  Line one.\nLine two.  ");
    assert.equal((await memory.inspectCounts()).persons, 0);
    assert.equal((await memory.inspectCounts()).projects, 0);
  });
});
