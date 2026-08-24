import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "../store";
import { createInMemoryClientMemoryFactWriter } from "./writer";
import {
  FACT_VERIFICATION_MANUAL,
  MANUAL_BIRTHDAY_CREATED_BY,
  MANUAL_BIRTHDAY_SOURCE_SYSTEM,
  PERSON_FACT_TYPE_BIRTHDAY,
} from "./types";

const NOW = "2026-08-24T18:00:00.000Z";

async function insertPerson(store: InMemoryClientMemoryStore) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  return person.record.id;
}

describe("manual birthday writer", () => {
  it("creates a current birthday with exact manual metadata", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryFactWriter(store);
    const personId = await insertPerson(store);
    const submissionId = randomUUID();
    const result = await writer.setManualBirthday({
      personId,
      submissionId,
      month: 11,
      day: 12,
      year: null,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, "inserted");
    assert.equal(result.supersededId, null);
    const fact = await store.getPersonFact(result.factId);
    assert.equal(fact?.factType, PERSON_FACT_TYPE_BIRTHDAY);
    assert.equal(fact?.status, "current");
    assert.equal(fact?.approvalStatus, "approved");
    assert.equal(fact?.verification, FACT_VERIFICATION_MANUAL);
    assert.equal(fact?.confidence, 1);
    assert.equal(fact?.visibility, "internal-only");
    assert.equal(fact?.usagePermission, "unset");
    assert.equal(fact?.sourceSystem, MANUAL_BIRTHDAY_SOURCE_SYSTEM);
    assert.equal(fact?.createdBy, MANUAL_BIRTHDAY_CREATED_BY);
    assert.equal(fact?.validFrom, null);
    assert.equal(fact?.validUntil, null);
    assert.deepEqual(fact?.value, {
      calendar: "gregorian",
      month: 11,
      day: 12,
      year: null,
    });
    const counts = await store.inspectCounts();
    assert.equal(counts.facts, 1);
    assert.equal(counts.notes, 0);
    assert.equal(counts.wishes, 0);
  });

  it("requires a Person and rejects a Project entity", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryFactWriter(store);
    const missing = await writer.setManualBirthday({
      personId: randomUUID(),
      submissionId: randomUUID(),
      month: 11,
      day: 12,
    });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.reason, "person-not-found");
    const project = await store.insertEntity({
      kind: "project",
      createdAt: NOW,
      createdBy: "test",
    });
    const asProject = await writer.setManualBirthday({
      personId: project.record.id,
      submissionId: randomUUID(),
      month: 11,
      day: 12,
    });
    assert.equal(asProject.ok, false);
    if (!asProject.ok) assert.equal(asProject.reason, "person-not-found");
    assert.equal((await store.inspectCounts()).facts, 0);
  });

  it("supersedes the prior current birthday atomically", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryFactWriter(store);
    const personId = await insertPerson(store);
    const first = await writer.setManualBirthday({
      personId,
      submissionId: randomUUID(),
      month: 11,
      day: 12,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = await writer.setManualBirthday({
      personId,
      submissionId: randomUUID(),
      month: 11,
      day: 13,
      year: 1985,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.status, "inserted");
    assert.equal(second.supersededId, first.factId);
    const old = await store.getPersonFact(first.factId);
    const next = await store.getPersonFact(second.factId);
    assert.equal(old?.status, "superseded");
    assert.equal(next?.status, "current");
    assert.equal(next?.supersedesId, first.factId);
    const current = store
      .listPersonFacts()
      .filter((row) => row.status === "current" && row.factType === PERSON_FACT_TYPE_BIRTHDAY);
    assert.equal(current.length, 1);
    assert.equal(current[0]?.id, second.factId);
  });

  it("rolls back the prior current fact if the replacement insert fails", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryFactWriter(store);
    const personId = await insertPerson(store);
    const first = await writer.setManualBirthday({
      personId,
      submissionId: randomUUID(),
      month: 5,
      day: 1,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    store.failNextSetCurrentAfterSupersede = true;
    const failed = await writer.setManualBirthday({
      personId,
      submissionId: randomUUID(),
      month: 6,
      day: 2,
    });
    assert.equal(failed.ok, false);
    const still = await store.getPersonFact(first.factId);
    assert.equal(still?.status, "current");
    assert.equal(
      store.listPersonFacts().filter((row) => row.factType === PERSON_FACT_TYPE_BIRTHDAY).length,
      1,
    );
  });

  it("treats retries as already-present and does not duplicate current", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryFactWriter(store);
    const personId = await insertPerson(store);
    const submissionId = randomUUID();
    const first = await writer.setManualBirthday({
      personId,
      submissionId,
      month: 11,
      day: 12,
    });
    const retry = await writer.setManualBirthday({
      personId,
      submissionId,
      month: 11,
      day: 12,
    });
    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    if (!first.ok || !retry.ok) return;
    assert.equal(retry.status, "already-present");
    assert.equal(retry.factId, first.factId);
    const sameValue = await writer.setManualBirthday({
      personId,
      submissionId: randomUUID(),
      month: 11,
      day: 12,
    });
    assert.equal(sameValue.ok, true);
    if (!sameValue.ok) return;
    assert.equal(sameValue.status, "already-present");
    assert.equal(
      store.listPersonFacts().filter((row) => row.status === "current").length,
      1,
    );
    const conflict = await writer.setManualBirthday({
      personId,
      submissionId,
      month: 12,
      day: 1,
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.reason, "idempotency-conflict");
  });

  it("does not write notes, wishes, or kernel artifacts", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryFactWriter(store);
    const personId = await insertPerson(store);
    await writer.setManualBirthday({
      personId,
      submissionId: randomUUID(),
      month: 3,
      day: 3,
    });
    const counts = await store.inspectCounts();
    assert.equal(counts.notes, 0);
    assert.equal(counts.wishes, 0);
    assert.equal(counts.relationships, 0);
    assert.equal(store.listSourceNotes().length, 0);
  });
});
