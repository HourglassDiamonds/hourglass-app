/**
 * Digital card persistence port and in-memory adapter.
 * Isolated from the Client Memory store. Person writes stay on ClientMemoryStore.
 */

import type {
  DigitalCard,
  DigitalCardContext,
  IdentityExchange,
} from "./types";

export type DigitalCardStore = {
  getCardById(id: string): Promise<DigitalCard | null>;
  getCardBySlug(slug: string): Promise<DigitalCard | null>;
  getPublishedCardBySlug(slug: string): Promise<DigitalCard | null>;
  getCardByOwner(ownerUsername: string): Promise<DigitalCard | null>;
  upsertCard(card: DigitalCard): Promise<DigitalCard>;
  findActiveContextByPublicToken(
    cardId: string,
    token: string,
  ): Promise<DigitalCardContext | null>;
  upsertContext(row: DigitalCardContext): Promise<DigitalCardContext>;
  insertExchange(row: IdentityExchange): Promise<{
    status: "inserted" | "already-present";
    record: IdentityExchange;
  }>;
  getExchangeBySubmissionId(submissionId: string): Promise<IdentityExchange | null>;
  listExchangesByCard(cardId: string): Promise<IdentityExchange[]>;
};

function cloneCard(card: DigitalCard): DigitalCard {
  return {
    ...card,
    additionalLinks: card.additionalLinks.map((link) => ({ ...link })),
  };
}

function cloneContext(row: DigitalCardContext): DigitalCardContext {
  return { ...row };
}

function cloneExchange(row: IdentityExchange): IdentityExchange {
  return {
    ...row,
    submittedContact: { ...row.submittedContact },
  };
}

export class InMemoryDigitalCardStore implements DigitalCardStore {
  private readonly cards = new Map<string, DigitalCard>();
  private readonly contexts = new Map<string, DigitalCardContext>();
  private readonly exchanges = new Map<string, IdentityExchange>();

  reset(): void {
    this.cards.clear();
    this.contexts.clear();
    this.exchanges.clear();
  }

  async getCardById(id: string): Promise<DigitalCard | null> {
    const row = this.cards.get(id.trim());
    return row ? cloneCard(row) : null;
  }

  async getCardBySlug(slug: string): Promise<DigitalCard | null> {
    const key = slug.trim().toLowerCase();
    for (const card of this.cards.values()) {
      if (card.slug === key) return cloneCard(card);
    }
    return null;
  }

  async getPublishedCardBySlug(slug: string): Promise<DigitalCard | null> {
    const card = await this.getCardBySlug(slug);
    if (!card || !card.published) return null;
    return card;
  }

  async getCardByOwner(ownerUsername: string): Promise<DigitalCard | null> {
    const owner = ownerUsername.trim();
    for (const card of this.cards.values()) {
      if (card.ownerUsername === owner) return cloneCard(card);
    }
    return null;
  }

  async upsertCard(card: DigitalCard): Promise<DigitalCard> {
    this.cards.set(card.id, cloneCard(card));
    return cloneCard(card);
  }

  async findActiveContextByPublicToken(
    cardId: string,
    token: string,
  ): Promise<DigitalCardContext | null> {
    const needle = token.trim();
    if (!needle) return null;
    for (const row of this.contexts.values()) {
      if (
        row.cardId === cardId &&
        row.publicToken === needle &&
        row.status === "active"
      ) {
        return cloneContext(row);
      }
    }
    return null;
  }

  async upsertContext(row: DigitalCardContext): Promise<DigitalCardContext> {
    this.contexts.set(row.id, cloneContext(row));
    return cloneContext(row);
  }

  async insertExchange(
    row: IdentityExchange,
  ): Promise<{ status: "inserted" | "already-present"; record: IdentityExchange }> {
    const existing = this.exchanges.get(row.submissionId);
    if (existing) {
      return { status: "already-present", record: cloneExchange(existing) };
    }
    this.exchanges.set(row.submissionId, cloneExchange(row));
    return { status: "inserted", record: cloneExchange(row) };
  }

  async getExchangeBySubmissionId(
    submissionId: string,
  ): Promise<IdentityExchange | null> {
    const row = this.exchanges.get(submissionId.trim());
    return row ? cloneExchange(row) : null;
  }

  async listExchangesByCard(cardId: string): Promise<IdentityExchange[]> {
    return [...this.exchanges.values()]
      .filter((row) => row.cardId === cardId)
      .map(cloneExchange);
  }
}
