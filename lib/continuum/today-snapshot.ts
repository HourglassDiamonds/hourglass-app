/**
 * Persisted Today read model.
 * The payload is the rendered docket, not the operating loop.
 * It is display state. Canonical truth stays in the source tables.
 */

import type { CosTodayDocketView } from "@/lib/continuum/chief-of-staff/operating-loop/docket";

export const CONTINUUM_TODAY_READ_MODEL_VERSION = "continuum-today-read-model-v2" as const;
export const TODAY_SNAPSHOT_KEY = "founder_today_v1" as const;

const DROP_KEYS = new Set([
  "sourceEvents",
  "authorOwnedText",
  "quotedText",
  "quotedTexts",
  "body",
  "snippet",
  "html",
  "rawBody",
  "payloadHtml",
  "attachmentBytes",
  "messages",
  "threadContext",
  "founderEmailHashes",
]);

const MAX_TEXT = 800;

export type TodaySnapshotPayload = {
  readModelVersion: typeof CONTINUUM_TODAY_READ_MODEL_VERSION;
  docket: CosTodayDocketView;
};

export type TodaySnapshotRecord = {
  snapshotKey: typeof TODAY_SNAPSHOT_KEY;
  readModelVersion: string;
  sourceWatermark: string;
  payload: TodaySnapshotPayload;
  composedAt: string;
  updatedAt: string;
};

export type TodaySnapshotUse = "current" | "refreshing" | "miss";

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    const withoutQuotes = value
      .split("\n")
      .filter((line) => !/^\s*>/.test(line) && !/\bwrote:\s*$/i.test(line))
      .join("\n")
      .trim();
    return withoutQuotes.length > MAX_TEXT ? withoutQuotes.slice(0, MAX_TEXT) : withoutQuotes;
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DROP_KEYS.has(key)) continue;
    out[key] = sanitize(child);
  }
  return out;
}

export function projectTodaySnapshot(docket: CosTodayDocketView): TodaySnapshotPayload {
  const sanitized = sanitize(docket) as CosTodayDocketView;
  return {
    readModelVersion: CONTINUUM_TODAY_READ_MODEL_VERSION,
    docket: sanitized,
  };
}

export function serializedTodaySnapshotBytes(payload: TodaySnapshotPayload): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function readTodaySnapshotPayload(value: unknown): TodaySnapshotPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { readModelVersion?: unknown; docket?: unknown };
  if (row.readModelVersion !== CONTINUUM_TODAY_READ_MODEL_VERSION) return null;
  if (!row.docket || typeof row.docket !== "object") return null;
  const docket = row.docket as { items?: unknown; watching?: unknown };
  if (!Array.isArray(docket.items) || !Array.isArray(docket.watching)) return null;
  return row as TodaySnapshotPayload;
}

export function watermarkToken(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const token = (value as { token?: unknown }).token;
  return typeof token === "string" && token.trim() ? token : null;
}

export function decideSnapshotUse(input: {
  record: TodaySnapshotRecord | null;
  liveWatermark: string | null;
}): TodaySnapshotUse {
  if (!input.record) return "miss";
  if (input.record.readModelVersion !== CONTINUUM_TODAY_READ_MODEL_VERSION) return "miss";
  if (!readTodaySnapshotPayload(input.record.payload)) return "miss";
  if (!input.liveWatermark) return "miss";
  if (input.record.sourceWatermark === input.liveWatermark) return "current";
  return "refreshing";
}

/**
 * Publish only the composition that still matches the live watermark,
 * and only if the stored row is still the row we observed.
 * An older compose cannot overwrite a newer published watermark.
 */
export function publishWinsRace(input: {
  composedWatermark: string;
  liveWatermark: string;
  storedWatermarkAtRead: string | null;
  storedWatermarkAtWrite: string | null;
}): boolean {
  if (!input.composedWatermark) return false;
  if (input.composedWatermark !== input.liveWatermark) return false;
  return input.storedWatermarkAtWrite === input.storedWatermarkAtRead;
}
