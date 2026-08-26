import type { AttentionItem, AttentionStatus, ChiefOfStaffBrief } from "../types";

export const OPEN_ATTENTION_STATUSES = [
  "new",
  "seen",
  "acknowledged",
  "snoozed",
] as const satisfies readonly AttentionStatus[];

export type OpenAttentionStatus = (typeof OPEN_ATTENTION_STATUSES)[number];

export function isOpenAttentionStatus(
  status: AttentionStatus,
): status is OpenAttentionStatus {
  return (OPEN_ATTENTION_STATUSES as readonly string[]).includes(status);
}

export type AttentionLifecyclePatch = {
  status: AttentionStatus;
  snoozedUntil?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

export type EntityKind = "person" | "project" | "other";

export type EntityKindReader = {
  getKind(id: string): Promise<EntityKind | null>;
};

export type ChiefOfStaffStore = {
  upsertItems(items: AttentionItem[]): Promise<void>;
  loadItem(id: string): Promise<AttentionItem | null>;
  loadItemsByIds(ids: string[]): Promise<AttentionItem[]>;
  loadItemByDedupeKey(dedupeKey: string): Promise<AttentionItem | null>;
  loadOpenItemByDedupeKey(dedupeKey: string): Promise<AttentionItem | null>;
  updateItemLifecycle(
    id: string,
    patch: AttentionLifecyclePatch,
  ): Promise<AttentionItem>;
  putBrief(brief: ChiefOfStaffBrief): Promise<void>;
  getBriefByLocalDate(localDate: string): Promise<ChiefOfStaffBrief | null>;
};
