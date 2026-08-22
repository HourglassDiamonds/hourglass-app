import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { hashEmail, hashPhone, peopleImportRowKey } from "./hashes";
import { resolvePersonIdentity } from "./identity";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
} from "./store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";

const NOW = "2026-08-22T00:00:00.000Z";

async function seedPerson(
  store: InMemoryClientMemoryStore,
  identities: Array<{ kind: "hubspot_contact_id" | "email_hash" | "phone_hash" | "import_row_key"; identifier: string }>,
) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  for (const identity of identities) {
    const written = await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: identity.kind,
        identifier: identity.identifier,
        createdAt: NOW,
      }),
    );
    assert.equal(written.status, "inserted");
  }
  return person.record.id;
}

describe("Client Memory identity resolver", () => {
  it("matches exact email hash", async () => {
    const store = new InMemoryClientMemoryStore();
    const emailHash = hashEmail("ada@example.com");
    assert.ok(emailHash);
    const personId = await seedPerson(store, [
      { kind: "email_hash", identifier: emailHash },
    ]);
    const result = await resolvePersonIdentity(store, {
      email: "ada@example.com",
    });
    assert.equal(result.status, "matched");
    assert.equal(result.personId, personId);
    assert.equal(result.matchedBy, "email_hash");
  });

  it("matches exact phone hash", async () => {
    const store = new InMemoryClientMemoryStore();
    const phoneHash = hashPhone("+1 (305) 555-0100");
    assert.ok(phoneHash);
    const personId = await seedPerson(store, [
      { kind: "phone_hash", identifier: phoneHash },
    ]);
    const result = await resolvePersonIdentity(store, { phone: "3055550100" });
    assert.equal(result.status, "matched");
    assert.equal(result.personId, personId);
    assert.equal(result.matchedBy, "phone_hash");
  });

  it("matches when email and phone belong to the same person", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, [
      { kind: "email_hash", identifier: hashEmail("ada@example.com")! },
      { kind: "phone_hash", identifier: hashPhone("3055550100")! },
    ]);
    const result = await resolvePersonIdentity(store, {
      email: "ada@example.com",
      phone: "305-555-0100",
    });
    assert.equal(result.status, "matched");
    assert.equal(result.personId, personId);
    assert.equal(result.matchedBy, "email_hash");
  });

  it("reviews when email is person A and phone is person B", async () => {
    const store = new InMemoryClientMemoryStore();
    await seedPerson(store, [
      { kind: "email_hash", identifier: hashEmail("ada@example.com")! },
    ]);
    await seedPerson(store, [
      { kind: "phone_hash", identifier: hashPhone("3055550100")! },
    ]);
    const result = await resolvePersonIdentity(store, {
      email: "ada@example.com",
      phone: "3055550100",
    });
    assert.equal(result.status, "review");
    assert.equal(result.reasonCode, "REVIEW_CROSS_KEY_CONFLICT");
    assert.equal(result.conflictingPersonIds.length, 2);
  });

  it("never merges on name only", async () => {
    const store = new InMemoryClientMemoryStore();
    await seedPerson(store, [
      { kind: "email_hash", identifier: hashEmail("ada@example.com")! },
    ]);
    const result = await resolvePersonIdentity(store, {
      displayName: "Ada Lovelace",
    });
    assert.equal(result.status, "review");
    assert.equal(result.reasonCode, "REVIEW_NAME_ONLY_NEVER_MERGE");
  });

  it("treats duplicate import_row_key as idempotent match", async () => {
    const store = new InMemoryClientMemoryStore();
    const key = peopleImportRowKey(12);
    const personId = await seedPerson(store, [
      { kind: "import_row_key", identifier: key },
    ]);
    const first = await resolvePersonIdentity(store, { importRowKey: key });
    const second = await resolvePersonIdentity(store, { importRowKey: key });
    assert.equal(first.status, "matched");
    assert.equal(second.status, "matched");
    assert.equal(first.personId, personId);
    assert.equal(second.personId, personId);
  });

  it("rejects malformed email without inventing a hash match", async () => {
    const store = new InMemoryClientMemoryStore();
    const result = await resolvePersonIdentity(store, { email: "not-an-email" });
    assert.equal(result.status, "invalid");
    assert.equal(result.reasonCode, "INVALID_MALFORMED_IDENTITY");
    assert.equal(hashEmail("not-an-email"), null);
  });

  it("rejects malformed phone without inventing a hash match", async () => {
    const store = new InMemoryClientMemoryStore();
    const result = await resolvePersonIdentity(store, { phone: "123" });
    assert.equal(result.status, "invalid");
    assert.equal(hashPhone("123"), null);
  });

  it("treats blank identity fields as invalid, not a name merge", async () => {
    const store = new InMemoryClientMemoryStore();
    const result = await resolvePersonIdentity(store, {
      email: "   ",
      phone: "",
      importRowKey: null,
    });
    assert.equal(result.status, "invalid");
    assert.equal(result.reasonCode, "INVALID_NO_DETERMINISTIC_IDENTITY");
  });

  it("reviews when one identity key points at two persons", async () => {
    const store = new InMemoryClientMemoryStore();
    const hash = hashEmail("shared@example.com")!;
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
        id: randomUUID(),
        entityId: a.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "email_hash",
        identifier: hash,
        createdAt: NOW,
      }),
    );
    // Bypass unique index to simulate a corrupt/multi-person key.
    const second = newExternalIdentity({
      entityId: b.record.id,
      sourceSystem: "hubspot",
      identityKind: "email_hash",
      identifier: hash,
      createdAt: NOW,
    });
    const written = await store.insertExternalIdentity(second);
    assert.equal(written.status, "inserted");
    const result = await resolvePersonIdentity(store, {
      email: "shared@example.com",
    });
    assert.equal(result.status, "review");
    assert.equal(result.reasonCode, "REVIEW_IDENTITY_COLLISION");
  });

  it("does not treat workbook Likely as identity proof", async () => {
    const store = new InMemoryClientMemoryStore();
    const result = await resolvePersonIdentity(store, {
      email: "ada@example.com",
      likelyMatch: true,
    });
    assert.equal(result.status, "review");
    assert.equal(result.reasonCode, "REVIEW_LIKELY_NOT_IDENTITY_PROOF");
  });

  it("prefers hubspot contact id over email", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, [
      { kind: "hubspot_contact_id", identifier: "123" },
      { kind: "email_hash", identifier: hashEmail("ada@example.com")! },
    ]);
    const result = await resolvePersonIdentity(store, {
      hubspotContactId: "123",
      email: "ada@example.com",
    });
    assert.equal(result.status, "matched");
    assert.equal(result.personId, personId);
    assert.equal(result.matchedBy, "hubspot_contact_id");
  });
});
