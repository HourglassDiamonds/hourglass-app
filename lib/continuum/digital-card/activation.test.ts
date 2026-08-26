/**
 * Activation-audit pressure tests. These encode the production-safe
 * behavior required before SQL/push/deploy.
 */

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
import { publicCardAbsoluteUrl } from "./origin";
import { saveOwnerDigitalCard } from "./owner";
import { toPublicDigitalCard } from "./public";
import { InMemoryDigitalCardStore } from "./store";
import {
  DIGITAL_CARD_SOURCE_SYSTEM,
  type DigitalCard,
  type ShareContactInput,
} from "./types";
import { buildPublicVcard } from "./vcard";

const NOW = "2026-08-25T23:00:00.000Z";
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
      ownerUsername: "founder",
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
  input: { displayName: string; email?: string | null; phone?: string | null },
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
    organizationName: null,
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

function share(overrides: Partial<ShareContactInput> = {}): ShareContactInput {
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

describe("activation: public DTO serialization", () => {
  it("serialized public props contain no owner, ids, or unpublished contact", () => {
    const card: DigitalCard = {
      id: "11111111-1111-4111-8111-111111111111",
      slug: SLUG,
      ownerUsername: "founder-secret",
      ownerPersonId: "22222222-2222-4222-8222-222222222222",
      displayName: "Justin Smith",
      memorableTitle: "The Diamond Guy",
      professionalTitle: "Graduate Gemologist",
      company: "Hourglass Diamonds",
      email: "private@hourglassdiamonds.com",
      phone: "7045550199",
      emailPublic: false,
      phonePublic: false,
      websiteUrl: "https://www.hourglassdiamonds.com",
      linkedinUrl: null,
      instagramUrl: null,
      additionalLinks: [],
      avatarUrl: null,
      published: true,
      sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const publicCard = toPublicDigitalCard(card);
    const json = JSON.stringify(publicCard);
    assert.ok(publicCard);
    assert.doesNotMatch(json, /11111111-1111-4111-8111/);
    assert.doesNotMatch(json, /22222222-2222-4222-8222/);
    assert.doesNotMatch(json, /founder-secret|ownerUsername|ownerPersonId/);
    assert.doesNotMatch(json, /private@hourglassdiamonds|7045550199/);
    assert.doesNotMatch(json, /published|sourceSystem|client|hash/i);
  });
});

describe("activation: production QR origin", () => {
  it("uses the trusted www origin in production and ignores Host", () => {
    const url = publicCardAbsoluteUrl("justin-smith", {
      get(name: string) {
        if (name === "host" || name === "x-forwarded-host") return "evil.example";
        if (name === "x-forwarded-proto") return "https";
        return null;
      },
    }, {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.equal(url, "https://www.hourglassdiamonds.com/c/justin-smith");
    assert.doesNotMatch(url, /evil|javascript:|data:/);
  });
});

function sampleCardForVcard(overrides: Partial<DigitalCard> = {}): DigitalCard {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: SLUG,
    ownerUsername: "founder",
    ownerPersonId: null,
    displayName: "Justin Smith",
    memorableTitle: "The Diamond Guy",
    professionalTitle: "Graduate Gemologist",
    company: "Hourglass Diamonds",
    email: "justin@hourglassdiamonds.com",
    phone: "7045550100",
    emailPublic: true,
    phonePublic: true,
    websiteUrl: "https://www.hourglassdiamonds.com",
    linkedinUrl: null,
    instagramUrl: null,
    additionalLinks: [],
    avatarUrl: null,
    published: true,
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function vcardRecords(vcf: string): string[] {
  return vcf.split("\r\n").filter((line) => line.length > 0 && !line.startsWith(" "));
}

function transactionalCreateDeps(
  memory: InMemoryClientMemoryStore,
  cards: InMemoryDigitalCardStore,
): DigitalCardExchangeDeps {
  const deps = depsFrom(memory, cards);
  let gate = Promise.resolve();
  const create = deps.createPersonAtomic;
  deps.createPersonAtomic = (row) => {
    assert.equal(row.entityId, undefined);
    const next = gate.then(() => create(row));
    gate = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
  return deps;
}

describe("activation: vCard CR/LF injection", () => {
  it("does not let a field inject a new vCard property via carriage return", () => {
    const publicCard = toPublicDigitalCard(
      sampleCardForVcard({
        memorableTitle: "The Diamond Guy\rTEL:9995550000",
        additionalLinks: [{ label: "Extra\rEMAIL:evil@x.com", url: "https://example.com" }],
      }),
    );
    assert.ok(publicCard);
    const vcf = buildPublicVcard(publicCard);
    assert.match(vcf, /\r\nEND:VCARD\r\n$/);
    const records = vcardRecords(vcf);
    assert.equal(records.filter((line) => line.startsWith("TEL")).length, 1);
    assert.equal(records.filter((line) => line.startsWith("EMAIL")).length, 1);
    assert.doesNotMatch(vcf, /\rTEL:/);
    assert.doesNotMatch(vcf, /\rEMAIL:/);
    assert.doesNotMatch(vcf, /^TEL:9995550000/m);
    assert.ok(records.some((line) => line.startsWith("NOTE:The Diamond GuyTEL:9995550000")));
  });

  it("escapes LF and CRLF as a single escaped field instead of a new property", () => {
    const lf = toPublicDigitalCard(sampleCardForVcard({ memorableTitle: "Line one\nLine two" }));
    const crlf = toPublicDigitalCard(
      sampleCardForVcard({
        displayName: "Justin\rTEL:+15555555555",
        memorableTitle: "Justin\r\nTEL:+15555555555",
      }),
    );
    assert.ok(lf && crlf);
    const lfVcf = buildPublicVcard(lf);
    const crlfVcf = buildPublicVcard(crlf);
    assert.match(lfVcf, /NOTE:Line one\\nLine two/);
    assert.match(crlfVcf, /NOTE:Justin\\nTEL:\+15555555555/);
    assert.equal(vcardRecords(lfVcf).filter((line) => line.startsWith("TEL")).length, 1);
    assert.equal(vcardRecords(crlfVcf).filter((line) => line.startsWith("TEL")).length, 1);
    assert.equal(vcardRecords(crlfVcf).filter((line) => line.startsWith("NOTE")).length, 1);
  });
});

describe("activation: identity concurrency and submission UUID", () => {
  it("mints a Person UUID that is not the client submissionId", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const submissionId = randomUUID();
    const createCalls: Array<{ entityId?: string }> = [];
    const deps = depsFrom(memory, cards);
    const create = deps.createPersonAtomic;
    deps.createPersonAtomic = (row) => {
      createCalls.push(row);
      return create(row);
    };
    const result = await ingestDigitalCardShare(deps, share({ submissionId }));
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.resolution, "created");
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0]?.entityId, undefined);
    const exchange = await cards.getExchangeBySubmissionId(submissionId);
    assert.ok(exchange?.counterpartyPersonId);
    assert.notEqual(exchange.counterpartyPersonId, submissionId);
    assert.equal(exchange.submissionId, submissionId);
  });

  it("retries the same submissionId without creating a second Person", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const deps = depsFrom(memory, cards);
    const submissionId = randomUUID();
    const first = await ingestDigitalCardShare(deps, share({ submissionId }));
    const second = await ingestDigitalCardShare(deps, share({ submissionId }));
    assert.equal(first.status, "accepted");
    assert.equal(second.status, "accepted");
    if (first.status !== "accepted" || second.status !== "accepted") return;
    assert.equal(second.exchangeId, first.exchangeId);
    assert.equal((await memory.inspectCounts()).persons, 1);
  });

  it("resolves a later different submissionId with the same email to the existing Person", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const deps = depsFrom(memory, cards);
    const firstId = randomUUID();
    const secondId = randomUUID();
    const first = await ingestDigitalCardShare(deps, share({ submissionId: firstId }));
    const second = await ingestDigitalCardShare(deps, share({ submissionId: secondId }));
    assert.equal(first.status, "accepted");
    assert.equal(second.status, "accepted");
    if (first.status !== "accepted" || second.status !== "accepted") return;
    assert.equal(first.resolution, "created");
    assert.equal(second.resolution, "matched");
    assert.equal((await memory.inspectCounts()).persons, 1);
    const a = await cards.getExchangeBySubmissionId(firstId);
    const b = await cards.getExchangeBySubmissionId(secondId);
    assert.equal(a?.counterpartyPersonId, b?.counterpartyPersonId);
    assert.notEqual(a?.id, b?.id);
  });

  it("does not attach an exchange to an unrelated Person whose UUID is reused as submissionId", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const victimId = await seedPerson(memory, {
      displayName: "Existing Client",
      email: "client@example.com",
    });
    const result = await ingestDigitalCardShare(
      depsFrom(memory, cards),
      share({ submissionId: victimId, email: "ada@example.com", phone: "7045550199" }),
    );
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    const exchange = await cards.getExchangeBySubmissionId(victimId);
    assert.ok(exchange);
    assert.notEqual(exchange.counterpartyPersonId, victimId);
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 2);
    const victim = await memory.getPersonProfile(victimId);
    assert.equal(victim?.email, "client@example.com");
    assert.equal(victim?.phone, null);
  });

  it("does not create two People for concurrent new-email submissions", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const deps = transactionalCreateDeps(memory, cards);
    const [a, b] = await Promise.all([
      ingestDigitalCardShare(deps, share({ submissionId: randomUUID() })),
      ingestDigitalCardShare(deps, share({ submissionId: randomUUID() })),
    ]);
    assert.equal(a.status, "accepted");
    assert.equal(b.status, "accepted");
    const counts = await memory.inspectCounts();
    assert.equal(counts.persons, 1);
  });

  it("does not create two People for concurrent identical submissionIds", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const deps = transactionalCreateDeps(memory, cards);
    const submissionId = randomUUID();
    const [a, b] = await Promise.all([
      ingestDigitalCardShare(deps, share({ submissionId })),
      ingestDigitalCardShare(deps, share({ submissionId })),
    ]);
    assert.equal(a.status, "accepted");
    assert.equal(b.status, "accepted");
    assert.equal((await memory.inspectCounts()).persons, 1);
    const exchange = await cards.getExchangeBySubmissionId(submissionId);
    assert.ok(exchange?.counterpartyPersonId);
    assert.notEqual(exchange.counterpartyPersonId, submissionId);
  });

  it("rejects a malformed submission UUID before Person mutation", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    await seedPublishedCard(cards);
    const result = await ingestDigitalCardShare(
      depsFrom(memory, cards),
      share({ submissionId: "not-a-uuid" }),
    );
    assert.equal(result.status, "validation-error");
    assert.equal((await memory.inspectCounts()).persons, 0);
  });

  it("ignores a context token that belongs to a different card", async () => {
    const memory = new InMemoryClientMemoryStore();
    const cards = new InMemoryDigitalCardStore();
    const card = await seedPublishedCard(cards);
    assert.ok(card);
    await cards.upsertContext({
      id: randomUUID(),
      cardId: "99999999-9999-4999-8999-999999999999",
      publicToken: "othertoken99",
      label: "Other event",
      status: "active",
      startedAt: NOW,
      endedAt: null,
      sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
      createdAt: NOW,
    });
    const submissionId = randomUUID();
    const result = await ingestDigitalCardShare(
      depsFrom(memory, cards),
      share({ submissionId, contextToken: "othertoken99" }),
    );
    assert.equal(result.status, "accepted");
    const exchange = await cards.getExchangeBySubmissionId(submissionId);
    assert.equal(exchange?.contextId, null);
  });
});
