import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPiiViolation } from "../contracts/validation";
import { applyReconciliationWorkbook } from "./apply";
import { fingerprintWorkbook } from "./artifact";
import { hashEmail, peopleImportRowKey } from "./hashes";
import {
  InMemoryClientMemoryStore,
} from "./store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";
import {
  buildSyntheticXlsx,
  emptyWorkbookSheets,
  personCells,
  projectCells,
} from "./synthetic-xlsx";

const NOW = "2026-08-22T00:00:00.000Z";

function applyOpts(
  store: InMemoryClientMemoryStore,
  xlsx: Uint8Array,
): Parameters<typeof applyReconciliationWorkbook>[1] {
  return {
    apply: true,
    confirmProductionClientImport: true,
    envEnabled: true,
    target: "memory",
    store,
    expectedFingerprint: fingerprintWorkbook(xlsx),
  };
}

function peopleBook(people: ReturnType<typeof personCells>[]) {
  return buildSyntheticXlsx(emptyWorkbookSheets({ people }));
}

describe("Client Memory apply importer", () => {
  it("fails closed unless every apply gate is present", async () => {
    const xlsx = peopleBook([
      personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const missingConfirm = await applyReconciliationWorkbook(xlsx, {
      apply: true,
      confirmProductionClientImport: false,
      envEnabled: true,
      target: "memory",
      store,
      expectedFingerprint: fingerprintWorkbook(xlsx),
    });
    assert.equal(missingConfirm.ok, false);
    if (!missingConfirm.ok) {
      assert.equal(missingConfirm.reason, "APPLY_REQUIRES_CONFIRMATION");
    }
    const missingEnv = await applyReconciliationWorkbook(xlsx, {
      apply: true,
      confirmProductionClientImport: true,
      envEnabled: false,
      target: "memory",
      store,
      expectedFingerprint: fingerprintWorkbook(xlsx),
    });
    assert.equal(missingEnv.ok, false);
    const missingTarget = await applyReconciliationWorkbook(xlsx, {
      apply: true,
      confirmProductionClientImport: true,
      envEnabled: true,
      target: null,
      store,
      expectedFingerprint: fingerprintWorkbook(xlsx),
    });
    assert.equal(missingTarget.ok, false);
    const badFingerprint = await applyReconciliationWorkbook(xlsx, {
      apply: true,
      confirmProductionClientImport: true,
      envEnabled: true,
      target: "memory",
      store,
      expectedFingerprint: "0".repeat(64),
    });
    assert.equal(badFingerprint.ok, false);
    if (!badFingerprint.ok) {
      assert.equal(badFingerprint.reason, "WORKBOOK_FINGERPRINT_MISMATCH");
    }
    assert.equal((await store.inspectCounts()).persons, 0);
  });

  it("creates a person once and is idempotent on a second identical apply", async () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({
            name: "Ada Lovelace",
            email: "ada@example.com",
            phone: "3055550100",
          }),
        ],
        projects: [
          projectCells({
            canonicalClient: "Ada Lovelace",
            match: "Exact",
            title: "Ada ring",
            cad: "CAD-1",
            notes: "workshop note",
            reviewFlag: "Need to confirm metal later this week",
            thread: "19fc1a2b3c4d5e6f",
          }),
        ],
        review: [
          ["high", "review-id", "CAD-1", "Likely match", "manual review", "low"],
        ],
      }),
    );
    const store = new InMemoryClientMemoryStore();
    const first = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.personsCreated, 1);
    assert.equal(first.projectsExactLinked, 1);
    assert.equal(first.sourceNotesInserted, 2);
    assert.equal(first.reviewQueueImported, 1);
    assert.equal(findPiiViolation(first), null);
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 1);
    assert.equal(counts.profiles, 1);
    assert.ok(counts.identities >= 2);
    const second = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.personsCreated, 0);
    assert.equal(second.personsMatched, 1);
    const again = await store.inspectCounts();
    assert.equal(again.persons, counts.persons);
    assert.equal(again.profiles, counts.profiles);
    assert.equal(again.identities, counts.identities);
    assert.equal(again.relationships, counts.relationships);
    assert.equal(again.projects, counts.projects);
    assert.equal(second.projectsCreated, 0);
  });

  it("opens a review and does not mutate on a conflicting identity", async () => {
    const xlsx = peopleBook([
      personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    await store.createPersonAtomic({
      createdAt: NOW,
      createdBy: "test",
      profile: {
        displayName: "Existing A",
        givenName: "Existing",
        familyName: "A",
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
          identityKind: "email_hash",
          identifier: hashEmail("ada@example.com")!,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        },
      ],
    });
    await store.createPersonAtomic({
      createdAt: NOW,
      createdBy: "test",
      profile: {
        displayName: "Existing B",
        givenName: "Existing",
        familyName: "B",
        organizationName: null,
        email: null,
        phone: null,
        streetAddress: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        roles: [],
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: NOW,
        updatedAt: NOW,
      },
      identities: [
        {
          identityKind: "import_row_key",
          identifier: peopleImportRowKey(2),
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        },
      ],
    });
    const before = await store.inspectCounts();
    const result = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.personsCreated, 0);
    assert.equal(result.identityConflicts, 1);
    const after = await store.inspectCounts();
    assert.equal(after.persons, before.persons);
    assert.equal(after.profiles, before.profiles);
  });

  it("reviews a changed protected profile field instead of overwriting", async () => {
    const xlsx = peopleBook([
      personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const created = await store.createPersonAtomic({
      createdAt: NOW,
      createdBy: "test",
      profile: {
        displayName: "Ada Lovelace",
        givenName: "Ada",
        familyName: "Lovelace",
        organizationName: null,
        email: "old@example.com",
        phone: null,
        streetAddress: "1 Test Street",
        city: "Miami",
        state: "FL",
        country: "US",
        postalCode: "33101",
        roles: ["client"],
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: NOW,
        updatedAt: NOW,
      },
      identities: [
        {
          identityKind: "import_row_key",
          identifier: peopleImportRowKey(2),
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        },
      ],
    });
    const result = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.profileConflicts, 1);
    assert.equal(result.personsCreated, 0);
    const profile = await store.getPersonProfile(created.personId);
    assert.equal(profile?.email, "old@example.com");
  });

  it("creates a person for unsupported international phones without hashing the phone", async () => {
    const xlsx = peopleBook([
      personCells({
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+44 20 7946 0958",
      }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const result = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.skippedUnsupportedPhone, 0);
    assert.equal(result.personsCreated, 1);
    assert.equal(result.identityWarnings, 1);
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 1);
    assert.equal(counts.identitiesByKind.phone_hash ?? 0, 0);
    assert.ok((counts.identitiesByKind.import_row_key ?? 0) >= 1);
    assert.ok((counts.identitiesByKind.email_hash ?? 0) >= 1);
    assert.ok(counts.reviews >= 1);
  });

  it("creates an eligible person with malformed email and does not attach email_hash", async () => {
    const xlsx = peopleBook([
      personCells({ name: "Ada Lovelace", email: "not-an-email" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const result = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.personsCreated, 1);
    const counts = await store.inspectCounts();
    assert.equal(counts.identitiesByKind.email_hash ?? 0, 0);
    assert.equal(counts.identitiesByKind.import_row_key, 1);
    const hits = await store.findActiveIdentities({
      identityKind: "import_row_key",
      identifier: peopleImportRowKey(2),
    });
    const profile = await store.getPersonProfile(hits[0].entityId!);
    assert.deepEqual(profile?.roles, ["client"]);
    assert.equal(profile?.email, "not-an-email");
  });

  it("adds client role without replacing existing roles on a matched person", async () => {
    const xlsx = peopleBook([
      personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
    ]);
    const store = new InMemoryClientMemoryStore();
    const created = await store.createPersonAtomic({
      createdAt: NOW,
      createdBy: "test",
      profile: {
        displayName: "Ada Lovelace",
        givenName: "Ada",
        familyName: "Lovelace",
        organizationName: null,
        email: "ada@example.com",
        phone: null,
        streetAddress: "1 Test Street",
        city: "Miami",
        state: "FL",
        country: "US",
        postalCode: "33101",
        roles: ["prospect"],
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: NOW,
        updatedAt: NOW,
      },
      identities: [
        {
          identityKind: "import_row_key",
          identifier: peopleImportRowKey(2),
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        },
      ],
    });
    const result = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.personsCreated, 0);
    assert.equal(result.personsMatched, 1);
    const profile = await store.getPersonProfile(created.personId);
    assert.deepEqual(profile?.roles, ["prospect", "client"]);
  });

  it("does not apply needs-review people rows", async () => {
    const xlsx = peopleBook([personCells({ name: "Madonna" })]);
    const store = new InMemoryClientMemoryStore();
    const result = await applyReconciliationWorkbook(xlsx, applyOpts(store, xlsx));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.skippedNeedsReview, 1);
    assert.equal(result.personsCreated, 0);
  });
});
