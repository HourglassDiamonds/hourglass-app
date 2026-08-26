import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { hashEmail, hashPhone } from "../client-memory/hashes";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
} from "../client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM, type PersonProfile } from "../client-memory/types";
import { ingestDigitalCardShare, type DigitalCardExchangeDeps } from "./ingest";
import { saveOwnerDigitalCard } from "./owner";
import { InMemoryDigitalCardStore } from "./store";
import {
  DIGITAL_CARD_EXCHANGE_EVENT_TYPE,
  DIGITAL_CARD_SOURCE_SYSTEM,
} from "./types";

const NOW = "2026-08-25T18:00:00.000Z";
const SLUG = "justin-smith";

function depsFrom(
  memory: InMemoryClientMemoryStore,
  cards: InMemoryDigitalCardStore,
): DigitalCardExchangeDeps {
  return {
    nowIso: () => NOW,
    findActiveIdentities: (query) => memory.findActiveIdentities(query),
    createPersonAtomic: (row) => memory.createPersonAtomic(row),
    getPersonProfile: (personId) => memory.getPersonProfile(personId),
    applyExistingPersonAtomic: (row) => memory.applyExistingPersonAtomic(row),
    insertIdentityReview: (row) => memory.insertIdentityReview(row),
    getPublishedCardBySlug: (slug) => cards.getPublishedCardBySlug(slug),
    findActiveContextByPublicToken: (cardId, token) =>
      cards.findActiveContextByPublicToken(cardId, token),
    insertExchange: (row) => cards.insertExchange(row),
    getExchangeBySubmissionId: (id) => cards.getExchangeBySubmissionId(id),
  };
}

async function seedPublishedCard(store: InMemoryDigitalCardStore) {
  const saved = await saveOwnerDigitalCard(
    {
      nowIso: () => NOW,
      newId: () => randomUUID(),
      ownerUsername: "justin@hourglassdiamonds.com",
      getCardByOwner: (owner) => store.getCardByOwner(owner),
      getCardBySlug: (slug) => store.getCardBySlug(slug),
      upsertCard: (card) => store.upsertCard(card),
    },
    {
      displayName: "Justin Smith",
      memorableTitle: "The Diamond Guy",
      professionalTitle: "Graduate Gemologist",
      company: "Hourglass Diamonds",
      email: "justin@hourglassdiamonds.com",
      phone: "7045550100",
      slug: SLUG,
      published: true,
    },
  );
  assert.equal(saved.status, "saved");
  return saved.status === "saved" ? saved.card : null;
}

async function seedPerson(
  memory: InMemoryClientMemoryStore,
  input: {
    displayName: string;
    email?: string | null;
    phone?: string | null;
    organizationName?: string | null;
  },
): Promise<string> {
  const person = await memory.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  const profile: PersonProfile = {
    personId: person.record.id,
    displayName: input.displayName,
    givenName: input.displayName.split(" ")[0] ?? null,
    familyName: input.displayName.split(" ").slice(1).join(" ") || null,
    organizationName: input.organizationName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    streetAddress: null,
    city: null,
    state: null,
    country: null,
    postalCode: null,
    roles: ["client"],
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await memory.insertPersonProfile(profile);
  if (input.email) {
    await memory.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "email_hash",
        identifier: hashEmail(input.email)!,
        createdAt: NOW,
      }),
    );
  }
  if (input.phone) {
    await memory.insertExternalIdentity(
      newExternalIdentity({
        entityId: person.record.id,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "phone_hash",
        identifier: hashPhone(input.phone)!,
        createdAt: NOW,
      }),
    );
  }
  return person.record.id;
}

function shareInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: SLUG,
    submissionId: randomUUID(),
    name: "Ada Lovelace",
    phone: "704-555-0199",
    email: "ada@example.com",
    company: "Analytical Engines",
    jobTitle: "Mathematician",
    consent: true,
    ...overrides,
  };
}

describe("digital-card identity exchange ingest", () => {
  it("creates a new Person and an identity exchange without duplicating later", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const deps = depsFrom(memory, cards);
    const submissionId = randomUUID();
    const first = await ingestDigitalCardShare(deps, shareInput({ submissionId }));
    assert.equal(first.status, "accepted");
    if (first.status !== "accepted") return;
    assert.equal(first.resolution, "created");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 1);
    const second = await ingestDigitalCardShare(deps, shareInput({ submissionId }));
    assert.equal(second.status, "accepted");
    if (second.status !== "accepted") return;
    assert.equal(second.resolution, "created");
    assert.equal(second.exchangeId, first.exchangeId);
    const after = await memory.inspectCounts();
    assert.equal(after.persons, 1);
    const exchange = await cards.getExchangeBySubmissionId(submissionId);
    assert.equal(exchange?.eventType, DIGITAL_CARD_EXCHANGE_EVENT_TYPE);
    assert.equal(exchange?.sourceSystem, DIGITAL_CARD_SOURCE_SYSTEM);
    assert.equal(exchange?.resolutionStatus, "created");
    assert.ok(exchange?.counterpartyPersonId);
    assert.notEqual(exchange.counterpartyPersonId, submissionId);
    assert.equal(exchange.submissionId, submissionId);
  });

  it("matches an existing Person by email and does not create a duplicate", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const personId = await seedPerson(memory, {
      displayName: "Ada Lovelace",
      email: "ada@example.com",
    });
    const result = await ingestDigitalCardShare(depsFrom(memory, cards), shareInput());
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.resolution, "matched");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 1);
    const profile = await memory.getPersonProfile(personId);
    assert.equal(profile?.phone, "7045550199");
    assert.ok(profile?.roles.includes("client"));
    assert.ok(profile?.roles.includes("business-contact"));
    assert.equal(profile?.organizationName, "Analytical Engines");
  });

  it("matches by phone and fills a missing email without overwriting the name", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const personId = await seedPerson(memory, {
      displayName: "A. Lovelace",
      phone: "7045550199",
    });
    const result = await ingestDigitalCardShare(depsFrom(memory, cards), shareInput());
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.resolution, "matched");
    const profile = await memory.getPersonProfile(personId);
    assert.equal(profile?.displayName, "A. Lovelace");
    assert.equal(profile?.email, "ada@example.com");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 1);
  });

  it("holds cross-key conflicts for review instead of merging or creating", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    await seedPerson(memory, { displayName: "Ada One", email: "ada@example.com" });
    await seedPerson(memory, { displayName: "Ada Two", phone: "7045550199" });
    const submissionId = randomUUID();
    const result = await ingestDigitalCardShare(
      depsFrom(memory, cards),
      shareInput({ submissionId }),
    );
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.resolution, "review");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 2);
    assert.equal(counts.reviews, 1);
    const exchange = await cards.getExchangeBySubmissionId(submissionId);
    assert.equal(exchange?.resolutionStatus, "review");
    assert.equal(exchange?.counterpartyPersonId, null);
    assert.equal(exchange?.submittedContact.email, "ada@example.com");
  });

  it("does not create a Person from a name-only share", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const result = await ingestDigitalCardShare(
      depsFrom(memory, cards),
      shareInput({ phone: "", email: "" }),
    );
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.resolution, "review");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 0);
    assert.equal(counts.reviews, 1);
  });

  it("rejects invalid visitor input before touching Person storage", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const deps = depsFrom(memory, cards);
    const missingName = await ingestDigitalCardShare(deps, shareInput({ name: " " }));
    assert.equal(missingName.status, "validation-error");
    const badEmail = await ingestDigitalCardShare(deps, shareInput({ email: "not-an-email" }));
    assert.equal(badEmail.status, "validation-error");
    const unpublished = new InMemoryDigitalCardStore();
    await saveOwnerDigitalCard(
      {
        nowIso: () => NOW,
        newId: () => randomUUID(),
        ownerUsername: "justin@hourglassdiamonds.com",
        getCardByOwner: (owner) => unpublished.getCardByOwner(owner),
        getCardBySlug: (slug) => unpublished.getCardBySlug(slug),
        upsertCard: (card) => unpublished.upsertCard(card),
      },
      { displayName: "Justin Smith", slug: SLUG, published: false },
    );
    const hidden = await ingestDigitalCardShare(
      depsFrom(memory, unpublished),
      shareInput(),
    );
    assert.equal(hidden.status, "validation-error");
    if (hidden.status === "validation-error") {
      assert.equal(hidden.code, "card-not-found");
    }
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 0);
  });

  it("soft-accepts honeypot submissions without creating a Person", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const result = await ingestDigitalCardShare(
      depsFrom(memory, cards),
      shareInput({ honeypot: "https://spam.example" }),
    );
    assert.equal(result.status, "ignored");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 0);
  });
});
