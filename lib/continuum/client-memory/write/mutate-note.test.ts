import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import {
  CLIENT_MEMORY_SOURCE_SYSTEM,
  classifySourceNoteLifecycle,
  isKnownSourceNoteBackfillSystem,
} from "../types";
import { newSourceNoteLifecycle } from "../source-note-row";
import { createInMemoryClientMemoryNoteWriter } from "./writer";
import { MANUAL_NOTE_MAX_LENGTH } from "./types";

const NOW = "2026-08-27T12:00:00.000Z";
const ACTOR = "justin";

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

async function insertImportedNote(
  store: InMemoryClientMemoryStore,
  input: {
    personId: string | null;
    projectId: string | null;
    text?: string;
    importRowKey?: string;
    sourceField?: string;
  },
) {
  const createdAt = NOW;
  return store.insertSourceNote({
    id: randomUUID(),
    personId: input.personId,
    projectId: input.projectId,
    contextLayer: "client",
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    sourceArtifact: "continuum-reconciliation-v3",
    sourceSheet: "Reconciled Projects",
    sourceField: input.sourceField ?? "Notes",
    importRowKey:
      input.importRowKey ??
      "continuum-reconciliation-v3:ReconciledProjects:slice-b",
    gmailThreadId: null,
    noteText: input.text ?? "imported evidence",
    createdAt,
    ...newSourceNoteLifecycle({
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt,
      lifecycleStatus: "absorbed",
    }),
  });
}

describe("Source note lifecycle backfill rules", () => {
  it("classifies founder-authored notes as kept and imported notes as absorbed", () => {
    assert.equal(classifySourceNoteLifecycle("concierge-manual"), "kept");
    assert.equal(
      classifySourceNoteLifecycle("continuum-reconciliation-v3"),
      "absorbed",
    );
    assert.equal(isKnownSourceNoteBackfillSystem("concierge-manual"), true);
    assert.equal(
      isKnownSourceNoteBackfillSystem("continuum-reconciliation-v3"),
      true,
    );
  });

  it("absorbs unknown source systems instead of leaving them cockpit-visible", () => {
    assert.equal(isKnownSourceNoteBackfillSystem("gmail"), false);
    assert.equal(isKnownSourceNoteBackfillSystem("plaud"), false);
    assert.equal(classifySourceNoteLifecycle("gmail"), "absorbed");
    assert.equal(classifySourceNoteLifecycle("unexpected-system"), "absorbed");
  });
});

describe("Source note edit / move / trash / restore", () => {
  it("creates new manual notes as kept, not inbox", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const result = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Founder note",
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    const notes = store.listSourceNotes();
    assert.equal(notes.length, 1);
    assert.equal(notes[0]?.lifecycleStatus, "kept");
    assert.equal(notes[0]?.sourceSystem, "concierge-manual");
  });

  it("edits the same note id, preserves prior text, and does not duplicate", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "personal",
      noteText: "Old text",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const mutationId = randomUUID();
    const edited = await writer.editNote({
      mutationId,
      noteId: created.noteId,
      noteText: "  New text  ",
      actor: ACTOR,
    });
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal(edited.noteId, created.noteId);
    assert.equal(store.listSourceNotes().length, 1);
    assert.equal(store.listSourceNotes()[0]?.noteText, "New text");
    assert.equal(store.listSourceNotes()[0]?.id, created.noteId);
    const revisions = store.listSourceNoteRevisions(created.noteId);
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0]?.noteText, "Old text");
    assert.equal(revisions[0]?.changeKind, "edit");
    const retry = await writer.editNote({
      mutationId,
      noteId: created.noteId,
      noteText: "New text",
      actor: ACTOR,
    });
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.status, "already-present");
    assert.equal(store.listSourceNoteRevisions(created.noteId).length, 1);
  });

  it("rejects blank and oversized edits without writing a revision", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Keep me",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const empty = await writer.editNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      noteText: "   ",
      actor: ACTOR,
    });
    assert.deepEqual(empty, {
      ok: false,
      reason: "invalid-input",
      code: "empty-note",
    });
    const oversized = await writer.editNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      noteText: "x".repeat(MANUAL_NOTE_MAX_LENGTH + 1),
      actor: ACTOR,
    });
    assert.equal(oversized.ok, false);
    if (!oversized.ok) assert.equal(oversized.code, "oversized-note");
    assert.equal(store.listSourceNotes()[0]?.noteText, "Keep me");
    assert.equal(store.listSourceNoteRevisions().length, 0);
  });

  it("moves the same note within a person and retains prior context in revision", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Context move",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const moved = await writer.moveNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      personId,
      contextLayer: "networking",
      actor: ACTOR,
    });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    assert.equal(moved.noteId, created.noteId);
    const note = store.listSourceNotes()[0];
    assert.equal(note?.id, created.noteId);
    assert.equal(note?.personId, personId);
    assert.equal(note?.contextLayer, "networking");
    assert.equal(note?.projectId, null);
    const revision = store.listSourceNoteRevisions(created.noteId)[0];
    assert.equal(revision?.contextLayer, "client");
    assert.equal(revision?.changeKind, "move");
    assert.equal(store.listSourceNotes().length, 1);
  });

  it("requires explicit confirmation for a cross-person move and does not duplicate", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const other = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "personal",
      noteText: "Cross person",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const denied = await writer.moveNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      personId: other.record.id,
      contextLayer: "personal",
      actor: ACTOR,
    });
    assert.deepEqual(denied, {
      ok: false,
      reason: "invalid-input",
      code: "cross-person-unconfirmed",
    });
    assert.equal(store.listSourceNotes()[0]?.personId, personId);
    const moved = await writer.moveNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      personId: other.record.id,
      contextLayer: "personal",
      actor: ACTOR,
      crossPersonConfirmed: true,
    });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    assert.equal(moved.noteId, created.noteId);
    assert.equal(store.listSourceNotes().length, 1);
    assert.equal(store.listSourceNotes()[0]?.personId, other.record.id);
    const revision = store.listSourceNoteRevisions(created.noteId)[0];
    assert.equal(revision?.personId, personId);
    assert.equal(revision?.changeKind, "move");
  });

  it("fails closed when moving to a project not linked to the target person", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId, projectId } = await personAndProject(store);
    const otherProject = await store.insertEntity({
      kind: "project",
      createdAt: NOW,
      createdBy: "test",
    });
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      projectId,
      contextLayer: "client",
      noteText: "Linked project note",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const result = await writer.moveNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      personId,
      projectId: otherProject.record.id,
      contextLayer: "client",
      actor: ACTOR,
    });
    assert.deepEqual(result, { ok: false, reason: "project-not-linked" });
    assert.equal(store.listSourceNotes()[0]?.projectId, projectId);
    assert.equal(store.listSourceNoteRevisions().length, 0);
  });

  it("fails closed when a Person UUID is placed in the project field", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const other = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Kind mismatch",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const malformed = await writer.moveNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      personId,
      projectId: "not-a-uuid",
      contextLayer: "client",
      actor: ACTOR,
    });
    assert.deepEqual(malformed, {
      ok: false,
      reason: "invalid-input",
      code: "invalid-id",
    });
    const mismatch = await writer.moveNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      personId,
      projectId: other.record.id,
      contextLayer: "client",
      actor: ACTOR,
    });
    assert.deepEqual(mismatch, { ok: false, reason: "entity-kind-mismatch" });
    assert.equal(store.listSourceNotes()[0]?.projectId, null);
    assert.equal(store.listSourceNoteRevisions().length, 0);
  });

  it("trashes the same row without freeing import identity or resurrecting on re-import", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId, projectId } = await personAndProject(store);
    const importRowKey = "continuum-reconciliation-v3:ReconciledProjects:trash";
    const inserted = await insertImportedNote(store, {
      personId,
      projectId,
      importRowKey,
    });
    assert.equal(inserted.status, "inserted");
    assert.equal(inserted.record.lifecycleStatus, "absorbed");
    const trashed = await writer.trashNote({
      mutationId: randomUUID(),
      noteId: inserted.record.id,
      actor: ACTOR,
    });
    assert.equal(trashed.ok, true);
    if (!trashed.ok) return;
    assert.equal(trashed.noteId, inserted.record.id);
    const row = store.listSourceNotes()[0];
    assert.equal(row?.lifecycleStatus, "trashed");
    assert.ok(row?.deletedAt);
    assert.equal(row?.previousLifecycle, "absorbed");
    assert.equal(store.listSourceNoteRevisions()[0]?.changeKind, "trash");
    const replay = await insertImportedNote(store, {
      personId,
      projectId,
      importRowKey,
      text: "should not duplicate",
    });
    assert.equal(replay.status, "already-present");
    assert.equal(replay.record.id, inserted.record.id);
    assert.equal(store.listSourceNotes().length, 1);
    assert.equal(store.listSourceNotes()[0]?.lifecycleStatus, "trashed");
  });

  it("restores the same row to its previous lifecycle", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Restore me",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await writer.trashNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      actor: ACTOR,
    });
    const restored = await writer.restoreNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      actor: ACTOR,
    });
    assert.equal(restored.ok, true);
    if (!restored.ok) return;
    assert.equal(restored.noteId, created.noteId);
    const row = store.listSourceNotes()[0];
    assert.equal(row?.id, created.noteId);
    assert.equal(row?.lifecycleStatus, "kept");
    assert.equal(row?.deletedAt, null);
    assert.equal(
      store.listSourceNoteRevisions(created.noteId).map((item) => item.changeKind).join(","),
      "trash,restore",
    );
  });

  it("rolls back a revision if the note update fails", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Atomic",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    store.failNextNoteMutationAfter = "update";
    const result = await writer.editNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      noteText: "Should not stick",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    assert.equal(store.listSourceNotes()[0]?.noteText, "Atomic");
    assert.equal(store.listSourceNoteRevisions().length, 0);
  });

  it("does not write a revision if the revision insert fails", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    const { personId } = await personAndProject(store);
    const created = await writer.addManualNote({
      submissionId: randomUUID(),
      personId,
      contextLayer: "client",
      noteText: "Unchanged",
      actor: ACTOR,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    store.failNextNoteMutationAfter = "revision";
    const result = await writer.editNote({
      mutationId: randomUUID(),
      noteId: created.noteId,
      noteText: "No write",
      actor: ACTOR,
    });
    assert.equal(result.ok, false);
    assert.equal(store.listSourceNotes()[0]?.noteText, "Unchanged");
    assert.equal(store.listSourceNoteRevisions().length, 0);
  });
});
