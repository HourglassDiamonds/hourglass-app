/**
 * Founder repair-quote writer port.
 * App Router code must import the Supabase adapter from `./server`.
 */

import { randomUUID } from "node:crypto";
import { civilDateInZone } from "@/lib/continuum/date-only";
import type { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { createRepairQuote } from "./create";
import type { CreateRepairQuoteInput, CreateRepairQuoteResult } from "./create";
import {
  issueRepairQuote,
  overrideRepairQuote,
  voidRepairQuote,
  type MutateRepairQuoteResult,
} from "./mutate";
import type { InMemoryRepairQuoteStore } from "./store";
import type { RepairQuote } from "./types";

export type RepairQuoteWriter = {
  createQuote(input: CreateRepairQuoteInput): Promise<CreateRepairQuoteResult>;
  issueQuote(input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  }): Promise<MutateRepairQuoteResult>;
  overrideQuote(input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    amountCents: number;
    reason: string;
    actor: string;
  }): Promise<MutateRepairQuoteResult>;
  voidQuote(input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  }): Promise<MutateRepairQuoteResult>;
  getQuote(projectId: string, quoteId: string): Promise<RepairQuote | null>;
  listQuotes(projectId: string): Promise<RepairQuote[]>;
};

function quoteDateFromNow(nowIso: string): string {
  return civilDateInZone(nowIso) ?? nowIso.slice(0, 10);
}

export function createInMemoryRepairQuoteWriter(
  memory: InMemoryClientMemoryStore,
  quotes: InMemoryRepairQuoteStore,
  nowIso: () => string = () => new Date().toISOString(),
): RepairQuoteWriter {
  return {
    createQuote(input) {
      return createRepairQuote(
        {
          nowIso,
          newQuoteId: () => randomUUID(),
          quoteDate: () => quoteDateFromNow(nowIso()),
          getEntity: (id) => memory.getEntity(id),
          getProjectProfile: (projectId) => memory.getProjectProfile(projectId),
          getPersonProfile: (personId) => memory.getPersonProfile(personId),
          hasActiveClientProjectRelationship: (projectId, personId) =>
            memory.hasActiveClientProjectLink(personId, projectId),
          nextQuoteNumber: async (projectId) => quotes.nextQuoteNumber(projectId),
          findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
          applyCreate: (row) => Promise.resolve(quotes.insertQuote(row)),
        },
        input,
      );
    },
    issueQuote(input) {
      return issueRepairQuote(
        {
          nowIso,
          getQuote: async (quoteId) => quotes.getQuote(quoteId),
          findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
          applyMutation: (row) => Promise.resolve(quotes.applyMutation(row)),
        },
        input,
      );
    },
    overrideQuote(input) {
      return overrideRepairQuote(
        {
          nowIso,
          getQuote: async (quoteId) => quotes.getQuote(quoteId),
          findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
          applyMutation: (row) => Promise.resolve(quotes.applyMutation(row)),
        },
        input,
      );
    },
    voidQuote(input) {
      return voidRepairQuote(
        {
          nowIso,
          getQuote: async (quoteId) => quotes.getQuote(quoteId),
          findByMutationId: async (mutationId) => quotes.findByMutationId(mutationId),
          applyMutation: (row) => Promise.resolve(quotes.applyMutation(row)),
        },
        input,
      );
    },
    async getQuote(projectId, quoteId) {
      const quote = quotes.getQuote(quoteId);
      if (!quote || quote.projectId !== projectId) return null;
      return quote;
    },
    async listQuotes(projectId) {
      return quotes.listQuotes(projectId);
    },
  };
}
