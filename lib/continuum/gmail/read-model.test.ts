import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryClientMemoryStore, newExternalIdentity } from "@/lib/continuum/client-memory/store";
import {
  matchPersonByEmailHash,
  resolvePersonCandidate,
} from "./participants";
import { correlateExactProjectThread } from "./projects";

const NOW = "2026-08-27T16:00:00.000Z";

describe("Gmail participant read model", () => {
  it("matches an exact email hash to one Person and never creates Persons", async () => {
    const store = new InMemoryClientMemoryStore();
    const person = await store.insertEntity({
      kind: "person",
      createdAt: NOW,
      createdBy: "test",
    });
    assert.equal(person.status, "inserted");
    const emailHash = hashEmail("client@example.com")!;
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: "continuum-reconciliation-v3",
        identityKind: "email_hash",
        identifier: emailHash,
        createdAt: NOW,
      }),
    );
    const before = await store.inspectCounts();
    const match = await resolvePersonCandidate({
      email: "client@example.com",
      lookup: store,
    });
    assert.deepEqual(match, {
      status: "candidate",
      personId: person.record.id,
    });
    const unresolved = await resolvePersonCandidate({
      email: "unknown@example.com",
      lookup: store,
    });
    assert.deepEqual(unresolved, { status: "unresolved" });
    const after = await store.inspectCounts();
    assert.equal(after.persons, before.persons);
    assert.equal(after.identities, before.identities);
  });

  it("returns REVIEW_IDENTITY_COLLISION for multiple exact Person matches", () => {
    const hash = hashEmail("shared@example.com")!;
    const match = matchPersonByEmailHash(hash, [
      {
        entityId: "person-a",
        identityKind: "email_hash",
        identifier: hash,
        revokedAt: null,
      },
      {
        entityId: "person-b",
        identityKind: "email_hash",
        identifier: hash,
        revokedAt: null,
      },
    ]);
    assert.equal(match.status, "REVIEW_IDENTITY_COLLISION");
    if (match.status === "REVIEW_IDENTITY_COLLISION") {
      assert.deepEqual([...match.personIds], ["person-a", "person-b"]);
    }
  });

  it("does not treat internal Hourglass addresses as Person candidates", async () => {
    const store = new InMemoryClientMemoryStore();
    const match = await resolvePersonCandidate({
      email: "studio@hourglass.example",
      lookup: store,
      internalAddresses: ["studio@hourglass.example"],
    });
    assert.deepEqual(match, { status: "internal" });
    assert.equal((await store.inspectCounts()).persons, 0);
  });

  it("does not gmail-dot or plus-normalize addresses", () => {
    const dotted = hashEmail("first.last@example.com");
    const plus = hashEmail("firstlast+tag@example.com");
    const collapsed = hashEmail("firstlast@example.com");
    assert.notEqual(dotted, collapsed);
    assert.notEqual(plus, collapsed);
  });
});

describe("Gmail exact project thread correlation", () => {
  it("matches only exact project_history.gmail_thread_id values", () => {
    const exact = correlateExactProjectThread("18abc123def456", [
      { projectId: "proj-1", gmailThreadId: "18abc123def456" },
      { projectId: "proj-2", gmailThreadId: "18fffffffffff0" },
    ]);
    assert.deepEqual(exact, { status: "exact", projectIds: ["proj-1"] });
  });

  it("ignores invalid and blank project pointers", () => {
    const ignored = correlateExactProjectThread("18abc123def456", [
      { projectId: "blank", gmailThreadId: null },
      { projectId: "empty", gmailThreadId: "  " },
      { projectId: "scientific", gmailThreadId: "1.23e+18" },
      { projectId: "tiny", gmailThreadId: "7" },
    ]);
    assert.deepEqual(ignored, { status: "unmatched" });
  });
});
