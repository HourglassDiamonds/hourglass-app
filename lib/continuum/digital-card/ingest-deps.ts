/**
 * Wire digital-card ingest to Client Memory + the card store.
 * Used by the public share action. Does not check a founder session.
 */

import "server-only";

import { createSupabaseClientMemoryStore } from "@/lib/continuum/client-memory/persistence/supabase";
import type { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { DigitalCardExchangeDeps } from "./ingest";
import type { DigitalCardStore } from "./store";

export function createDigitalCardIngestDeps(
  cardStore: DigitalCardStore,
): DigitalCardExchangeDeps {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("supabase-admin-unavailable");
  const memory = createSupabaseClientMemoryStore(client);
  return depsFromMemory(memory, cardStore);
}

export function createInMemoryDigitalCardIngestDeps(input: {
  memory: InMemoryClientMemoryStore;
  cards: DigitalCardStore;
  nowIso?: () => string;
}): DigitalCardExchangeDeps {
  return {
    ...depsFromMemory(input.memory, input.cards),
    nowIso: input.nowIso ?? (() => new Date().toISOString()),
  };
}

function depsFromMemory(
  memory: Pick<
    InMemoryClientMemoryStore,
    | "findActiveIdentities"
    | "createPersonAtomic"
    | "getPersonProfile"
    | "applyExistingPersonAtomic"
    | "insertIdentityReview"
  >,
  cards: DigitalCardStore,
): DigitalCardExchangeDeps {
  return {
    nowIso: () => new Date().toISOString(),
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
