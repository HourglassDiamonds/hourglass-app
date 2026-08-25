/**
 * Supabase protected Chief of Staff store.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Service-role only. Never writes kernel Event / Evidence / Observation rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { AttentionItem, ChiefOfStaffBrief } from "../types";
import type {
  AttentionLifecyclePatch,
  ChiefOfStaffStore,
  EntityKind,
} from "./contract";
import { OPEN_ATTENTION_STATUSES } from "./contract";
import { ChiefOfStaffPersistenceError } from "./errors";
import { assertAttentionEntityKinds } from "./entities";
import { briefToRow, itemToRow, rowToBrief, rowToItem } from "./map";

const ITEM_TABLE = "continuum_attention_items";
const BRIEF_TABLE = "continuum_attention_briefs";
const ENTITY_TABLE = "continuum_entities";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new ChiefOfStaffPersistenceError("unavailable");
  return client;
}

function fail(error: { message?: string } | null): never {
  throw new ChiefOfStaffPersistenceError("unavailable", error?.message);
}

export class SupabaseChiefOfStaffStore implements ChiefOfStaffStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly nowIso: () => string = () => new Date().toISOString(),
  ) {}

  private entities = {
    getKind: async (id: string): Promise<EntityKind | null> => {
      const { data, error } = await this.client
        .from(ENTITY_TABLE)
        .select("id, kind")
        .eq("id", id)
        .maybeSingle();
      if (error) fail(error);
      if (!data) return null;
      const kind = String((data as { kind?: string }).kind);
      if (kind === "person" || kind === "project" || kind === "other") {
        return kind;
      }
      return "other";
    },
  };

  async upsertItems(items: AttentionItem[]): Promise<void> {
    const updatedAt = this.nowIso();
    for (const item of items) {
      await assertAttentionEntityKinds(item, this.entities);
      const row = itemToRow(item, updatedAt);
      const { error } = await this.client.from(ITEM_TABLE).upsert(row, {
        onConflict: "id",
      });
      if (error) fail(error);
    }
  }

  async loadItem(id: string): Promise<AttentionItem | null> {
    const { data, error } = await this.client
      .from(ITEM_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error);
    return data ? rowToItem(data as Record<string, unknown>) : null;
  }

  async loadItemsByIds(ids: string[]): Promise<AttentionItem[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from(ITEM_TABLE)
      .select("*")
      .in("id", ids);
    if (error) fail(error);
    const byId = new Map(
      (data ?? []).map((row) => {
        const item = rowToItem(row as Record<string, unknown>);
        return [item.id, item] as const;
      }),
    );
    return ids
      .map((id) => byId.get(id))
      .filter((item): item is AttentionItem => Boolean(item));
  }

  async loadItemByDedupeKey(dedupeKey: string): Promise<AttentionItem | null> {
    const open = await this.loadOpenItemByDedupeKey(dedupeKey);
    if (open) return open;
    const { data, error } = await this.client
      .from(ITEM_TABLE)
      .select("*")
      .eq("dedupe_key", dedupeKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail(error);
    return data ? rowToItem(data as Record<string, unknown>) : null;
  }

  async loadOpenItemByDedupeKey(
    dedupeKey: string,
  ): Promise<AttentionItem | null> {
    const { data, error } = await this.client
      .from(ITEM_TABLE)
      .select("*")
      .eq("dedupe_key", dedupeKey)
      .in("status", [...OPEN_ATTENTION_STATUSES])
      .maybeSingle();
    if (error) fail(error);
    return data ? rowToItem(data as Record<string, unknown>) : null;
  }

  async updateItemLifecycle(
    id: string,
    patch: AttentionLifecyclePatch,
  ): Promise<AttentionItem> {
    const updatedAt = this.nowIso();
    const row: Record<string, unknown> = {
      status: patch.status,
      updated_at: updatedAt,
    };
    if (patch.snoozedUntil !== undefined) {
      row.snoozed_until = patch.snoozedUntil || null;
    }
    if (patch.acknowledgedAt !== undefined) {
      row.acknowledged_at = patch.acknowledgedAt || null;
    }
    if (patch.resolvedAt !== undefined) {
      row.resolved_at = patch.resolvedAt || null;
    }
    const { data, error } = await this.client
      .from(ITEM_TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) fail(error);
    if (!data) throw new ChiefOfStaffPersistenceError("unavailable");
    return rowToItem(data as Record<string, unknown>);
  }

  async putBrief(brief: ChiefOfStaffBrief): Promise<void> {
    const { data: existing, error: loadError } = await this.client
      .from(BRIEF_TABLE)
      .select("created_at")
      .eq("local_date", brief.localDate)
      .maybeSingle();
    if (loadError) fail(loadError);
    const createdAt = existing
      ? String((existing as { created_at: string }).created_at)
      : this.nowIso();
    const { error } = await this.client.from(BRIEF_TABLE).upsert(
      briefToRow(brief, createdAt),
      { onConflict: "local_date" },
    );
    if (error) fail(error);
  }

  async getBriefByLocalDate(
    localDate: string,
  ): Promise<ChiefOfStaffBrief | null> {
    const { data, error } = await this.client
      .from(BRIEF_TABLE)
      .select("*")
      .eq("local_date", localDate)
      .maybeSingle();
    if (error) fail(error);
    return data ? rowToBrief(data as Record<string, unknown>) : null;
  }
}

export function createSupabaseChiefOfStaffStore(
  client?: SupabaseClient | null,
  nowIso?: () => string,
): SupabaseChiefOfStaffStore {
  return new SupabaseChiefOfStaffStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
    nowIso,
  );
}
