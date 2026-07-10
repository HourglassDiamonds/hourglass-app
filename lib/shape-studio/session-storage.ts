import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  CreateSessionResult,
  SessionPollResult,
  ShapeStudioSessionRecord,
  ShapeStudioSessionStatus,
} from "./session-types";
import {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_SESSION_TTL_MS,
  SHAPE_STUDIO_SIGNED_URL_TTL_SEC,
} from "./session-config";
import {
  deleteShapeStudioCaptureObjects,
  sessionMetaObjectPath,
} from "./session-capture-delete";
import { isValidSessionId } from "./session-id";

export type StorageSessionRecord = ShapeStudioSessionRecord;

function isExpired(expiresAt: string, nowMs = Date.now()): boolean {
  return Date.parse(expiresAt) <= nowMs;
}

async function readStorageSession(
  sessionId: string,
): Promise<StorageSessionRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .download(sessionMetaObjectPath(sessionId));

  if (error || !data) return null;

  const text = await data.text();
  return JSON.parse(text) as StorageSessionRecord;
}

async function writeStorageSession(record: StorageSessionRecord): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .upload(sessionMetaObjectPath(record.sessionId), JSON.stringify(record), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw new Error(`Shape Studio session write failed: ${error.message}`);
  }
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
    if (record) records.push(record);
  }
  return records;
}
