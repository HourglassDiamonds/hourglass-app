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
  snapshotBoundaryIsFuture,
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

type SnapshotIdentity = {
  snapshotKey: typeof TODAY_SNAPSHOT_KEY;
  readModelVersion: string;
  sourceWatermark: string | null;
  updatedAt: string;
  payload: TodaySnapshotPayload | null;
};

type PublishResult = "published" | "current" | "stale" | "lost-race" | "unavailable";

function winnerIsCurrent(winner: SnapshotIdentity | null, live: string): boolean {
  if (!winner) return false;
  if (winner.readModelVersion !== CONTINUUM_TODAY_READ_MODEL_VERSION) return false;
  if (winner.sourceWatermark !== live) return false;
  return winner.payload !== null;
}

function isCurrentVersion(winner: SnapshotIdentity | null): winner is SnapshotIdentity & {
  payload: TodaySnapshotPayload;
  sourceWatermark: string;
} {
  return Boolean(
    winner &&
      winner.readModelVersion === CONTINUUM_TODAY_READ_MODEL_VERSION &&
      winner.payload &&
      winner.sourceWatermark,
  );
}

function parseIdentity(row: Record<string, unknown> | null): SnapshotIdentity | null {
  if (!row) return null;
  if (row.snapshot_key !== TODAY_SNAPSHOT_KEY) return null;
  if (typeof row.read_model_version !== "string") return null;
  const updatedAt = String(row.updated_at ?? "");
  if (!updatedAt) return null;
  return {
    snapshotKey: TODAY_SNAPSHOT_KEY,
    readModelVersion: row.read_model_version,
    sourceWatermark: watermarkToken(row.source_watermark),
    updatedAt,
    payload: readTodaySnapshotPayload(row.payload),
  };
}

function parseRecord(row: Record<string, unknown> | null): TodaySnapshotRecord | null {
  const identity = parseIdentity(row);
  if (!identity?.payload || !identity.sourceWatermark) return null;
  return {
    snapshotKey: TODAY_SNAPSHOT_KEY,
    readModelVersion: identity.readModelVersion,
    sourceWatermark: identity.sourceWatermark,
    payload: identity.payload,
    composedAt: String(row?.composed_at ?? ""),
    updatedAt: identity.updatedAt,
  };
}

async function readSnapshotIdentity(
  client: SupabaseClient,
): Promise<SnapshotIdentity | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("snapshot_key, read_model_version, source_watermark, payload, composed_at, updated_at")
    .eq("snapshot_key", TODAY_SNAPSHOT_KEY)
    .limit(1);
  if (error) return null;
  const row = (data?.[0] ?? null) as unknown as Record<string, unknown> | null;
  return parseIdentity(row);
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

function snapshotWrite(input: {
  composedWatermark: string;
  payload: TodaySnapshotPayload;
  composedAt: string;
}) {
  return {
    snapshot_key: TODAY_SNAPSHOT_KEY,
    read_model_version: CONTINUUM_TODAY_READ_MODEL_VERSION,
    source_watermark: { token: input.composedWatermark },
    payload: input.payload,
    composed_at: input.composedAt,
    updated_at: new Date().toISOString(),
  };
}

async function conditionalUpdate(
  client: SupabaseClient,
  write: ReturnType<typeof snapshotWrite>,
  guard: { version?: string; updatedAt?: string; watermark?: string | null },
): Promise<boolean> {
  let query = client.from(TABLE).update(write).eq("snapshot_key", TODAY_SNAPSHOT_KEY);
  if (guard.version) query = query.eq("read_model_version", guard.version);
  if (guard.updatedAt) query = query.eq("updated_at", guard.updatedAt);
  if (guard.watermark) {
    query = query.filter("source_watermark->>token", "eq", guard.watermark);
  }
  const updated = await query.select("snapshot_key");
  return !updated.error && Array.isArray(updated.data) && updated.data.length > 0;
}

async function publishCompatible(
  client: SupabaseClient,
  observed: SnapshotIdentity,
  input: {
    composedWatermark: string;
    payload: TodaySnapshotPayload;
    composedAt: string;
  },
  live: string,
): Promise<PublishResult> {
  // One immutable winner per source watermark. Re-running the same source
  // state must not replace its docket with a different enrichment outcome.
  if (winnerIsCurrent(observed, live)) return "current";
  const atWrite = await readSnapshotIdentity(client);
  if (!atWrite || !isCurrentVersion(atWrite)) return "lost-race";
  if (atWrite.updatedAt !== observed.updatedAt) return "lost-race";
  if (
    !publishWinsRace({
      composedWatermark: input.composedWatermark,
      liveWatermark: live,
      storedWatermarkAtRead: observed.sourceWatermark,
      storedWatermarkAtWrite: atWrite.sourceWatermark,
    })
  ) {
    return "lost-race";
  }
  const wrote = await conditionalUpdate(client, snapshotWrite(input), {
    version: atWrite.readModelVersion,
    updatedAt: atWrite.updatedAt,
    watermark: atWrite.sourceWatermark,
  });
  return wrote ? "published" : "lost-race";
}

/**
 * Replace an incompatible singleton only if it is still the row we observed.
 * A lost compare-and-swap rereads the winner. A valid current-version winner
 * is kept. An incompatible winner gets one guarded retry.
 */
async function upgradeIncompatible(
  client: SupabaseClient,
  observed: SnapshotIdentity,
  input: {
    composedWatermark: string;
    payload: TodaySnapshotPayload;
    composedAt: string;
  },
  live: string,
): Promise<PublishResult> {
  const wrote = await conditionalUpdate(client, snapshotWrite(input), {
    version: observed.readModelVersion,
    updatedAt: observed.updatedAt,
  });
  if (wrote) return "published";

  const winner = await readSnapshotIdentity(client);
  if (!winner) return "lost-race";
  if (winnerIsCurrent(winner, live)) return "current";
  if (isCurrentVersion(winner)) return "lost-race";

  const retried = await conditionalUpdate(client, snapshotWrite(input), {
    version: winner.readModelVersion,
    updatedAt: winner.updatedAt,
  });
  if (retried) return "published";
  const after = await readSnapshotIdentity(client);
  if (after && winnerIsCurrent(after, live)) return "current";
  return "lost-race";
}

export async function publishPersistedTodaySnapshot(
  client: SupabaseClient,
  input: {
    composedWatermark: string;
    payload: TodaySnapshotPayload;
    composedAt: string;
    evaluationTime?: string;
  },
): Promise<PublishResult> {
  if (input.payload.readModelVersion !== CONTINUUM_TODAY_READ_MODEL_VERSION) {
    return "unavailable";
  }
  let live = "";
  try {
    live = await readTodaySourceWatermark(
      client,
      new Date(input.evaluationTime ?? input.composedAt),
    );
  } catch {
    return "unavailable";
  }
  if (input.composedWatermark !== live) return "stale";
  if (!snapshotBoundaryIsFuture(input.payload, input.evaluationTime ?? input.composedAt)) return "stale";

  let observed = await readSnapshotIdentity(client);
  if (!observed) {
    const write = snapshotWrite(input);
    let inserted: { error: unknown } | null = null;
    try {
      inserted = await client.from(TABLE).insert(write).select("snapshot_key");
    } catch (error) {
      if (!isUniqueViolation(error)) return "unavailable";
      inserted = { error };
    }
    if (!inserted?.error) return "published";
    if (!isUniqueViolation(inserted.error)) return "unavailable";

    observed = await readSnapshotIdentity(client);
    if (!observed) return "lost-race";
    if (winnerIsCurrent(observed, live)) return "current";
    if (!isCurrentVersion(observed)) return upgradeIncompatible(client, observed, input, live);
  } else if (!isCurrentVersion(observed)) {
    return upgradeIncompatible(client, observed, input, live);
  }

  return publishCompatible(client, observed, input, live);
}
