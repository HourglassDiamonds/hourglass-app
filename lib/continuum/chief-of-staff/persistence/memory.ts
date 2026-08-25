import type { AttentionItem, ChiefOfStaffBrief } from "../types";

export type ChiefOfStaffStore = {
  upsertItems(items: AttentionItem[]): Promise<void>;
  loadItem(id: string): Promise<AttentionItem | null>;
  loadItemsByIds(ids: string[]): Promise<AttentionItem[]>;
  loadItemByDedupeKey(dedupeKey: string): Promise<AttentionItem | null>;
  putBrief(brief: ChiefOfStaffBrief): Promise<void>;
  getBriefByLocalDate(localDate: string): Promise<ChiefOfStaffBrief | null>;
};

export class InMemoryChiefOfStaffStore implements ChiefOfStaffStore {
  private readonly items = new Map<string, AttentionItem>();
  private readonly briefs = new Map<string, ChiefOfStaffBrief>();

  async upsertItems(items: AttentionItem[]): Promise<void> {
    for (const item of items) {
      this.items.set(item.id, { ...item, reasonCodes: [...item.reasonCodes] });
    }
  }

  async loadItem(id: string): Promise<AttentionItem | null> {
    return this.items.get(id) ?? null;
  }

  async loadItemsByIds(ids: string[]): Promise<AttentionItem[]> {
    return ids
      .map((id) => this.items.get(id))
      .filter((item): item is AttentionItem => Boolean(item));
  }

  async loadItemByDedupeKey(dedupeKey: string): Promise<AttentionItem | null> {
    for (const item of this.items.values()) {
      if (item.dedupeKey === dedupeKey) return item;
    }
    return null;
  }

  async putBrief(brief: ChiefOfStaffBrief): Promise<void> {
    this.briefs.set(brief.localDate, {
      ...brief,
      attentionItemIds: [...brief.attentionItemIds],
      worthKnowing: brief.worthKnowing.map((row) => ({ ...row })),
    });
  }

  async getBriefByLocalDate(
    localDate: string,
  ): Promise<ChiefOfStaffBrief | null> {
    return this.briefs.get(localDate) ?? null;
  }
}
