import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { createRepairQuote } from "./create";
import { issueRepairQuote } from "./mutate";
import { issuedQuoteUpdateAllowed } from "./issued-lock";
import { InMemoryRepairQuoteStore } from "./store";
import { lookupVerifiedSku } from "./source";

const NOW = "2026-09-09T16:00:00.000Z";

async function issuedQuote() {
  const store = new InMemoryClientMemoryStore();
  const quotes = new InMemoryRepairQuoteStore();
  const person = await store.insertEntity({ kind: "person", createdAt: NOW, createdBy: "test" });
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
  const project = await store.insertEntity({ kind: "project", createdAt: NOW, createdBy: "test" });
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
  const verified = lookupVerifiedSku("1000");
  assert.ok(verified);
  const created = await createRepairQuote(
    {
      nowIso: () => NOW,
      newQuoteId: () => randomUUID(),
      quoteDate: () => "2026-09-09",
      getEntity: (id) => store.getEntity(id),
      getProjectProfile: (projectId) => store.getProjectProfile(projectId),
      getPersonProfile: (personId) => store.getPersonProfile(personId),
      hasActiveClientProjectRelationship: async () => true,
      nextQuoteNumber: async (id) => quotes.nextQuoteNumber(id),
      findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
      applyCreate: (row) => Promise.resolve(quotes.insertQuote(row)),
    },
    {
      mutationId: randomUUID(),
      projectId: project.record.id,
      repairType: verified.repairType,
      metalFamily: verified.metalFamily,
      line: {
        sku: verified.sku,
        taskDescription: verified.taskDescription,
        amounts: verified.amounts,
        metalSemantics: verified.metalSemantics,
        inventedMetalQuantity: false,
        expressSelected: false,
        costBasis: "geller_cost_columns",
      },
      actor: "justin",
    },
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("expected draft");
  const issued = await issueRepairQuote(
    {
      nowIso: () => "2026-09-09T17:00:00.000Z",
      getQuote: async (quoteId) => quotes.getQuote(quoteId),
      findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
      applyMutation: (row) => Promise.resolve(quotes.applyMutation(row)),
    },
    {
      mutationId: randomUUID(),
      projectId: project.record.id,
      quoteId: created.quote.quoteId,
      actor: "justin",
    },
  );
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("expected issued");
  return { quotes, quote: issued.quote };
}

describe("Issued quote SQL/app immutability", () => {
  it("preserves calculation on reload and rejects a direct calculation rewrite", async () => {
    const { quotes, quote } = await issuedQuote();
    const reloaded = quotes.getQuote(quote.quoteId);
    assert.ok(reloaded);
    assert.equal(reloaded.state, "issued");
    assert.equal(reloaded.calculation.rawComputedQuoteEighthCents, 40_000);
    assert.equal(reloaded.sourceSku, "1000");
    assert.deepEqual(reloaded.calculation, quote.calculation);
    const rewritten = {
      ...reloaded,
      calculation: {
        ...reloaded.calculation,
        hourglassQuoteEighthCents: 99_000,
        rawComputedQuoteEighthCents: 99_000,
      },
    };
    assert.equal(issuedQuoteUpdateAllowed(reloaded, rewritten), false);
    assert.throws(
      () =>
        quotes.applyMutation({
          mutation: {
            mutationId: randomUUID(),
            quoteId: reloaded.quoteId,
            projectId: reloaded.projectId,
            action: "override",
            priorState: "issued",
            newState: "issued",
            priorHourglassQuoteEighthCents: reloaded.calculation.hourglassQuoteEighthCents,
            newHourglassQuoteEighthCents: 99_000,
            changedAt: "2026-09-09T18:00:00.000Z",
            changedBy: "attacker",
          },
          next: rewritten,
        }),
      /issued-quote-immutable/,
    );
    assert.equal(quotes.getQuote(quote.quoteId)?.calculation.hourglassQuoteEighthCents, 40_000);
  });

  it("allows void only when the frozen calculation is unchanged", async () => {
    const { quote } = await issuedQuote();
    const voided = {
      ...quote,
      state: "voided" as const,
      voidedAt: "2026-09-09T18:00:00.000Z",
      voidedBy: "justin",
      updatedAt: "2026-09-09T18:00:00.000Z",
    };
    assert.equal(issuedQuoteUpdateAllowed(quote, voided), true);
    const mutated = {
      ...voided,
      calculation: { ...quote.calculation, hourglassQuoteEighthCents: 1 },
    };
    assert.equal(issuedQuoteUpdateAllowed(quote, mutated), false);
  });

  it("keeps the unapplied SQL trigger from rewriting issued calculations", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "lib/supabase/continuum-repair-quotes.sql"),
      "utf8",
    );
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /continuum_repair_quotes_protect_issued/);
    assert.match(sql, /new\.calculation is distinct from old\.calculation/);
    assert.match(sql, /raise exception 'issued-quote-immutable'/);
    assert.match(sql, /before update or delete/);
  });
});
