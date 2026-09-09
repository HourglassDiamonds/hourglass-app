import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import type { ProjectKind } from "@/lib/continuum/client-memory/project-kind";
import { createRepairQuote, type CreateRepairQuoteDeps } from "./create";
import { InMemoryRepairQuoteStore } from "./store";
import type { RepairQuoteLineInput } from "./types";

const NOW = "2026-09-09T16:00:00.000Z";
const QUOTE_DATE = "2026-09-09";
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
    quoteDate: () => QUOTE_DATE,
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

function sizingLine(): RepairQuoteLineInput[] {
  return [
    {
      sourceLineRef: "SZ-14K-UP",
      sourceLineLabel: "Size 14K ring up one half size",
      sourceAmountCents: 12_000,
      goldSensitive: true,
      goldWeightKind: "alloy_dwt",
      goldWeightMillidwt: 2_500,
    },
  ];
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
      sourceEditionLabel: "Founder-transcribed Blue Book line",
      sourcePriceSemantics: "shop_cost",
      goldUsdCentsPerTroyOz: 440_000,
      goldAsOfDate: QUOTE_DATE,
      goldInputSource: "founder_manual",
      goldBaselineUsdCentsPerTroyOz: 300_000,
      markupRatioPermyriad: 25_000,
      lines: sizingLine(),
      actor: ACTOR,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.projectId, projectId);
    assert.equal(result.quote.associatedPersonId, personId);
    assert.equal(result.quote.state, "draft");
    assert.equal(result.quote.quoteNumber, 1);
    assert.equal(result.quote.createdBy, ACTOR);
  });

  it("refuses custom jewelry projects and missing source semantics", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const custom = await seedProject(store, { kind: "custom_new_jewelry" });
    const customResult = await createRepairQuote(deps(store, quotes), {
      mutationId: randomUUID(),
      projectId: custom.projectId,
      repairType: "sizing",
      metalFamily: "gold_14k",
      sourceEditionLabel: "Founder-transcribed Blue Book line",
      sourcePriceSemantics: "shop_cost",
      goldUsdCentsPerTroyOz: 440_000,
      goldAsOfDate: QUOTE_DATE,
      goldInputSource: "founder_manual",
      goldBaselineUsdCentsPerTroyOz: 300_000,
      markupRatioPermyriad: 25_000,
      lines: sizingLine(),
      actor: ACTOR,
    });
    assert.equal(customResult.ok, false);
    if (customResult.ok) return;
    assert.equal(customResult.code, "project-not-repair");

    const repair = await seedProject(store);
    const missing = await createRepairQuote(deps(store, quotes), {
      mutationId: randomUUID(),
      projectId: repair.projectId,
      repairType: "sizing",
      metalFamily: "gold_14k",
      sourceEditionLabel: "Founder-transcribed Blue Book line",
      sourcePriceSemantics: "",
      goldUsdCentsPerTroyOz: 440_000,
      goldAsOfDate: QUOTE_DATE,
      goldInputSource: "founder_manual",
      goldBaselineUsdCentsPerTroyOz: 300_000,
      markupRatioPermyriad: 25_000,
      lines: sizingLine(),
      actor: ACTOR,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "missing-source-semantics");
  });

  it("is idempotent on mutation id", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const { projectId } = await seedProject(store);
    const mutationId = randomUUID();
    const input = {
      mutationId,
      projectId,
      repairType: "laser_work" as const,
      metalFamily: "gold_14k" as const,
      sourceEditionLabel: "Founder-transcribed Blue Book line",
      sourcePriceSemantics: "shop_cost",
      goldUsdCentsPerTroyOz: 440_000,
      goldAsOfDate: QUOTE_DATE,
      goldInputSource: "founder_manual",
      goldBaselineUsdCentsPerTroyOz: null,
      markupRatioPermyriad: 25_000,
      lines: [
        {
          sourceLineRef: "LSR-1",
          sourceLineLabel: "Laser weld",
          sourceAmountCents: 8_500,
          goldSensitive: false,
        },
      ],
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
  });
});
