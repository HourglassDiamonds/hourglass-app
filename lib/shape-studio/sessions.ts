import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  extensionForCaptureMime,
  normalizeCaptureMime,
} from "./validate-image";
import type {
  CreateSessionResult,
  SessionPollResult,
  ShapeStudioSessionRecord,
  ShapeStudioSessionStatus,
} from "./session-types";
import {
  createStorageShapeStudioSession,
  expireStorageSessionIfNeeded,
  getStorageShapeStudioSession,
  forceExpireStorageSessionForTest,
  readStorageSessionForUpload,
  updateStorageSessionAfterUpload,
  cancelStorageSession,
  acknowledgeStorageSession,
  expireStorageSessionWithCleanup,
  listStorageSessionsForCleanup,
} from "./session-storage";
import {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_MAX_RETENTION_MS,
  SHAPE_STUDIO_SESSION_TTL_MS,
  SHAPE_STUDIO_SIGNED_URL_TTL_SEC,
} from "./session-config";
import { deleteShapeStudioCaptureObjects } from "./session-capture-delete";
import { isValidSessionId } from "./session-id";
import { canAcceptUpload } from "./session-lifecycle";

export {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_SESSION_TTL_MS,
  SHAPE_STUDIO_MAX_RETENTION_MS,
} from "./session-config";

export { isValidSessionId } from "./session-id";

type SessionBackend = "table" | "storage";

let cachedBackend: SessionBackend | null = null;

export function isShapeStudioSessionsAvailable(): boolean {
  return getSupabaseAdmin() !== null;
}

function isMissingTableError(message: string): boolean {
  return message.includes("Could not find the table");
}

async function resolveBackend(force = false): Promise<SessionBackend> {
  if (cachedBackend && !force) return cachedBackend;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase
    .from("shape_studio_sessions")
    .select("session_id")
    .limit(1);

  if (error && isMissingTableError(error.message)) {
    cachedBackend = "storage";
    return cachedBackend;
  }

  if (error) {
    throw new Error(`Shape Studio session probe failed: ${error.message}`);
  }

  cachedBackend = "table";
  return cachedBackend;
}

function rowToRecord(row: {
  session_id: string;
  status: string;
  image_path: string | null;
  image_mime: string | null;
  created_at: string;
  expires_at: string;
  acknowledged_at?: string | null;
}): ShapeStudioSessionRecord {
  return {
    sessionId: row.session_id,
    status: row.status as ShapeStudioSessionStatus,
    imagePath: row.image_path,
    imageMime: row.image_mime,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acknowledgedAt: row.acknowledged_at ?? null,
  };
}

function isExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

async function signedImageUrl(imagePath: string): Promise<string | undefined> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return undefined;

  const { data, error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .createSignedUrl(imagePath, SHAPE_STUDIO_SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

async function createTableSession(): Promise<CreateSessionResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const expiresAt = new Date(
    Date.now() + SHAPE_STUDIO_SESSION_TTL_MS,
  ).toISOString();

  const { data, error } = await supabase
    .from("shape_studio_sessions")
    .insert({
      status: "pending",
      expires_at: expiresAt,
    })
    .select("session_id, expires_at")
    .single();

  if (error) {
    if (isMissingTableError(error.message)) {
      cachedBackend = "storage";
      return createStorageShapeStudioSession();
    }
    throw new Error(`Shape Studio session create failed: ${error.message}`);
  }

  const sessionId = data.session_id as string;
  return {
    sessionId,
    capturePath: `/diamond-shape-studio/capture/${sessionId}`,
    expiresAt: data.expires_at as string,
  };
}

export async function createShapeStudioSession(): Promise<CreateSessionResult> {
  const backend = await resolveBackend();
  if (backend === "storage") {
    return createStorageShapeStudioSession();
  }
  return createTableSession();
}

async function expireTableSessionWithCleanup(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data } = await supabase
    .from("shape_studio_sessions")
    .select("session_id, status, image_path, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!data) return;
  if (data.status === "consumed" || data.status === "cancelled") return;

  const imagePath = data.image_path as string | null;
  if (imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, imagePath);
  }

  await supabase
    .from("shape_studio_sessions")
    .update({
      status: "expired",
      image_path: null,
      image_mime: null,
    })
    .eq("session_id", sessionId)
    .in("status", ["pending", "image_uploaded", "expired"]);
}

async function getTableSession(
  sessionId: string,
): Promise<SessionPollResult | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shape_studio_sessions")
    .select(
      "session_id, status, image_path, image_mime, expires_at, created_at, acknowledged_at",
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    // Older schemas may lack acknowledged_at — retry without it.
    if (error.message.includes("acknowledged_at")) {
      const fallback = await supabase
        .from("shape_studio_sessions")
        .select("session_id, status, image_path, image_mime, expires_at, created_at")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (fallback.error) {
        throw new Error(
          `Shape Studio session read failed: ${fallback.error.message}`,
        );
      }
      if (!fallback.data) return null;
      return finalizeTablePoll(
        rowToRecord({ ...fallback.data, acknowledged_at: null }),
      );
    }
    throw new Error(`Shape Studio session read failed: ${error.message}`);
  }
  if (!data) return null;

  return finalizeTablePoll(rowToRecord(data));
}

async function finalizeTablePoll(
  record: ShapeStudioSessionRecord,
): Promise<SessionPollResult> {
  if (
    (record.status === "pending" || record.status === "image_uploaded") &&
    isExpired(record.expiresAt)
  ) {
    await expireTableSessionWithCleanup(record.sessionId);
    return {
      sessionId: record.sessionId,
      status: "expired",
      expiresAt: record.expiresAt,
    };
  }

  const result: SessionPollResult = {
    sessionId: record.sessionId,
    status: record.status,
    expiresAt: record.expiresAt,
  };

  if (record.acknowledgedAt) {
    result.acknowledgedAt = record.acknowledgedAt;
  }

  // Signed URL issuance is retrieval metadata only — never marks consumed.
  if (record.status === "image_uploaded" && record.imagePath) {
    result.imageUrl = await signedImageUrl(record.imagePath);
  }

  return result;
}

export async function getShapeStudioSession(
  sessionId: string,
): Promise<SessionPollResult | null> {
  if (!isValidSessionId(sessionId)) return null;

  const backend = await resolveBackend();
  if (backend === "storage") {
    return getStorageShapeStudioSession(sessionId);
  }
  return getTableSession(sessionId);
}

function uploadRejectMessage(status: string): string {
  if (status === "cancelled") return "Session cancelled";
  if (status === "consumed") return "Session already consumed";
  if (status === "expired") return "Session expired";
  if (status === "image_uploaded") return "Session already has an image";
  return "Session expired";
}

async function uploadTableCapture(input: {
  sessionId: string;
  bytes: Buffer;
  mime: string;
  sourceFilename?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: row, error: readError } = await supabase
    .from("shape_studio_sessions")
    .select("session_id, status, expires_at")
    .eq("session_id", input.sessionId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Shape Studio session read failed: ${readError.message}`);
  }
  if (!row) throw new Error("Session not found");

  if (!canAcceptUpload(row.status as ShapeStudioSessionStatus)) {
    throw new Error(uploadRejectMessage(row.status as string));
  }

  const expiresAt = row.expires_at as string;
  if (isExpired(expiresAt)) {
    await expireTableSessionWithCleanup(input.sessionId);
    throw new Error("Session expired");
  }

  const mime = normalizeCaptureMime(input.mime, input.sourceFilename);
  const ext = extensionForCaptureMime(mime, input.sourceFilename);
  const objectPath = `${input.sessionId}/capture${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .upload(objectPath, input.bytes, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Shape Studio capture upload failed: ${uploadError.message}`,
    );
  }

  const { error: updateError } = await supabase
    .from("shape_studio_sessions")
    .update({
      status: "image_uploaded",
      image_path: objectPath,
      image_mime: mime,
    })
    .eq("session_id", input.sessionId)
    .eq("status", "pending");

  if (updateError) {
    await deleteShapeStudioCaptureObjects(input.sessionId, objectPath);
    throw new Error(`Shape Studio session update failed: ${updateError.message}`);
  }

  // Confirm the row actually transitioned (race with cancel).
  const { data: after } = await supabase
    .from("shape_studio_sessions")
    .select("status, image_path")
    .eq("session_id", input.sessionId)
    .maybeSingle();

  if (!after || after.status !== "image_uploaded" || after.image_path !== objectPath) {
    await deleteShapeStudioCaptureObjects(input.sessionId, objectPath);
    throw new Error(uploadRejectMessage((after?.status as string) ?? "cancelled"));
  }
}

async function uploadStorageCapture(input: {
  sessionId: string;
  bytes: Buffer;
  mime: string;
  sourceFilename?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const record = await readStorageSessionForUpload(input.sessionId);
  if (!record) throw new Error("Session not found");

  if (!canAcceptUpload(record.status)) {
    throw new Error(uploadRejectMessage(record.status));
  }

  if (isExpired(record.expiresAt)) {
    await expireStorageSessionWithCleanup(input.sessionId);
    throw new Error("Session expired");
  }

  const mime = normalizeCaptureMime(input.mime, input.sourceFilename);
  const ext = extensionForCaptureMime(mime, input.sourceFilename);
  const objectPath = `${input.sessionId}/capture${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .upload(objectPath, input.bytes, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Shape Studio capture upload failed: ${uploadError.message}`,
    );
  }

  try {
    await updateStorageSessionAfterUpload({
      sessionId: input.sessionId,
      imagePath: objectPath,
      imageMime: mime,
    });
  } catch (err) {
    await deleteShapeStudioCaptureObjects(input.sessionId, objectPath);
    throw err;
  }
}

export async function uploadShapeStudioCapture(input: {
  sessionId: string;
  bytes: Buffer;
  mime: string;
  sourceFilename?: string;
}): Promise<void> {
  if (!isValidSessionId(input.sessionId)) {
    throw new Error("Invalid session ID");
  }

  const backend = await resolveBackend();
  if (backend === "storage") {
    await expireStorageSessionIfNeeded(input.sessionId);
    return uploadStorageCapture(input);
  }
  return uploadTableCapture(input);
}

export async function cancelShapeStudioSession(sessionId: string): Promise<void> {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }

  const backend = await resolveBackend();
  if (backend === "storage") {
    await cancelStorageSession(sessionId);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shape_studio_sessions")
    .select("session_id, status, image_path")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw new Error(`Shape Studio session read failed: ${error.message}`);
  if (!data) throw new Error("Session not found");

  if (
    data.status === "cancelled" ||
    data.status === "consumed" ||
    data.status === "expired"
  ) {
    return;
  }

  const imagePath = data.image_path as string | null;
  if (imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, imagePath);
  }

  const { error: updateError } = await supabase
    .from("shape_studio_sessions")
    .update({
      status: "cancelled",
      image_path: null,
      image_mime: null,
    })
    .eq("session_id", sessionId)
    .in("status", ["pending", "image_uploaded"]);

  if (updateError) {
    throw new Error(`Shape Studio cancel failed: ${updateError.message}`);
  }
}

export async function acknowledgeShapeStudioSession(
  sessionId: string,
): Promise<{ status: ShapeStudioSessionStatus; acknowledgedAt: string }> {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }

  const backend = await resolveBackend();
  if (backend === "storage") {
    return acknowledgeStorageSession(sessionId);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shape_studio_sessions")
    .select("session_id, status, image_path, acknowledged_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    // Schema without acknowledged_at — still consume + delete.
    if (error.message.includes("acknowledged_at")) {
      const fallback = await supabase
        .from("shape_studio_sessions")
        .select("session_id, status, image_path")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        throw new Error("Session not found");
      }
      return acknowledgeTableWithoutColumn(sessionId, fallback.data);
    }
    throw new Error(`Shape Studio session read failed: ${error.message}`);
  }
  if (!data) throw new Error("Session not found");

  if (data.status === "consumed") {
    return {
      status: "consumed",
      acknowledgedAt:
        (data.acknowledged_at as string | null) ?? new Date().toISOString(),
    };
  }

  if (data.status !== "image_uploaded") {
    throw new Error("Session has no image to acknowledge");
  }

  const acknowledgedAt = new Date().toISOString();
  const imagePath = data.image_path as string | null;
  if (imagePath) {
    await deleteShapeStudioCaptureObjects(sessionId, imagePath);
  }

  const { error: updateError } = await supabase
    .from("shape_studio_sessions")
    .update({
      status: "consumed",
      image_path: null,
      image_mime: null,
      acknowledged_at: acknowledgedAt,
    })
    .eq("session_id", sessionId)
    .eq("status", "image_uploaded");

  if (updateError) {
    if (updateError.message.includes("acknowledged_at")) {
      return acknowledgeTableWithoutColumn(sessionId, data);
    }
    if (
      updateError.message.includes("consumed") ||
      updateError.message.includes("check")
    ) {
      throw new Error(
        "Session status migration required — run shape-studio-sessions-schema.sql ALTER for consumed/cancelled",
      );
    }
    throw new Error(`Shape Studio acknowledge failed: ${updateError.message}`);
  }

  return { status: "consumed", acknowledgedAt };
}

async function acknowledgeTableWithoutColumn(
  sessionId: string,
  data: { status: string; image_path?: string | null },
): Promise<{ status: ShapeStudioSessionStatus; acknowledgedAt: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  if (data.status === "consumed") {
    return { status: "consumed", acknowledgedAt: new Date().toISOString() };
  }
  if (data.status !== "image_uploaded") {
    throw new Error("Session has no image to acknowledge");
  }

  const acknowledgedAt = new Date().toISOString();
  if (data.image_path) {
    await deleteShapeStudioCaptureObjects(sessionId, data.image_path);
  }

  // Prefer consumed; if CHECK rejects, fall back to expired tombstone after delete.
  const consumed = await supabase
    .from("shape_studio_sessions")
    .update({
      status: "consumed",
      image_path: null,
      image_mime: null,
    })
    .eq("session_id", sessionId)
    .eq("status", "image_uploaded");

  if (consumed.error) {
    await supabase
      .from("shape_studio_sessions")
      .update({
        status: "expired",
        image_path: null,
        image_mime: null,
      })
      .eq("session_id", sessionId);
  }

  return { status: "consumed", acknowledgedAt };
}

export type CaptureCleanupResult = {
  scanned: number;
  expired: number;
  deletedObjects: number;
  errors: number;
};

/**
 * Expire and delete capture objects for sessions past TTL or max retention.
 * Idempotent. Logs counts only — never object paths or URLs.
 */
export async function cleanupExpiredShapeStudioCaptures(): Promise<CaptureCleanupResult> {
  const backend = await resolveBackend(true);
  const result: CaptureCleanupResult = {
    scanned: 0,
    expired: 0,
    deletedObjects: 0,
    errors: 0,
  };

  const now = Date.now();
  const maxRetentionCutoff = new Date(
    now - SHAPE_STUDIO_MAX_RETENTION_MS,
  ).toISOString();

  if (backend === "storage") {
    const records = await listStorageSessionsForCleanup();
    result.scanned = records.length;
    for (const record of records) {
      const pastTtl =
        (record.status === "pending" || record.status === "image_uploaded") &&
        isExpired(record.expiresAt);
      const pastMax =
        (record.status === "pending" || record.status === "image_uploaded") &&
        Date.parse(record.createdAt) <= Date.parse(maxRetentionCutoff);

      if (!pastTtl && !pastMax) continue;

      try {
        const hadImage = Boolean(record.imagePath);
        await expireStorageSessionWithCleanup(record.sessionId);
        result.expired += 1;
        if (hadImage) result.deletedObjects += 1;
      } catch {
        result.errors += 1;
      }
    }
    return result;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return result;

  const { data, error } = await supabase
    .from("shape_studio_sessions")
    .select("session_id, status, image_path, expires_at, created_at")
    .in("status", ["pending", "image_uploaded"])
    .limit(500);

  if (error) {
    result.errors += 1;
    return result;
  }

  result.scanned = data?.length ?? 0;
  for (const row of data ?? []) {
    const pastTtl = isExpired(row.expires_at as string);
    const pastMax =
      Date.parse(row.created_at as string) <= Date.parse(maxRetentionCutoff);
    if (!pastTtl && !pastMax) continue;

    try {
      const hadImage = Boolean(row.image_path);
      await expireTableSessionWithCleanup(row.session_id as string);
      result.expired += 1;
      if (hadImage) result.deletedObjects += 1;
    } catch {
      result.errors += 1;
    }
  }

  return result;
}

/** Test helper: force session expiry simulation (deletes capture object). */
export async function expireShapeStudioSessionForTest(
  sessionId: string,
): Promise<void> {
  const backend = await resolveBackend();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();

  if (backend === "storage") {
    await forceExpireStorageSessionForTest(sessionId, expiredAt);
    return;
  }

  await expireTableSessionWithCleanup(sessionId);
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("shape_studio_sessions")
    .update({ status: "expired", expires_at: expiredAt })
    .eq("session_id", sessionId);
}

/** Test helper: report active session backend. */
export async function resolveShapeStudioBackendForTest(): Promise<
  SessionBackend
> {
  return resolveBackend(true);
}
