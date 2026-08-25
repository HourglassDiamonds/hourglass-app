import type { AttentionItem, ChiefOfStaffBrief } from "../types";
import type {
  AttentionLifecyclePatch,
  ChiefOfStaffStore,
  EntityKindReader,
} from "./contract";
import { isOpenAttentionStatus } from "./contract";
import { ChiefOfStaffPersistenceError } from "./errors";
import { assertAttentionEntityKinds } from "./entities";
import { applyLifecyclePatch } from "./map";

export type { ChiefOfStaffStore } from "./contract";

function cloneItem(item: AttentionItem): AttentionItem {
  return {
    ...item,
    observationIds: [...item.observationIds],
    evidenceIds: [...item.evidenceIds],
    reasonCodes: [...item.reasonCodes],
  };
}

function cloneBrief(brief: ChiefOfStaffBrief): ChiefOfStaffBrief {
  return {
    ...brief,
    attentionItemIds: [...brief.attentionItemIds],
    worthKnowing: brief.worthKnowing.map((row) => ({ ...row })),
  };
}

export class InMemoryChiefOfStaffStore implements ChiefOfStaffStore {
  private readonly items = new Map<string, AttentionItem>();
  private readonly briefs = new Map<string, ChiefOfStaffBrief>();

  constructor(
    private readonly options: {
      nowIso?: () => string;
      entities?: EntityKindReader;
    } = {},
  ) {}

  private now(): string {
    return this.options.nowIso?.() ?? new Date().toISOString();
  }

  async upsertItems(items: AttentionItem[]): Promise<void> {
    const updatedAt = this.now();
    for (const item of items) {
      if (this.options.entities) {
        await assertAttentionEntityKinds(item, this.options.entities);
      } else if (item.personId || item.projectId) {
        throw new ChiefOfStaffPersistenceError("entity-kind-invalid");
      }
      this.items.set(item.id, cloneItem({ ...item, updatedAt }));
    }
  }

  async loadItem(id: string): Promise<AttentionItem | null> {
    const item = this.items.get(id);
    return item ? cloneItem(item) : null;
  }

  async loadItemsByIds(ids: string[]): Promise<AttentionItem[]> {
    return ids
      .map((id) => this.items.get(id))
      .filter((item): item is AttentionItem => Boolean(item))
      .map(cloneItem);
  }

  async loadItemByDedupeKey(dedupeKey: string): Promise<AttentionItem | null> {
    const open = await this.loadOpenItemByDedupeKey(dedupeKey);
    if (open) return open;
    let latest: AttentionItem | undefined;
    for (const item of this.items.values()) {
      if (item.dedupeKey !== dedupeKey) continue;
      if (
        !latest ||
        Date.parse(item.createdAt) >= Date.parse(latest.createdAt)
      ) {
        latest = item;
      }
    }
    return latest ? cloneItem(latest) : null;
  }

  async loadOpenItemByDedupeKey(
    dedupeKey: string,
  ): Promise<AttentionItem | null> {
    let match: AttentionItem | undefined;
    for (const item of this.items.values()) {
      if (item.dedupeKey !== dedupeKey) continue;
      if (!isOpenAttentionStatus(item.status)) continue;
      if (
        !match ||
        Date.parse(item.createdAt) >= Date.parse(match.createdAt)
      ) {
        match = item;
      }
    }
    return match ? cloneItem(match) : null;
  }

  async updateItemLifecycle(
    id: string,
    patch: AttentionLifecyclePatch,
  ): Promise<AttentionItem> {
    const existing = this.items.get(id);
    if (!existing) throw new ChiefOfStaffPersistenceError("unavailable");
    const next = applyLifecyclePatch(existing, patch, this.now());
    this.items.set(id, next);
    return cloneItem(next);
  }

  async putBrief(brief: ChiefOfStaffBrief): Promise<void> {
    this.briefs.set(brief.localDate, cloneBrief(brief));
  }

  async getBriefByLocalDate(
    localDate: string,
  ): Promise<ChiefOfStaffBrief | null> {
    const brief = this.briefs.get(localDate);
    return brief ? cloneBrief(brief) : null;
  }
}
