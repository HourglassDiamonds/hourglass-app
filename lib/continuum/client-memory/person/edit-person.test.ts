import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { hashEmail, hashPhone } from "../hashes";
import { searchPeopleFromSnapshot } from "../read/search";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
} from "../store";
import { CLIENT_MEMORY_SOURCE_SYSTEM, type PersonProfile, type PersonRole } from "../types";
import { editPersonProfile, type EditPersonProfileDeps } from "./edit-person";
import { MANUAL_PERSON_SOURCE_SYSTEM } from "./types";
import { createInMemoryClientMemoryPersonWriter } from "./writer";

const NOW = "2026-08-25T14:00:00.000Z";

function depsFromStore(
  store: InMemoryClientMemoryStore,
  extras?: Partial<EditPersonProfileDeps>,
): EditPersonProfileDeps {
  return {
    nowIso: () => NOW,
    findActiveIdentities: (query) => store.findActiveIdentities(query),
    getPersonProfile: (personId) => store.getPersonProfile(personId),
    updatePersonContactAtomic: (row) => store.updatePersonContactAtomic(row),
    ...extras,
  };
}

async function seedPerson(
  store: InMemoryClientMemoryStore,
  input: {
    displayName: string;
    givenName?: string | null;
    familyName?: string | null;
    organizationName?: string | null;
    email?: string | null;
    phone?: string | null;
    streetAddress?: string | null;
    roles?: PersonRole[];
    identities?: Array<{
      kind: "email_hash" | "phone_hash" | "hubspot_contact_id" | "google_contact_id" | "import_row_key";
      identifier: string;
      sourceSystem?: PersonProfile["sourceSystem"];
    }>;
  },
): Promise<string> {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  const profile: PersonProfile = {
    personId: person.record.id,
    displayName: input.displayName,
    givenName: input.givenName ?? null,
    familyName: input.familyName ?? null,
    organizationName: input.organizationName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    streetAddress: input.streetAddress ?? null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: input.roles ?? ["client"],
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await store.insertPersonProfile(profile);
  for (const identity of input.identities ?? []) {
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: identity.sourceSystem ?? CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: identity.kind,
        identifier: identity.identifier,
        createdAt: NOW,
      }),
    );
  }
  return person.record.id;
}

describe("Edit Person writer", () => {
  it("corrects first/last name on the same Person UUID and search sees it", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Jon Smith",
      givenName: "Jon",
      familyName: "Smith",
      email: "jon@example.com",
      identities: [
        { kind: "email_hash", identifier: hashEmail("jon@example.com")! },
      ],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "John",
      familyName: "Smith",
      email: "jon@example.com",
    });
    assert.equal(result.status, "updated");
    if (result.status !== "updated") return;
    assert.equal(result.personId, personId);
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.displayName, "John Smith");
    assert.equal(profile?.givenName, "John");
    assert.equal(profile?.familyName, "Smith");
    assert.equal(profile?.sourceSystem, CLIENT_MEMORY_SOURCE_SYSTEM);
    const search = searchPeopleFromSnapshot(
      { profiles: [profile!], relationships: [] },
      "John",
    );
    assert.equal(search[0]?.personId, personId);
    assert.equal((await store.inspectCounts()).persons, 1);
  });

  it("preserves a richer display_name when given/family are unchanged", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Mary Ann Smith",
      givenName: "Mary",
      familyName: "Smith",
      organizationName: "Acme",
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Mary",
      familyName: "Smith",
      organization: "Acme",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.displayName, "Mary Ann Smith");
    assert.equal(profile?.givenName, "Mary");
    assert.equal(profile?.familyName, "Smith");
  });

  it("keeps display_name when given/family were empty and the form is only seeded", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Mary Ann Smith",
      givenName: null,
      familyName: null,
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Mary",
      familyName: "Smith",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.displayName, "Mary Ann Smith");
    assert.equal(profile?.givenName, "Mary");
    assert.equal(profile?.familyName, "Smith");
  });

  it("recomputes display_name when first or last actually changes", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Mary Ann Smith",
      givenName: "Mary",
      familyName: "Smith",
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Marie",
      familyName: "Smith",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.displayName, "Marie Smith");
  });

  it("edits organization, clears it, and preserves roles and address", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      organizationName: "Acme Corp",
      streetAddress: "1 Test Street",
      roles: ["friend", "client"],
    });
    const writer = createInMemoryClientMemoryPersonWriter(store);
    const renamed = await writer.editPersonProfile({
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      organization: "NewCo",
    });
    assert.equal(renamed.status, "updated");
    let profile = await store.getPersonProfile(personId);
    assert.equal(profile?.organizationName, "NewCo");
    assert.deepEqual(profile?.roles, ["friend", "client"]);
    assert.equal(profile?.streetAddress, "1 Test Street");
    assert.equal(
      searchPeopleFromSnapshot({ profiles: [profile!], relationships: [] }, "NewCo")[0]
        ?.personId,
      personId,
    );

    const cleared = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      organization: "",
    });
    assert.equal(cleared.status, "updated");
    profile = await store.getPersonProfile(personId);
    assert.equal(profile?.organizationName, null);
    assert.deepEqual(profile?.roles, ["friend", "client"]);
  });

  it("replaces email, revokes the old hash, and attaches the new hash", async () => {
    const store = new InMemoryClientMemoryStore();
    const oldHash = hashEmail("old@example.com")!;
    const newHash = hashEmail("new@example.com")!;
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "old@example.com",
      identities: [{ kind: "email_hash", identifier: oldHash }],
    });
    const before = await store.findActiveIdentities({
      identityKind: "email_hash",
      identifier: oldHash,
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "New@Example.com",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.email, "new@example.com");
    assert.equal(profile?.personId, personId);
    const oldHits = await store.findActiveIdentities({
      identityKind: "email_hash",
      identifier: oldHash,
    });
    const newHits = await store.findActiveIdentities({
      identityKind: "email_hash",
      identifier: newHash,
    });
    assert.equal(oldHits.length, 0);
    assert.equal(newHits.length, 1);
    assert.equal(newHits[0]?.entityId, personId);
    assert.equal(newHits[0]?.sourceSystem, MANUAL_PERSON_SOURCE_SYSTEM);
    const revoked = await store.getExternalIdentity(before[0]!.id);
    assert.ok(revoked?.revokedAt);
    assert.equal(
      searchPeopleFromSnapshot({ profiles: [profile!], relationships: [] }, "new@example.com")[0]
        ?.personId,
      personId,
    );
  });

  it("treats the same email as idempotent and does not duplicate the identity", async () => {
    const store = new InMemoryClientMemoryStore();
    const emailHash = hashEmail("ada@example.com")!;
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
      identities: [{ kind: "email_hash", identifier: emailHash }],
    });
    const before = await store.findActiveIdentities({
      identityKind: "email_hash",
      identifier: emailHash,
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
    });
    assert.equal(result.status, "updated");
    const after = await store.findActiveIdentities({
      identityKind: "email_hash",
      identifier: emailHash,
    });
    assert.equal(after.length, 1);
    assert.equal(after[0]?.id, before[0]?.id);
    assert.equal(after[0]?.revokedAt, null);
  });

  it("replaces phone and revokes the old hash", async () => {
    const store = new InMemoryClientMemoryStore();
    const oldHash = hashPhone("704-555-1212")!;
    const newHash = hashPhone("704-555-3434")!;
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      phone: "7045551212",
      identities: [{ kind: "phone_hash", identifier: oldHash }],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      phone: "704-555-3434",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.phone, "7045553434");
    assert.equal(
      (await store.findActiveIdentities({ identityKind: "phone_hash", identifier: oldHash }))
        .length,
      0,
    );
    const next = await store.findActiveIdentities({
      identityKind: "phone_hash",
      identifier: newHash,
    });
    assert.equal(next.length, 1);
    assert.equal(next[0]?.entityId, personId);
  });

  it("rejects an invalid or international phone without removing protection", async () => {
    const store = new InMemoryClientMemoryStore();
    const phoneHash = hashPhone("7045551212")!;
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      phone: "7045551212",
      identities: [{ kind: "phone_hash", identifier: phoneHash }],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      phone: "44 20 7946 0958",
    });
    assert.equal(result.status, "validation-error");
    if (result.status !== "validation-error") return;
    assert.equal(result.code, "invalid-phone");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.phone, "7045551212");
    assert.equal(
      (await store.findActiveIdentities({ identityKind: "phone_hash", identifier: phoneHash }))
        .length,
      1,
    );
  });

  it("fails closed on a cross-Person email conflict and does not merge", async () => {
    const store = new InMemoryClientMemoryStore();
    const personA = await seedPerson(store, {
      displayName: "Person A",
      givenName: "Ada",
      familyName: "A",
      email: "ada@example.com",
      identities: [{ kind: "email_hash", identifier: hashEmail("ada@example.com")! }],
    });
    const personB = await seedPerson(store, {
      displayName: "Person B",
      givenName: "Bea",
      familyName: "B",
      email: "bea@example.com",
      identities: [{ kind: "email_hash", identifier: hashEmail("bea@example.com")! }],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId: personA,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "A",
      email: "bea@example.com",
    });
    assert.equal(result.status, "identity-conflict");
    if (result.status !== "identity-conflict") return;
    assert.deepEqual(result.conflictingPersonIds, [personB]);
    const profileA = await store.getPersonProfile(personA);
    assert.equal(profileA?.email, "ada@example.com");
    assert.equal(profileA?.displayName, "Person A");
    assert.equal((await store.inspectCounts()).persons, 2);
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "email_hash",
        identifier: hashEmail("ada@example.com")!,
      }))[0]?.entityId,
      personA,
    );
  });

  it("fails closed when email and phone point at different people", async () => {
    const store = new InMemoryClientMemoryStore();
    const personA = await seedPerson(store, {
      displayName: "Person A",
      givenName: "Ada",
      familyName: "A",
      email: "ada@example.com",
      phone: "7045551212",
      identities: [
        { kind: "email_hash", identifier: hashEmail("ada@example.com")! },
        { kind: "phone_hash", identifier: hashPhone("7045551212")! },
      ],
    });
    await seedPerson(store, {
      displayName: "Person B",
      givenName: "Bea",
      familyName: "B",
      email: "bea@example.com",
      identities: [{ kind: "email_hash", identifier: hashEmail("bea@example.com")! }],
    });
    await seedPerson(store, {
      displayName: "Person C",
      givenName: "Cara",
      familyName: "C",
      phone: "7045553434",
      identities: [{ kind: "phone_hash", identifier: hashPhone("7045553434")! }],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId: personA,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "A",
      email: "bea@example.com",
      phone: "704-555-3434",
    });
    assert.equal(result.status, "identity-conflict");
    const profileA = await store.getPersonProfile(personA);
    assert.equal(profileA?.email, "ada@example.com");
    assert.equal(profileA?.phone, "7045551212");
    assert.equal((await store.inspectCounts()).persons, 3);
  });

  it("rolls back name, org, email, and phone together on identity failure", async () => {
    const store = new InMemoryClientMemoryStore();
    const personA = await seedPerson(store, {
      displayName: "Jon Smith",
      givenName: "Jon",
      familyName: "Smith",
      organizationName: "Acme",
      email: "jon@example.com",
      phone: "7045551212",
      identities: [
        { kind: "email_hash", identifier: hashEmail("jon@example.com")! },
        { kind: "phone_hash", identifier: hashPhone("7045551212")! },
      ],
    });
    await seedPerson(store, {
      displayName: "Other",
      givenName: "Other",
      familyName: "Person",
      email: "taken@example.com",
      identities: [{ kind: "email_hash", identifier: hashEmail("taken@example.com")! }],
    });
    const result = await store.updatePersonContactAtomic({
      personId: personA,
      updatedAt: NOW,
      profile: {
        displayName: "John Smith",
        givenName: "John",
        familyName: "Smith",
        organizationName: "NewCo",
        email: "taken@example.com",
        phone: "7045559999",
      },
      identities: [
        {
          identityKind: "email_hash",
          identifier: hashEmail("taken@example.com")!,
          sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
          createdAt: NOW,
        },
        {
          identityKind: "phone_hash",
          identifier: hashPhone("7045559999")!,
          sourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
          createdAt: NOW,
        },
      ],
    });
    assert.equal(result.status, "conflict");
    const profile = await store.getPersonProfile(personA);
    assert.equal(profile?.displayName, "Jon Smith");
    assert.equal(profile?.organizationName, "Acme");
    assert.equal(profile?.email, "jon@example.com");
    assert.equal(profile?.phone, "7045551212");
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "email_hash",
        identifier: hashEmail("jon@example.com")!,
      })).length,
      1,
    );
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "phone_hash",
        identifier: hashPhone("7045551212")!,
      })).length,
      1,
    );
  });

  it("saves name, org, email, and phone together when identities are free", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Jon Smith",
      givenName: "Jon",
      familyName: "Smith",
      organizationName: "Acme",
      email: "jon@example.com",
      phone: "7045551212",
      identities: [
        { kind: "email_hash", identifier: hashEmail("jon@example.com")! },
        { kind: "phone_hash", identifier: hashPhone("7045551212")! },
      ],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "John",
      familyName: "Smith",
      organization: "NewCo",
      email: "john@example.com",
      phone: "704-555-3434",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.displayName, "John Smith");
    assert.equal(profile?.organizationName, "NewCo");
    assert.equal(profile?.email, "john@example.com");
    assert.equal(profile?.phone, "7045553434");
  });

  it("does not revoke HubSpot, Google, or import identities", async () => {
    const store = new InMemoryClientMemoryStore();
    const oldHash = hashEmail("old@example.com")!;
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "old@example.com",
      identities: [
        { kind: "email_hash", identifier: oldHash },
        { kind: "hubspot_contact_id", identifier: "hs-1", sourceSystem: "hubspot" },
        { kind: "google_contact_id", identifier: "gc-1" },
        { kind: "import_row_key", identifier: "continuum-reconciliation-v3:People:2" },
      ],
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "new@example.com",
    });
    assert.equal(result.status, "updated");
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "hubspot_contact_id",
        identifier: "hs-1",
      }))[0]?.entityId,
      personId,
    );
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "google_contact_id",
        identifier: "gc-1",
      }))[0]?.entityId,
      personId,
    );
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "import_row_key",
        identifier: "continuum-reconciliation-v3:People:2",
      }))[0]?.entityId,
      personId,
    );
    assert.equal(
      (await store.findActiveIdentities({
        identityKind: "email_hash",
        identifier: oldHash,
      })).length,
      0,
    );
  });

  it("rejects clearing a populated email or phone", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
      phone: "7045551212",
      identities: [
        { kind: "email_hash", identifier: hashEmail("ada@example.com")! },
        { kind: "phone_hash", identifier: hashPhone("7045551212")! },
      ],
    });
    const emailClear = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "",
      phone: "7045551212",
    });
    assert.equal(emailClear.status, "validation-error");
    if (emailClear.status === "validation-error") {
      assert.equal(emailClear.code, "email-required");
    }
    const phoneClear = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
      phone: "",
    });
    assert.equal(phoneClear.status, "validation-error");
    if (phoneClear.status === "validation-error") {
      assert.equal(phoneClear.code, "phone-required");
    }
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.email, "ada@example.com");
    assert.equal(profile?.phone, "7045551212");
  });

  it("allows email and phone to remain null when they were already blank", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
    });
    const result = await editPersonProfile(depsFromStore(store), {
      personId,
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "",
      phone: "",
    });
    assert.equal(result.status, "updated");
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.email, null);
    assert.equal(profile?.phone, null);
  });
});
