import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateIdentityKind } from "../contracts/validation";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
} from "./store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";

const NOW = "2026-08-22T00:00:00.000Z";

describe("Client Memory store", () => {
  it("inserts and fetches entities", async () => {
    const store = new InMemoryClientMemoryStore();
    const inserted = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    assert.equal(inserted.status, "inserted");
    const got = await store.getEntity(inserted.record.id);
    assert.equal(got?.kind, "person");
    const replay = await store.insertEntity({
      id: inserted.record.id,
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    assert.equal(replay.status, "already-present");
  });

  it("upserts identities with deterministic conflict on different persons", async () => {
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
    const identity = newExternalIdentity({
      entityId: a.record.id,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      identityKind: "import_row_key",
      identifier: "continuum-reconciliation-v3:People:2",
      createdAt: NOW,
    });
    assert.equal((await store.insertExternalIdentity(identity)).status, "inserted");
    assert.equal((await store.upsertExternalIdentity(identity)).status, "already-present");
    const conflict = await store.upsertExternalIdentity({
      ...identity,
      id: "00000000-0000-0000-0000-000000000099",
      entityId: b.record.id,
    });
    assert.equal(conflict.status, "conflict");
    const fetched = await store.getExternalIdentity(identity.id);
    assert.equal(fetched?.entityId, a.record.id);
  });

  it("rejects hubspot_deal_id as a person identity", async () => {
    assert.equal(validateIdentityKind("hubspot_deal_id").ok, false);
    const store = new InMemoryClientMemoryStore();
    await assert.rejects(
      () =>
        store.insertExternalIdentity(
          newExternalIdentity({
            entityId: "x",
            sourceSystem: "hubspot",
            identityKind: "hubspot_deal_id" as never,
            identifier: "deal-1",
            createdAt: NOW,
          }),
        ),
      /hubspot_deal_id|unsupported identity/,
    );
  });

  it("stores and updates a protected person profile", async () => {
    const store = new InMemoryClientMemoryStore();
    const person = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const inserted = await store.insertPersonProfile({
      personId: person.record.id,
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      organizationName: null,
      email: "ada@example.com",
      phone: "3055550100",
      streetAddress: "1 Test Street",
      city: "Miami",
      state: "FL",
      country: "US",
      postalCode: "33101",
      roles: ["client"],
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(inserted.status, "inserted");
    const updated = await store.updatePersonProfile(person.record.id, {
      city: "Coral Gables",
      updatedAt: "2026-08-22T01:00:00.000Z",
    });
    assert.equal(updated?.city, "Coral Gables");
    assert.equal(updated?.email, "ada@example.com");
  });

  it("inserts facts without overwriting the prior row", async () => {
    const store = new InMemoryClientMemoryStore();
    const first = await store.insertPersonFact({
      id: "fact-1",
      personId: "person-1",
      factType: "finger-size",
      value: { size: "6" },
      confidence: 0.4,
      verification: null,
      approvalStatus: "pending-review",
      status: "candidate",
      visibility: "internal",
      usagePermission: "internal-use",
      validFrom: null,
      validUntil: null,
      supersedesId: null,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    const second = await store.insertPersonFact({
      id: "fact-2",
      personId: "person-1",
      factType: "finger-size",
      value: { size: "6.5" },
      confidence: 0.4,
      verification: null,
      approvalStatus: "pending-review",
      status: "candidate",
      visibility: "internal",
      usagePermission: "internal-use",
      validFrom: null,
      validUntil: null,
      supersedesId: "fact-1",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    assert.equal(first.status, "inserted");
    assert.equal(second.status, "inserted");
    assert.equal((await store.getPersonFact("fact-1"))?.status, "candidate");
    assert.equal((await store.getPersonFact("fact-2"))?.supersedesId, "fact-1");
  });
});
