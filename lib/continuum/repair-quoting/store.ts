/**
 * In-memory repair quote store. Isolated from Client Memory writes
 * so operating details / Gmail / CoS cannot create prices by accident.
 */

import type { RepairQuote, RepairQuoteMutationRecord } from "./types";
import type { ApplyRepairQuoteMutationResult } from "./mutate";
import { issuedQuoteUpdateAllowed } from "./issued-lock";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryRepairQuoteStore {
  private quotes = new Map<string, RepairQuote>();
  private mutationIds = new Map<string, string>();
  private mutations = new Map<string, RepairQuoteMutationRecord>();

  reset(): void {
    this.quotes.clear();
    this.mutationIds.clear();
    this.mutations.clear();
  }

  listQuotes(projectId?: string): RepairQuote[] {
    return [...this.quotes.values()]
      .filter((row) => (projectId ? row.projectId === projectId : true))
      .sort((a, b) => {
        if (a.createdAt === b.createdAt) return b.quoteNumber - a.quoteNumber;
        return a.createdAt < b.createdAt ? 1 : -1;
      })
      .map((row) => clone(row));
  }

  getQuote(quoteId: string): RepairQuote | null {
    const row = this.quotes.get(quoteId);
    return row ? clone(row) : null;
  }

  findByMutationId(mutationId: string): RepairQuote | null {
    const quoteId = this.mutationIds.get(mutationId);
    if (!quoteId) return null;
    return this.getQuote(quoteId);
  }

  nextQuoteNumber(projectId: string): number {
    const numbers = this.listQuotes(projectId).map((row) => row.quoteNumber);
    return (numbers.length ? Math.max(...numbers) : 0) + 1;
  }

  insertQuote(quote: RepairQuote): { status: "created" | "already-present"; quote: RepairQuote } {
    const existingMutation = this.mutationIds.get(quote.createdMutationId);
    if (existingMutation) {
      const existing = this.quotes.get(existingMutation);
      if (existing) return { status: "already-present", quote: clone(existing) };
    }
    this.quotes.set(quote.quoteId, clone(quote));
    this.mutationIds.set(quote.createdMutationId, quote.quoteId);
    this.mutations.set(quote.createdMutationId, {
      mutationId: quote.createdMutationId,
      quoteId: quote.quoteId,
      projectId: quote.projectId,
      action: "create",
      priorState: null,
      newState: quote.state,
      priorHourglassQuoteEighthCents: null,
      newHourglassQuoteEighthCents: quote.calculation.hourglassQuoteEighthCents,
      changedAt: quote.createdAt,
      changedBy: quote.createdBy,
    });
    return { status: "created", quote: clone(quote) };
  }

  applyMutation(input: {
    mutation: RepairQuoteMutationRecord;
    next: RepairQuote;
  }): ApplyRepairQuoteMutationResult {
    const existingMutation = this.mutationIds.get(input.mutation.mutationId);
    if (existingMutation) {
      const existing = this.quotes.get(existingMutation);
      if (existing) return { status: "already-present", quote: clone(existing) };
    }
    const prior = this.quotes.get(input.next.quoteId);
    if (prior && !issuedQuoteUpdateAllowed(prior, input.next)) {
      throw new Error("issued-quote-immutable");
    }
    this.quotes.set(input.next.quoteId, clone(input.next));
    this.mutationIds.set(input.mutation.mutationId, input.next.quoteId);
    this.mutations.set(input.mutation.mutationId, clone(input.mutation));
    return { status: "applied", quote: clone(input.next) };
  }

  listMutations(quoteId?: string): RepairQuoteMutationRecord[] {
    return [...this.mutations.values()]
      .filter((row) => (quoteId ? row.quoteId === quoteId : true))
      .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1))
      .map((row) => clone(row));
  }
}
