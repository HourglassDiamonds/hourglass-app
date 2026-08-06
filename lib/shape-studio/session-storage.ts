import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  CreateSessionResult,
  SessionPollResult,
  ShapeStudioSessionRecord,
  ShapeStudioSessionStatus,
} from "./session-types";
import {
  deleteShapeStudioCaptureObjects,
  deleteShapeStudioSessionMetaObjects,
  buildSessionMetaRevisionId,
  pruneOlderSessionMetaRevisions,
  selectNewestSessionMetaRevisionName,
  sessionMetaObjectPath,
  sessionMetaRevisionObjectPath,
  sessionMetaRevisionPrefix,
} from "./session-capture-delete";
import { isValidSessionId } from "./session-id";
import {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_SESSION_TTL_MS,
  SHAPE_STUDIO_SIGNED_URL_TTL_SEC,
  SHAPE_STUDIO_TOMBSTONE_TTL_MS,
} from "./session-config";

export type StorageSessionRecord = ShapeStudioSessionRecord;

/**
 * Session meta is polled as the delivery signal. Supabase Storage defaults to
 * `max-age=3600`, so overwriting the same object left production GET polls on
 * stale `image_uploaded` long after acknowledge wrote `consumed`.
 * Writes use cacheControl 0 plus a unique revision key (CDN-safe).
 */
export const SESSION_META_CACHE_CONTROL = "0";

function isExpired(expiresAt: string, nowMs = Date.now()): boolean {
  return Date.parse(expiresAt) <= nowMs;
}

async function downloadSessionMetaJson(
  objectPath: string,
): Promise<StorageSessionRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .download(objectPath);

  if (error || !data) return null;

  const text = await data.text();
  return JSON.parse(text) as StorageSessionRecord;
}

async function readStorageSession(
  sessionId: string,
): Promise<StorageSessionRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  // Prefer the newest unique revision — never previously cached under this key.
  const { data: revisions } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .list(sessionMetaRevisionPrefix(sessionId), {
      limit: 100,
      sortBy: { column: "name", order: "desc" },
    });

  const newest = selectNewestSessionMetaRevisionName(
    (revisions ?? [])
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name)),
  );

  if (newest) {
    const revisionId = newest.replace(/\.json$/, "");
    try {
      const revised = await downloadSessionMetaJson(
        sessionMetaRevisionObjectPath(sessionId, revisionId),
      );
      if (revised) return revised;
    } catch {
      /* fall through to legacy flat path */
    }
  }

  return downloadSessionMetaJson(sessionMetaObjectPath(sessionId));
}

function isTerminalPastTombstone(
  record: StorageSessionRecord,
  nowMs = Date.now(),
): boolean {
  if (
    record.status !== "consumed" &&
    record.status !== "cancelled" &&
    record.status !== "expired"
  ) {
    return false;
  }
  const anchor =
    record.acknowledgedAt ?? record.expiresAt ?? record.createdAt;
  const anchorMs = Date.parse(anchor);
  if (!Number.isFinite(anchorMs)) return false;
  return anchorMs + SHAPE_STUDIO_TOMBSTONE_TTL_MS <= nowMs;
}

async function writeStorageSession(record: StorageSessionRecord): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const payload = JSON.stringify(record);
  const revisionId = buildSessionMetaRevisionId();
  const revisionPath = sessionMetaRevisionObjectPath(
    record.sessionId,
    revisionId,
  );

  const revisionUpload = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .upload(revisionPath, payload, {
      contentType: "application/json",
      upsert: false,
      cacheControl: SESSION_META_CACHE_CONTROL,
    });

  if (revisionUpload.error) {
    throw new Error(
      `Shape Studio session write failed: ${revisionUpload.error.message}`,
    );
  }

  // Legacy flat path kept for cleanup listing + older readers.
  const legacyUpload = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .upload(sessionMetaObjectPath(record.sessionId), payload, {
      contentType: "application/json",
      upsert: true,
      cacheControl: SESSION_META_CACHE_CONTROL,
    });

  if (legacyUpload.error) {
    throw new Error(
      `Shape Studio session write failed: ${legacyUpload.error.message}`,
    );
  }

  // Drop superseded immutable revisions so cleanup cannot leave them forever.
  await pruneOlderSessionMetaRevisions(record.sessionId, revisionId);
}

export async function createStorageShapeStudioSession(): Promise<CreateSessionResult> {
  const sessionId = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + SHAPE_STUDIO_SESSION_TTL_MS,
  ).toISOString();

  await writeStorageSession({
    sessionId,
    status: "pending",
    imagePath: null,
    imageMime: null,
    createdAt,
    expiresAt,
    acknowledgedAt: null,
  });

  return {
    sessionId,
    capturePath: `/diamond-shape-studio/capture/${sessionId}`,
    expiresAt,
  };
}

async function signedUrlFor(imagePath: string): Promise<string | undefined> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return undefined;
  const { data, error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .createSignedUrl(imagePath, SHAPE_STUDIO_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

export async function getStorageShapeStudioSession(
  sessionId: string,
): Promise<SessionPollResult | null> {
  const record = await readStorageSession(sessionId);
  if (!record) return null;

  if (
    (record.status === "pending" || record.status === "image_uploaded") &&
    isExpired(record.expiresAt)
  ) {
    await expireStorageSessionWithCleanup(sessionId);
    return {
      sessionId,
      status: "expired",
      expiresAt: record.expiresAt,
    };
  }

  const result: SessionPollResult = {
    sessionId,
    status: record.status,
    expiresAt: record.expiresAt,
  };

  if (record.acknowledgedAt) {
    result.acknowledgedAt = record.acknowledgedAt;
  }

  if (record.status === "image_uploaded" && record.imagePath) {
    result.imageUrl = await signedUrlFor(record.imagePath);
  }

  return result;
}

export async function markStorageSessionExpired(sessionId: string): Promise<void> {
  await expireStorageSessionWithCleanup(sessionId);
}

export async function expireStorageSessionWithCleanup(
  sessionId: string,
): Promise<void> {
  const record = await readStorageSession(sessionId);
  if (!record) return;
  if (record.status === "consumed" || record.status === "cancelled") return;
  if (record.status === "expired" && !record.imagePath) return;

  if (record.imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, record.imagePath);
  }

  await writeStorageSession({
    ...record,
    status: "expired",
    imagePath: null,
    imageMime: null,
  });
}

export async function cancelStorageSession(sessionId: string): Promise<void> {
  const record = await readStorageSession(sessionId);
  if (!record) throw new Error("Session not found");
  if (record.status === "cancelled") return;
  if (record.status === "consumed") return;
  if (record.status === "expired") return;

  if (record.imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, record.imagePath);
  }

  await writeStorageSession({
    ...record,
    status: "cancelled",
    imagePath: null,
    imageMime: null,
  });
}

export async function acknowledgeStorageSession(
  sessionId: string,
): Promise<{ status: ShapeStudioSessionStatus; acknowledgedAt: string }> {
  const record = await readStorageSession(sessionId);
  if (!record) throw new Error("Session not found");

  if (record.status === "consumed") {
    return {
      status: "consumed",
      acknowledgedAt: record.acknowledgedAt ?? new Date().toISOString(),
    };
  }

  if (record.status !== "image_uploaded") {
    throw new Error("Session has no image to acknowledge");
  }

  const acknowledgedAt = new Date().toISOString();
  if (record.imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, record.imagePath);
  }

  await writeStorageSession({
    ...record,
    status: "consumed",
    imagePath: null,
    imageMime: null,
    acknowledgedAt,
  });

  return { status: "consumed", acknowledgedAt };
}

export async function readStorageSessionForUpload(
  sessionId: string,
): Promise<StorageSessionRecord | null> {
  return readStorageSession(sessionId);
}

export async function updateStorageSessionAfterUpload(input: {
  sessionId: string;
  imagePath: string;
  imageMime: string;
}): Promise<void> {
  const record = await readStorageSession(input.sessionId);
  if (!record) throw new Error("Session not found");
  if (record.status !== "pending") {
    throw new Error(
      record.status === "image_uploaded"
        ? "Session already has an image"
        : record.status === "cancelled"
          ? "Session cancelled"
          : record.status === "consumed"
            ? "Session already consumed"
            : "Session expired",
    );
  }

  await writeStorageSession({
    ...record,
    status: "image_uploaded",
    imagePath: input.imagePath,
    imageMime: input.imageMime,
  });
}

export async function expireStorageSessionIfNeeded(
  sessionId: string,
): Promise<void> {
  const record = await readStorageSession(sessionId);
  if (!record) return;
  if (
    (record.status === "pending" || record.status === "image_uploaded") &&
    isExpired(record.expiresAt)
  ) {
    await expireStorageSessionWithCleanup(sessionId);
  }
}

export async function forceExpireStorageSessionForTest(
  sessionId: string,
  expiredAt: string,
): Promise<void> {
  const record = await readStorageSession(sessionId);
  if (!record) return;
  if (record.imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, record.imagePath);
  }
  await writeStorageSession({
    ...record,
    status: "expired",
    expiresAt: expiredAt,
    imagePath: null,
    imageMime: null,
  });
}

export async function listStorageSessionsForCleanup(): Promise<
  StorageSessionRecord[]
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .list("sessions", { limit: 1000 });

  if (error || !data) return [];

  const records: StorageSessionRecord[] = [];
  for (const entry of data) {
    if (!entry.name?.endsWith(".json")) continue;
    const sessionId = entry.name.replace(/\.json$/, "");
    if (!isValidSessionId(sessionId)) continue;
    const record = await readStorageSession(sessionId);
    if (!record) continue;

    // Cron scans this list: purge terminal tombstones past retention so
    // legacy flat + revision objects do not accumulate indefinitely.
    if (isTerminalPastTombstone(record)) {
      try {
        if (record.imagePath) {
          await deleteShapeStudioCaptureObjects(sessionId, record.imagePath);
        }
        await deleteShapeStudioSessionMetaObjects(sessionId);
      } catch {
        /* keep scanning */
      }
      continue;
    }

    records.push(record);
  }
  return records;
}
