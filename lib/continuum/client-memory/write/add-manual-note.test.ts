import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { MANUAL_NOTE_MAX_LENGTH } from "./types";
import { createInMemoryClientMemoryNoteWriter } from "./writer";

const NOW = "2026-08-23T14:00:00.000Z";

async function personAndProject(store: InMemoryClientMemoryStore) {
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

describe("Client Memory manual note writer", () => {
  it("inserts client, networking, and personal notes", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    for (const contextLayer of ["client", "networking", "personal"] as const) {
      const result = await writer.addManualNote({
        submissionId: randomUUID(),
        personId,
        contextLayer,
        noteText: `  ${contextLayer} memory  `,
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.status, "inserted");
    }
    const notes = store.listSourceNotes();
    assert.equal(notes.length, 3);
    assert.deepEqual(
      notes.map((row) => row.noteText).sort(),
      ["client memory", "networking memory", "personal memory"],
    );
    assert.ok(notes.every((row) => row.sourceSystem === "concierge-manual"));
    assert.ok(notes.every((row) => row.sourceSheet === "manual-note"));
    assert.ok(notes.every((row) => row.sourceField === "note"));
    const counts = await store.inspectCounts();
    assert.equal(counts.facts, 0);
    assert.equal(counts.wishes, 0);
  });

  it("rejects empty, oversized, missing person, and project-as-person", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId, projectId } = await personAndProject(store);
    const empty = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "   ",
    });
    assert.deepEqual(empty, {
      ok: false,
      reason: "invalid-input",
      code: "empty-note",
    });
    const oversized = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "personal",
      noteText: "x".repeat(MANUAL_NOTE_MAX_LENGTH + 1),
    });
    assert.equal(oversized.ok, false);
    if (!oversized.ok) assert.equal(oversized.code, "oversized-note");
    const missing = await writer.addManualNote({
      submissionId: randomUUID(),
      personId: randomUUID(),
      contextLayer: "client",
      noteText: "hello",
    });
    assert.deepEqual(missing, { ok: false, reason: "person-not-found" });
    const asPerson = await writer.addManualNote({
      submissionId: randomUUID(),
      personId: projectId,
      contextLayer: "client",
      noteText: "hello",
    });
    assert.deepEqual(asPerson, { ok: false, reason: "person-not-found" });
    assert.equal(store.listSourceNotes().length, 0);
  });

  it("requires an active client-project link and clears non-client projects", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId, projectId } = await personAndProject(store);
    const otherProject = await store.insertEntity({
      kind: "project",
      createdAt: NOW,
      createdBy: "test",
    });
    const linked = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      projectId,
      contextLayer: "client",
      noteText: "Reset oval into yellow gold.",
    });
    assert.equal(linked.ok, true);
    const unlinked = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      projectId: otherProject.record.id,
      contextLayer: "client",
      noteText: "should not save",
    });
    assert.deepEqual(unlinked, { ok: false, reason: "project-not-linked" });
    const personalWithProject = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      projectId,
      contextLayer: "personal",
      noteText: "Daughter starts Clemson this fall.",
    });
    assert.equal(personalWithProject.ok, false);
    if (!personalWithProject.ok) {
      assert.equal(personalWithProject.reason, "invalid-input");
      assert.equal(personalWithProject.code, "project-not-allowed");
    }
    assert.equal(store.listSourceNotes().length, 1);
  });

  it("is idempotent for exact retries and conflicts on material differences", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const other = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const submissionId = randomUUID();
    const first = await writer.addManualNote({
      submissionId,
      personId,
      contextLayer: "networking",
      noteText: "Met at the show.",
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.status, "inserted");
    const retry = await writer.addManualNote({
      submissionId,
      personId,
      contextLayer: "networking",
      noteText: "Met at the show.",
    });
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.status, "already-present");
    assert.equal(retry.noteId, first.noteId);
    assert.equal(store.listSourceNotes().length, 1);
    const changedText = await writer.addManualNote({
      submissionId,
      personId,
      contextLayer: "networking",
      noteText: "Different note",
    });
    assert.deepEqual(changedText, { ok: false, reason: "idempotency-conflict" });
    const changedPerson = await writer.addManualNote({
      submissionId,
      personId: other.record.id,
      contextLayer: "networking",
      noteText: "Met at the show.",
    });
    assert.deepEqual(changedPerson, {
      ok: false,
      reason: "idempotency-conflict",
    });
    assert.equal(store.listSourceNotes().length, 1);
    assert.equal(store.listSourceNotes()[0]?.noteText, "Met at the show.");
  });

  it("rejects invalid context values", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const result = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "friend" as never,
      noteText: "hello",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "invalid-input");
      assert.equal(result.code, "invalid-context");
    }
  });
});
