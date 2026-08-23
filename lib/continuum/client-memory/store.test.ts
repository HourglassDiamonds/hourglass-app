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
    const person = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const first = await store.insertPersonFact({
      id: "fact-1",
      personId: person.record.id,
      factType: "finger-size",
      value: { size: "6" },
      confidence: 0.4,
      verification: null,
      approvalStatus: "pending-review",
      status: "candidate",
      visibility: "internal-only",
      usagePermission: "unset",
      validFrom: null,
      validUntil: null,
      supersedesId: null,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    const second = await store.insertPersonFact({
      id: "fact-2",
      personId: person.record.id,
      factType: "finger-size",
      value: { size: "6.5" },
      confidence: 0.4,
      verification: null,
      approvalStatus: "pending-review",
      status: "candidate",
      visibility: "internal-only",
      usagePermission: "unset",
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

  it("rejects a second current fact of the same type and allows mixed statuses", async () => {
    const store = new InMemoryClientMemoryStore();
    const person = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const base = {
      personId: person.record.id,
      factType: "birthday",
      value: { day: "1990-01-01" },
      confidence: 0.9,
      verification: null,
      approvalStatus: "approved" as const,
      visibility: "internal-only" as const,
      usagePermission: "unset" as const,
      validFrom: null,
      validUntil: null,
      supersedesId: null,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    };
    assert.equal(
      (await store.insertPersonFact({ ...base, id: "b1", status: "current" }))
        .status,
      "inserted",
    );
    await assert.rejects(
      () => store.insertPersonFact({ ...base, id: "b2", status: "current" }),
      /current-fact-conflict/,
    );
    assert.equal(
      (
        await store.insertPersonFact({
          ...base,
          id: "b3",
          status: "conflicting",
          value: { day: "1991-01-01" },
        })
      ).status,
      "inserted",
    );
    assert.equal(
      (
        await store.insertPersonFact({
          ...base,
          id: "b4",
          status: "superseded",
          value: { day: "1989-01-01" },
        })
      ).status,
      "inserted",
    );
  });

  it("rejects Date/NaN fact values and person/project kind mismatches", async () => {
    const store = new InMemoryClientMemoryStore();
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
    await assert.rejects(
      () =>
        store.insertPersonFact({
          id: "bad",
          personId: person.record.id,
          factType: "birthday",
          value: new Date("2026-01-01") as never,
          confidence: 0.5,
          verification: null,
          approvalStatus: "pending-review",
          status: "candidate",
          visibility: "internal-only",
          usagePermission: "unset",
          validFrom: null,
          validUntil: null,
          supersedesId: null,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          createdBy: "test",
        }),
      /JSON-safe/,
    );
    await assert.rejects(
      () =>
        store.insertPersonProfile({
          personId: project.record.id,
          displayName: "Nope",
          givenName: null,
          familyName: null,
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
        }),
      /person-profile-requires-person-entity/,
    );
    await assert.rejects(
      () =>
        store.insertProjectProfile({
          projectId: person.record.id,
          displayTitle: "Nope",
          visibility: "internal-only",
          importRowKey: null,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      /project-profile-requires-project-entity/,
    );
  });

  it("enforces relationship invariants and source-field note provenance", async () => {
    const store = new InMemoryClientMemoryStore();
    const a = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    const b = await store.insertEntity({
      kind: "project",
      createdAt: NOW,
      createdBy: "test",
    });
    await assert.rejects(
      () =>
        store.insertRelationship({
          id: "rel-self",
          fromEntityId: a.record.id,
          toEntityId: a.record.id,
          kind: "spouse",
          status: "active",
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          createdAt: NOW,
          createdBy: "test",
        }),
      /relationship-self/,
    );
    const rel = await store.insertRelationship({
      id: "rel-1",
      fromEntityId: a.record.id,
      toEntityId: b.record.id,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    assert.equal(rel.status, "inserted");
    const replay = await store.insertRelationship({
      id: "rel-2",
      fromEntityId: a.record.id,
      toEntityId: b.record.id,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
    assert.equal(replay.status, "already-present");
    const notes = await store.insertSourceNote({
      id: "n1",
      personId: a.record.id,
      projectId: b.record.id,
      contextLayer: "client",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: "continuum-reconciliation-v3",
      sourceSheet: "Reconciled Projects",
      sourceField: "Notes",
      importRowKey: "continuum-reconciliation-v3:ReconciledProjects:2",
      gmailThreadId: null,
      noteText: "note",
      createdAt: NOW,
    });
    const flag = await store.insertSourceNote({
      id: "n2",
      personId: a.record.id,
      projectId: b.record.id,
      contextLayer: "client",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: "continuum-reconciliation-v3",
      sourceSheet: "Reconciled Projects",
      sourceField: "Review Flag",
      importRowKey: "continuum-reconciliation-v3:ReconciledProjects:2",
      gmailThreadId: null,
      noteText: "flag",
      createdAt: NOW,
    });
    assert.equal(notes.status, "inserted");
    assert.equal(flag.status, "inserted");
  });

  it("rolls back a failed atomic person create", async () => {
    const store = new InMemoryClientMemoryStore();
    store.failNextCreateAfter = "entity";
    await assert.rejects(
      () =>
        store.createPersonAtomic({
          createdAt: NOW,
          createdBy: "test",
          profile: {
            displayName: "Ada Lovelace",
            givenName: "Ada",
            familyName: "Lovelace",
            organizationName: null,
            email: "ada@example.com",
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
          },
          identities: [
            {
              identityKind: "import_row_key",
              identifier: "continuum-reconciliation-v3:People:2",
              sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
            },
          ],
        }),
      /simulated-failure-after-entity/,
    );
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 0);
    assert.equal(counts.profiles, 0);
    assert.equal(counts.identities, 0);
  });
});
