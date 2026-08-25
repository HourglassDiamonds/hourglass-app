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
import { addManualClient, type AddManualClientDeps } from "./add-manual-client";
import {
  MANUAL_PERSON_CREATED_BY,
  MANUAL_PERSON_NAME_MAX_LENGTH,
  MANUAL_PERSON_SOURCE_SYSTEM,
} from "./types";
import { createInMemoryClientMemoryPersonWriter } from "./writer";

const NOW = "2026-08-25T12:00:00.000Z";

function depsFromStore(
  store: InMemoryClientMemoryStore,
  extras?: Partial<AddManualClientDeps>,
): AddManualClientDeps {
  return {
    nowIso: () => NOW,
    findActiveIdentities: (query) => store.findActiveIdentities(query),
    createPersonAtomic: (row) => store.createPersonAtomic(row),
    getPersonProfile: (personId) => store.getPersonProfile(personId),
    updatePersonProfile: (personId, patch) =>
      store.updatePersonProfile(personId, patch),
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
    roles?: PersonRole[];
    identities?: Array<{ kind: "email_hash" | "phone_hash"; identifier: string }>;
    identitySourceSystem?: PersonProfile["sourceSystem"];
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
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: input.roles ?? [],
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await store.insertPersonProfile(profile);
  for (const identity of input.identities ?? []) {
    await store.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: input.identitySourceSystem ?? CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: identity.kind,
        identifier: identity.identifier,
        createdAt: NOW,
      }),
    );
  }
  return person.record.id;
}

describe("manual Add Client writer", () => {
  it("creates a Person with email, phone, organization, client role, and hashes", async () => {
    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryPersonWriter(store);
    const submissionId = randomUUID();
    const result = await writer.addManualClient({
      submissionId,
      givenName: " John ",
      familyName: " Smith ",
      email: "John@Example.com",
      phone: "(704) 555-1212",
      organization: " Acme Corp ",
    });
    assert.equal(result.status, "created");
    if (result.status !== "created") return;
    assert.equal(result.personId, submissionId);
    const profile = await store.getPersonProfile(result.personId);
    assert.equal(profile?.displayName, "John Smith");
    assert.equal(profile?.givenName, "John");
    assert.equal(profile?.familyName, "Smith");
    assert.equal(profile?.organizationName, "Acme Corp");
    assert.equal(profile?.email, "john@example.com");
    assert.equal(profile?.phone, "7045551212");
    assert.deepEqual(profile?.roles, ["client"]);
    assert.equal(profile?.sourceSystem, MANUAL_PERSON_SOURCE_SYSTEM);
    const entity = await store.getEntity(result.personId);
    assert.equal(entity?.kind, "person");
    assert.equal(entity?.createdBy, MANUAL_PERSON_CREATED_BY);
    const emailHits = await store.findActiveIdentities({
      identityKind: "email_hash",
      identifier: hashEmail("john@example.com")!,
    });
    const phoneHits = await store.findActiveIdentities({
      identityKind: "phone_hash",
      identifier: hashPhone("704-555-1212")!,
    });
    assert.equal(emailHits.length, 1);
    assert.equal(emailHits[0]?.entityId, result.personId);
    assert.equal(emailHits[0]?.sourceSystem, MANUAL_PERSON_SOURCE_SYSTEM);
    assert.equal(phoneHits.length, 1);
    assert.equal(phoneHits[0]?.entityId, result.personId);
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 1);
    assert.equal(counts.notes, 0);
    assert.equal(counts.facts, 0);
    const search = searchPeopleFromSnapshot(
      { profiles: [profile!], relationships: [] },
      "John",
    );
    assert.equal(search[0]?.personId, result.personId);
    assert.equal(
      searchPeopleFromSnapshot({ profiles: [profile!], relationships: [] }, "john@example.com")[0]
        ?.personId,
      result.personId,
    );
    assert.equal(
      searchPeopleFromSnapshot({ profiles: [profile!], relationships: [] }, "704-555-1212")[0]
        ?.personId,
      result.personId,
    );
    assert.equal(
      searchPeopleFromSnapshot({ profiles: [profile!], relationships: [] }, "Acme")[0]?.personId,
      result.personId,
    );
  });

  it("creates a name-only Person without identities and never merges on name", async () => {
    const store = new InMemoryClientMemoryStore();
    const deps = depsFromStore(store);
    const firstId = randomUUID();
    const first = await addManualClient(deps, {
      submissionId: firstId,
      givenName: "John",
      familyName: "Smith",
    });
    const secondId = randomUUID();
    const second = await addManualClient(deps, {
      submissionId: secondId,
      givenName: "John",
      familyName: "Smith",
    });
    assert.equal(first.status, "created");
    assert.equal(second.status, "created");
    if (first.status !== "created" || second.status !== "created") return;
    assert.notEqual(first.personId, second.personId);
    const firstProfile = await store.getPersonProfile(first.personId);
    const secondProfile = await store.getPersonProfile(second.personId);
    assert.deepEqual(firstProfile?.roles, ["client"]);
    assert.deepEqual(secondProfile?.roles, ["client"]);
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 2);
    assert.equal(counts.identities, 0);
  });

  it("creates from first name only or last name only", async () => {
    const store = new InMemoryClientMemoryStore();
    const deps = depsFromStore(store);
    const givenOnly = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Justin",
      familyName: "   ",
    });
    const familyOnly = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "",
      familyName: "Smith",
    });
    assert.equal(givenOnly.status, "created");
    assert.equal(familyOnly.status, "created");
    if (givenOnly.status !== "created" || familyOnly.status !== "created") return;
    assert.equal((await store.getPersonProfile(givenOnly.personId))?.displayName, "Justin");
    assert.equal((await store.getPersonProfile(familyOnly.personId))?.displayName, "Smith");
  });

  it("returns existing-person on exact email or phone match and adds client additively", async () => {
    const store = new InMemoryClientMemoryStore();
    const emailHash = hashEmail("ada@example.com")!;
    const phoneHash = hashPhone("3055550100")!;
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
      organizationName: "Analytical Engines",
      email: "ada@example.com",
      phone: "3055550100",
      roles: ["friend"],
      identities: [
        { kind: "email_hash", identifier: emailHash },
        { kind: "phone_hash", identifier: phoneHash },
      ],
    });
    const deps = depsFromStore(store);
    const byEmail = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ADA@example.com",
    });
    assert.deepEqual(byEmail, { status: "existing-person", personId });
    let profile = await store.getPersonProfile(personId);
    assert.deepEqual(profile?.roles, ["friend", "client"]);

    const other = await seedPerson(store, {
      displayName: "Other",
      roles: ["personal"],
      phone: "7045551212",
      identities: [{ kind: "phone_hash", identifier: hashPhone("7045551212")! }],
    });
    const byPhone = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Other",
      phone: "704-555-1212",
    });
    assert.deepEqual(byPhone, { status: "existing-person", personId: other });
    assert.deepEqual((await store.getPersonProfile(other))?.roles, ["personal", "client"]);

    const both = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Ada",
      email: "ada@example.com",
      phone: "305-555-0100",
    });
    assert.deepEqual(both, { status: "existing-person", personId });
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 2);
    assert.equal(
      (await store.findActiveIdentities({ identityKind: "email_hash", identifier: emailHash }))
        .length,
      1,
    );
  });

  it("does not clobber existing profile fields on exact identity match", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Sarah Johnson",
      givenName: "Sarah",
      familyName: "Johnson",
      organizationName: "Acme",
      email: "sarah@example.com",
      roles: ["friend"],
      identities: [{ kind: "email_hash", identifier: hashEmail("sarah@example.com")! }],
    });
    const result = await addManualClient(depsFromStore(store), {
      submissionId: randomUUID(),
      givenName: "Sally",
      familyName: "Jones",
      email: "sarah@example.com",
      organization: "Other Corp",
    });
    assert.deepEqual(result, { status: "existing-person", personId });
    const profile = await store.getPersonProfile(personId);
    assert.equal(profile?.displayName, "Sarah Johnson");
    assert.equal(profile?.givenName, "Sarah");
    assert.equal(profile?.familyName, "Johnson");
    assert.equal(profile?.organizationName, "Acme");
    assert.equal(profile?.email, "sarah@example.com");
    assert.deepEqual(profile?.roles, ["friend", "client"]);
  });

  it("leaves an existing client role unchanged", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Ada",
      email: "ada@example.com",
      roles: ["client"],
      identities: [{ kind: "email_hash", identifier: hashEmail("ada@example.com")! }],
    });
    const before = await store.getPersonProfile(personId);
    const result = await addManualClient(depsFromStore(store), {
      submissionId: randomUUID(),
      givenName: "Ada",
      email: "ada@example.com",
    });
    assert.deepEqual(result, { status: "existing-person", personId });
    const after = await store.getPersonProfile(personId);
    assert.deepEqual(after?.roles, ["client"]);
    assert.equal(after?.updatedAt, before?.updatedAt);
  });

  it("fails closed on email/phone cross-key conflict without mutating either Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const personA = await seedPerson(store, {
      displayName: "A",
      email: "ada@example.com",
      roles: ["friend"],
      identities: [{ kind: "email_hash", identifier: hashEmail("ada@example.com")! }],
    });
    const personB = await seedPerson(store, {
      displayName: "B",
      phone: "3055550100",
      roles: ["personal"],
      identities: [{ kind: "phone_hash", identifier: hashPhone("3055550100")! }],
    });
    const result = await addManualClient(depsFromStore(store), {
      submissionId: randomUUID(),
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
      phone: "3055550100",
    });
    assert.equal(result.status, "identity-conflict");
    if (result.status !== "identity-conflict") return;
    assert.equal(result.conflictingPersonIds.length, 2);
    assert.ok(result.conflictingPersonIds.includes(personA));
    assert.ok(result.conflictingPersonIds.includes(personB));
    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 2);
    assert.equal(counts.identities, 2);
    assert.equal(counts.reviews, 0);
    assert.deepEqual((await store.getPersonProfile(personA))?.roles, ["friend"]);
    assert.deepEqual((await store.getPersonProfile(personB))?.roles, ["personal"]);
  });

  it("rejects blank names, malformed email, and unsupported phones without creating a Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const deps = depsFromStore(store);
    const blank = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "   ",
      familyName: "",
    });
    assert.equal(blank.status, "validation-error");
    if (blank.status === "validation-error") assert.equal(blank.code, "missing-name");

    const email = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Ada",
      email: "not-an-email",
    });
    assert.equal(email.status, "validation-error");
    if (email.status === "validation-error") assert.equal(email.code, "invalid-email");

    const shortPhone = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Ada",
      phone: "123",
    });
    assert.equal(shortPhone.status, "validation-error");
    if (shortPhone.status === "validation-error") assert.equal(shortPhone.code, "invalid-phone");

    const international = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "Ada",
      phone: "+44 20 7946 0958",
    });
    assert.equal(international.status, "validation-error");
    if (international.status === "validation-error") {
      assert.equal(international.code, "invalid-phone");
    }

    const oversized = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "A".repeat(MANUAL_PERSON_NAME_MAX_LENGTH + 1),
    });
    assert.equal(oversized.status, "validation-error");
    if (oversized.status === "validation-error") assert.equal(oversized.code, "oversized-name");

    const counts = await store.inspectCounts();
    assert.equal(counts.persons, 0);
  });

  it("treats the same submissionId as one Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const deps = depsFromStore(store);
    const submissionId = randomUUID();
    const first = await addManualClient(deps, {
      submissionId,
      givenName: "John",
      familyName: "Smith",
    });
    const second = await addManualClient(deps, {
      submissionId,
      givenName: "John",
      familyName: "Smith",
    });
    assert.equal(first.status, "created");
    assert.equal(second.status, "created");
    if (first.status !== "created" || second.status !== "created") return;
    assert.equal(first.personId, second.personId);
    assert.equal((await store.inspectCounts()).persons, 1);
  });

  it("does not duplicate a Person when the same identity is submitted with a new id", async () => {
    const store = new InMemoryClientMemoryStore();
    const deps = depsFromStore(store);
    const created = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "John",
      familyName: "Smith",
      email: "john@example.com",
    });
    const again = await addManualClient(deps, {
      submissionId: randomUUID(),
      givenName: "John",
      familyName: "Smith",
      email: "john@example.com",
    });
    assert.equal(created.status, "created");
    assert.equal(again.status, "existing-person");
    if (created.status !== "created" || again.status !== "existing-person") return;
    assert.equal(again.personId, created.personId);
    assert.equal((await store.inspectCounts()).persons, 1);
  });

  it("recovers from an identity unique conflict by re-resolving the existing Person", async () => {
    const store = new InMemoryClientMemoryStore();
    const personId = await seedPerson(store, {
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      roles: ["friend"],
      identitySourceSystem: MANUAL_PERSON_SOURCE_SYSTEM,
      identities: [{ kind: "email_hash", identifier: hashEmail("ada@example.com")! }],
    });
    let lookups = 0;
    const result = await addManualClient(
      depsFromStore(store, {
        findActiveIdentities: async (query) => {
          lookups += 1;
          if (lookups === 1) return [];
          return store.findActiveIdentities(query);
        },
      }),
      {
        submissionId: randomUUID(),
        givenName: "Ada",
        familyName: "Lovelace",
        email: "ada@example.com",
      },
    );
    assert.deepEqual(result, { status: "existing-person", personId });
    assert.deepEqual((await store.getPersonProfile(personId))?.roles, ["friend", "client"]);
    assert.equal((await store.inspectCounts()).persons, 1);
  });
});
