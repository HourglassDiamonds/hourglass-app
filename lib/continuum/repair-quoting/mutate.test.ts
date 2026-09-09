import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { createRepairQuote } from "./create";
import {
  issueRepairQuote,
  overrideRepairQuote,
  voidRepairQuote,
  type MutateRepairQuoteDeps,
} from "./mutate";
import { InMemoryRepairQuoteStore } from "./store";
import { calculateRepairQuote } from "./calculate";

const NOW = "2026-09-09T16:00:00.000Z";
const QUOTE_DATE = "2026-09-09";

async function seedRepairProject(store: InMemoryClientMemoryStore) {
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
    projectKind: "repair_service",
  });
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
  return { personId: person.record.id, projectId: project.record.id };
}

async function createDraft(
  store: InMemoryClientMemoryStore,
  quotes: InMemoryRepairQuoteStore,
) {
  const { projectId } = await seedRepairProject(store);
  const created = await createRepairQuote(
    {
      nowIso: () => NOW,
      newQuoteId: () => randomUUID(),
      quoteDate: () => QUOTE_DATE,
      getEntity: (id) => store.getEntity(id),
      getProjectProfile: (projectId) => store.getProjectProfile(projectId),
      getPersonProfile: (personId) => store.getPersonProfile(personId),
      hasActiveClientProjectRelationship: (projectId, personId) =>
        store.hasActiveClientProjectLink(personId, projectId),
      nextQuoteNumber: async (id) => quotes.nextQuoteNumber(id),
      findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
      applyCreate: (row) => Promise.resolve(quotes.insertQuote(row)),
    },
    {
      mutationId: randomUUID(),
      projectId,
      repairType: "sizing",
      metalFamily: "gold_14k",
      sourceEditionLabel: "Founder-transcribed Blue Book line",
      sourcePriceSemantics: "shop_cost",
      goldUsdCentsPerTroyOz: 440_000,
      goldAsOfDate: QUOTE_DATE,
      goldInputSource: "founder_manual",
      goldBaselineUsdCentsPerTroyOz: 300_000,
      markupRatioPermyriad: 25_000,
      lines: [
        {
          sourceLineRef: "SZ-14K-UP",
          sourceLineLabel: "Size 14K ring up one half size",
          sourceAmountCents: 12_000,
          goldSensitive: true,
          goldWeightKind: "alloy_dwt",
          goldWeightMillidwt: 2_500,
        },
      ],
      actor: "justin",
    },
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("expected draft");
  return { projectId, quote: created.quote, quotes };
}

function mutateDeps(quotes: InMemoryRepairQuoteStore): MutateRepairQuoteDeps {
  return {
    nowIso: () => "2026-09-09T17:00:00.000Z",
    getQuote: async (quoteId) => quotes.getQuote(quoteId),
    findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
    applyMutation: (row) => Promise.resolve(quotes.applyMutation(row)),
  };
}

describe("Repair quote issue, override, and history", () => {
  it("stores override provenance without erasing computed cost basis", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const { projectId, quote } = await createDraft(store, quotes);
    const computed = quote.calculation.computedHourglassQuoteCents;
    const result = await overrideRepairQuote(mutateDeps(quotes), {
      mutationId: randomUUID(),
      projectId,
      quoteId: quote.quoteId,
      amountCents: 48_000,
      reason: "Founder quoted verbally at the bench",
      actor: "justin",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.calculation.hourglassQuoteCents, 48_000);
    assert.equal(result.quote.calculation.computedHourglassQuoteCents, computed);
    assert.equal(result.quote.override?.reason, "Founder quoted verbally at the bench");
    assert.equal(result.quote.override?.overriddenBy, "justin");
    assert.equal(result.quote.calculation.overrideApplied, true);
  });

  it("freezes issued quotes and refuses silent repricing", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const { projectId, quote } = await createDraft(store, quotes);
    const issued = await issueRepairQuote(mutateDeps(quotes), {
      mutationId: randomUUID(),
      projectId,
      quoteId: quote.quoteId,
      actor: "justin",
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    assert.equal(issued.quote.state, "issued");
    const frozen = issued.quote.calculation.hourglassQuoteCents;
    const again = await issueRepairQuote(mutateDeps(quotes), {
      mutationId: randomUUID(),
      projectId,
      quoteId: quote.quoteId,
      actor: "justin",
    });
    assert.equal(again.ok, false);
    if (again.ok) return;
    assert.equal(again.code, "issued-quote-immutable");
    const override = await overrideRepairQuote(mutateDeps(quotes), {
      mutationId: randomUUID(),
      projectId,
      quoteId: quote.quoteId,
      amountCents: 1,
      reason: "should not apply",
      actor: "justin",
    });
    assert.equal(override.ok, false);
    if (!override.ok) assert.equal(override.code, "issued-quote-immutable");
    const stored = quotes.getQuote(quote.quoteId);
    assert.equal(stored?.calculation.hourglassQuoteCents, frozen);
    const laterMath = calculateRepairQuote({
      repairType: quote.repairType,
      metalFamily: quote.metalFamily,
      sourceEditionLabel: quote.sourceEditionLabel,
      sourcePriceSemantics: quote.sourcePriceSemantics,
      gold: {
        usdCentsPerTroyOz: 999_000,
        asOfDate: QUOTE_DATE,
        source: "founder_manual",
        baselineUsdCentsPerTroyOz: 300_000,
      },
      markupRatioPermyriad: 25_000,
      lines: quote.lines.map((line) => ({
        sourceLineRef: line.sourceLineRef,
        sourceLineLabel: line.sourceLineLabel,
        sourceAmountCents: line.sourceAmountCents,
        goldSensitive: line.goldSensitive,
        goldWeightKind: line.goldWeightKind,
        goldWeightMillidwt: line.goldWeightMillidwt,
      })),
      quoteDate: QUOTE_DATE,
    });
    assert.equal(laterMath.ok, true);
    if (!laterMath.ok) return;
    assert.notEqual(laterMath.calculation.hourglassQuoteCents, frozen);
    assert.equal(stored?.goldUsdCentsPerTroyOz, 440_000);
  });

  it("keeps voided issued quotes in history", async () => {
    const store = new InMemoryClientMemoryStore();
    const quotes = new InMemoryRepairQuoteStore();
    const { projectId, quote } = await createDraft(store, quotes);
    const issued = await issueRepairQuote(mutateDeps(quotes), {
      mutationId: randomUUID(),
      projectId,
      quoteId: quote.quoteId,
      actor: "justin",
    });
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    const voided = await voidRepairQuote(mutateDeps(quotes), {
      mutationId: randomUUID(),
      projectId,
      quoteId: quote.quoteId,
      actor: "justin",
    });
    assert.equal(voided.ok, true);
    if (!voided.ok) return;
    assert.equal(voided.quote.state, "voided");
    assert.equal(
      voided.quote.calculation.hourglassQuoteCents,
      issued.quote.calculation.hourglassQuoteCents,
    );
    const history = quotes.listMutations(quote.quoteId);
    assert.equal(history.some((row) => row.action === "issue"), true);
    assert.equal(history.some((row) => row.action === "void"), true);
    assert.equal(history.some((row) => row.action === "create"), true);
  });
});
