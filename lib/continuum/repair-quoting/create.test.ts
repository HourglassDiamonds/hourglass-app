import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import type { ProjectKind } from "@/lib/continuum/client-memory/project-kind";
import { GELLER_BLUE_BOOK } from "./contract";
import { createRepairQuote, type CreateRepairQuoteDeps } from "./create";
import { lookupVerifiedSku } from "./source";
import { InMemoryRepairQuoteStore } from "./store";
import type { RepairQuoteLineInput } from "./types";

const NOW = "2026-09-09T16:00:00.000Z";
const ACTOR = "justin";

async function seedProject(
  store: InMemoryClientMemoryStore,
  extra: {
    kind?: ProjectKind | null;
    linkPerson?: boolean;
  } = {},
) {
  const person = await store.insertEntity({
    kind: "person",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertPersonProfile({
    personId: person.record.id,
    displayName: "Ada Lovelace",
    givenName: "Ada",
    familyName: "Lovelace",
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
  });
  const project = await store.insertEntity({
    kind: "project",
    createdAt: NOW,
    createdBy: "test",
  });
  await store.insertProjectProfile({
    projectId: project.record.id,
    displayTitle: "Wagner repair",
    visibility: "internal-only",
    importRowKey: `continuum-repair-quote:${randomUUID()}`,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    projectKind: extra.kind ?? "repair_service",
  });
  if (extra.linkPerson !== false) {
    await store.insertRelationship({
      id: randomUUID(),
      fromEntityId: person.record.id,
      toEntityId: project.record.id,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: NOW,
      createdBy: "test",
    });
  }
  return { personId: person.record.id, projectId: project.record.id };
}

function deps(
  store: InMemoryClientMemoryStore,
  quotes: InMemoryRepairQuoteStore,
): CreateRepairQuoteDeps {
  return {
    nowIso: () => NOW,
    newQuoteId: () => randomUUID(),
    quoteDate: () => "2026-09-09",
    getEntity: (id) => store.getEntity(id),
    getProjectProfile: (projectId) => store.getProjectProfile(projectId),
    getPersonProfile: (personId) => store.getPersonProfile(personId),
    hasActiveClientProjectRelationship: (projectId, personId) =>
      store.hasActiveClientProjectLink(personId, projectId),
    nextQuoteNumber: async (projectId) => quotes.nextQuoteNumber(projectId),
    findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
    applyCreate: (row) => Promise.resolve(quotes.insertQuote(row)),
  };
}

function verifiedLine(sku: string): RepairQuoteLineInput {
  const verified = lookupVerifiedSku(sku);
  assert.ok(verified);
  return {
    sku: verified.sku,
    taskDescription: verified.taskDescription,
    amounts: verified.amounts,
    metalBand: verified.metalBand,
    hasExplicitMetalQuantity: verified.hasExplicitMetalQuantity,
    metalSemantics: verified.metalSemantics,
    inventedMetalQuantity: false,
    expressSelected: false,
    costBasis: "geller_cost_columns",
  };
}

describe("Repair quote create", () => {
  it("links a draft quote to a repair project and person", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const { personId, projectId } = await seedProject(store);
    const result = await createRepairQuote(deps(store, quotes), {
      mutationId: randomUUID(),
      projectId,
      repairType: "sizing",
      metalFamily: "gold_14k",
      associatedPersonId: personId,
      line: verifiedLine("1000"),
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.projectId, projectId);
    assert.equal(result.quote.associatedPersonId, personId);
    assert.equal(result.quote.state, "draft");
    assert.equal(result.quote.quoteNumber, 1);
    assert.equal(result.quote.createdBy, ACTOR);
    assert.equal(result.quote.sourceEditionLabel, GELLER_BLUE_BOOK.editionLabel);
    assert.equal(result.quote.sourceSku, "1000");
    assert.equal(result.quote.calculation.rawComputedQuoteEighthCents, 40_000);
  });

  it("refuses custom jewelry projects and retail-as-cost", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    const customResult = await createRepairQuote(deps(store, quotes), {
      mutationId: randomUUID(),
      projectId: custom.projectId,
      repairType: "sizing",
      metalFamily: "gold_14k",
      line: verifiedLine("1000"),
      actor: ACTOR,
    });
    assert.equal(customResult.ok, false);
    if (customResult.ok) return;
    assert.equal(customResult.code, "project-not-repair");

    const repair = await seedProject(store);
    const retail = await createRepairQuote(deps(store, quotes), {
      mutationId: randomUUID(),
      projectId: repair.projectId,
      repairType: "sizing",
      metalFamily: "gold_14k",
      line: { ...verifiedLine("1000"), costBasis: "geller_price_columns" },
      actor: ACTOR,
    });
    assert.equal(retail.ok, false);
    if (!retail.ok) assert.equal(retail.code, "retail-used-as-cost");
  });

  it("is idempotent on mutation id", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const { projectId } = await seedProject(store);
    const mutationId = randomUUID();
    const input = {
      mutationId,
      projectId,
      repairType: "sizing" as const,
      metalFamily: "gold_14k" as const,
      line: verifiedLine("1008"),
      actor: ACTOR,
    };
    const first = await createRepairQuote(deps(store, quotes), input);
    const second = await createRepairQuote(deps(store, quotes), input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.status, "already-present");
    assert.equal(first.quote.quoteId, second.quote.quoteId);
    assert.equal(quotes.listQuotes(projectId).length, 1);
    assert.equal(first.quote.calculation.rawComputedQuoteEighthCents, 74_500);
  });
});
