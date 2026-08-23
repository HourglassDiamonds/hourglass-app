import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePersonRow } from "./eligibility";
import { hashEmail, hashPhone, peopleImportRowKey } from "./hashes";
import { InMemoryClientMemoryStore, newExternalIdentity } from "./store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";
import { parseReconciliationWorkbook } from "./workbook";
import {
  buildSyntheticXlsx,
  emptyWorkbookSheets,
  personCells,
} from "./synthetic-xlsx";

const NOW = "2026-08-22T00:00:00.000Z";

function book(people: ReturnType<typeof personCells>[]) {
  return parseReconciliationWorkbook(
    buildSyntheticXlsx(emptyWorkbookSheets({ people })),
  );
}

describe("Client Memory shared person eligibility", () => {
  it("keeps a valid import key eligible when email is malformed", async () => {
    const parsed = book([
      personCells({ name: "Ada Lovelace", email: "not-an-email" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const evaluation = await evaluatePersonRow(store, parsed.people[0]);
    assert.equal(evaluation.eligibility, "eligible");
    assert.equal(evaluation.mutation, "create");
    assert.equal(
      evaluation.validIdentityClaims.some((claim) => claim.identityKind === "email_hash"),
      false,
    );
    assert.deepEqual(evaluation.identityWarnings, ["REVIEW_MALFORMED_EMAIL"]);
    assert.equal(hashEmail("not-an-email"), null);
  });

  it("keeps a valid import key eligible when phone is malformed/short", async () => {
    const parsed = book([
      personCells({ name: "Ada Lovelace", phone: "123" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const evaluation = await evaluatePersonRow(store, parsed.people[0]);
    assert.equal(evaluation.eligibility, "eligible");
    assert.equal(
      evaluation.validIdentityClaims.some((claim) => claim.identityKind === "phone_hash"),
      false,
    );
    assert.deepEqual(evaluation.identityWarnings, ["REVIEW_MALFORMED_PHONE"]);
    assert.equal(hashPhone("123"), null);
  });

  it("keeps a valid import key eligible for unsupported international phone", async () => {
    const parsed = book([
      personCells({
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+44 20 7946 0958",
      }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const evaluation = await evaluatePersonRow(store, parsed.people[0]);
    assert.equal(evaluation.eligibility, "eligible");
    assert.equal(
      evaluation.validIdentityClaims.some((claim) => claim.identityKind === "phone_hash"),
      false,
    );
    assert.ok(
      evaluation.validIdentityClaims.some((claim) => claim.identityKind === "email_hash"),
    );
    assert.deepEqual(evaluation.identityWarnings, ["REVIEW_UNSUPPORTED_PHONE"]);
    assert.equal(hashPhone("+44 20 7946 0958"), null);
  });

  it("stays eligible with only import_row_key when both secondary identifiers are malformed", async () => {
    const parsed = book([
      personCells({
        name: "Ada Lovelace",
        email: "not-an-email",
        phone: "123",
      }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const evaluation = await evaluatePersonRow(store, parsed.people[0]);
    assert.equal(evaluation.eligibility, "eligible");
    assert.deepEqual(
      evaluation.validIdentityClaims.map((claim) => claim.identityKind),
      ["import_row_key"],
    );
    assert.deepEqual(evaluation.identityWarnings, [
      "REVIEW_MALFORMED_EMAIL",
      "REVIEW_MALFORMED_PHONE",
    ]);
  });

  it("blocks mutation on an actual valid identity contradiction", async () => {
    const parsed = book([
      personCells({
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "3055550100",
      }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const a = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const b = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: a.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "email_hash",
        identifier: hashEmail("ada@example.com")!,
        createdAt: NOW,
      }),
    );
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: b.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "phone_hash",
        identifier: hashPhone("3055550100")!,
        createdAt: NOW,
      }),
    );
    const evaluation = await evaluatePersonRow(store, parsed.people[0]);
    assert.equal(evaluation.eligibility, "identity-conflict");
    assert.equal(evaluation.mutation, "none");
    assert.equal(evaluation.reasonCode, "REVIEW_CROSS_KEY_CONFLICT");
  });

  it("maps Relationship=Client to roles=['client']", async () => {
    const parsed = book([
      personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const evaluation = await evaluatePersonRow(store, parsed.people[0]);
    assert.deepEqual(evaluation.roles, ["client"]);
    assert.equal(parsed.people[0].importRowKey, peopleImportRowKey(2));
  });
});
