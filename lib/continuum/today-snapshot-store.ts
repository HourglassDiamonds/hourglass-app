/**
 * Server-only Today snapshot store.
 * Service-role reads and writes. No browser client. No canonical writes.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readTodaySourceWatermark } from "./today-source-watermark";
import {
  CONTINUUM_TODAY_READ_MODEL_VERSION,
  TODAY_SNAPSHOT_KEY,
  publishWinsRace,
  readTodaySnapshotPayload,
  watermarkToken,
  type TodaySnapshotPayload,
  type TodaySnapshotRecord,
} from "./today-snapshot";

const TABLE = "continuum_today_snapshots";
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === UNIQUE_VIOLATION;
}

function winnerIsCurrent(winner: TodaySnapshotRecord | null, live: string): boolean {
  if (!winner) return false;
  if (winner.readModelVersion !== CONTINUUM_TODAY_READ_MODEL_VERSION) return false;
  if (winner.sourceWatermark !== live) return false;
  return readTodaySnapshotPayload(winner.payload) !== null;
}

function parseRecord(row: Record<string, unknown> | null): TodaySnapshotRecord | null {
  if (!row) return null;
  if (row.snapshot_key !== TODAY_SNAPSHOT_KEY) return null;
  if (typeof row.read_model_version !== "string") return null;
  const sourceWatermark = watermarkToken(row.source_watermark);
  const payload = readTodaySnapshotPayload(row.payload);
  if (!sourceWatermark || !payload) return null;
  return {
    snapshotKey: TODAY_SNAPSHOT_KEY,
    readModelVersion: row.read_model_version,
    sourceWatermark,
    payload,
    composedAt: String(row.composed_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function readPersistedTodaySnapshot(
  client: SupabaseClient,
): Promise<TodaySnapshotRecord | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("snapshot_key, read_model_version, source_watermark, payload, composed_at, updated_at")
    .eq("snapshot_key", TODAY_SNAPSHOT_KEY)
    .limit(1);
  if (error) return null;
  const row = (data?.[0] ?? null) as unknown as Record<string, unknown> | null;
  return parseRecord(row);
}

export async function publishPersistedTodaySnapshot(
  client: SupabaseClient,
  input: {
    composedWatermark: string;
    payload: TodaySnapshotPayload;
    composedAt: string;
  },
): Promise<"published" | "stale" | "lost-race" | "unavailable"> {
  let live = "";
  try {
    live = await readTodaySourceWatermark(client);
  } catch {
    return "unavailable";
  }
  if (input.composedWatermark !== live) return "stale";

  let observed = await readPersistedTodaySnapshot(client);
  const write = {
    snapshot_key: TODAY_SNAPSHOT_KEY,
    read_model_version: CONTINUUM_TODAY_READ_MODEL_VERSION,
    source_watermark: { token: input.composedWatermark },
    payload: input.payload,
    composed_at: input.composedAt,
    updated_at: new Date().toISOString(),
  };

  if (!observed) {
    let inserted: { error: unknown } | null = null;
    try {
      inserted = await client.from(TABLE).insert(write).select("snapshot_key");
    } catch (error) {
      if (!isUniqueViolation(error)) return "unavailable";
      inserted = { error };
    }
    if (!inserted?.error) return "published";
    if (!isUniqueViolation(inserted.error)) return "unavailable";

    const winner = await readPersistedTodaySnapshot(client);
    if (winnerIsCurrent(winner, live)) return "published";
    if (!winner) return "lost-race";
    observed = winner;
  }

  const atWrite = (await readPersistedTodaySnapshot(client))?.sourceWatermark ?? null;
  if (
    !publishWinsRace({
      composedWatermark: input.composedWatermark,
      liveWatermark: live,
      storedWatermarkAtRead: observed.sourceWatermark,
      storedWatermarkAtWrite: atWrite,
    })
  ) {
    return "lost-race";
  }

  const updated = await client
    .from(TABLE)
    .update(write)
    .eq("snapshot_key", TODAY_SNAPSHOT_KEY)
    .filter("source_watermark->>token", "eq", atWrite)
    .select("snapshot_key");
  if (updated.error || !updated.data?.length) return "lost-race";
  return "published";
}
