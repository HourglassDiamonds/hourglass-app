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
  markStorageSessionExpired,
  forceExpireStorageSessionForTest,
  readStorageSessionForUpload,
  updateStorageSessionAfterUpload,
} from "./session-storage";
import {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_SESSION_TTL_MS,
  SHAPE_STUDIO_SIGNED_URL_TTL_SEC,
} from "./session-config";

export {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_SESSION_TTL_MS,
} from "./session-config";

type SessionBackend = "table" | "storage";

let cachedBackend: SessionBackend | null = null;

export function isShapeStudioSessionsAvailable(): boolean {
  return getSupabaseAdmin() !== null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(sessionId: string): boolean {
  return UUID_RE.test(sessionId);
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
}): ShapeStudioSessionRecord {
  return {
    sessionId: row.session_id,
    status: row.status as ShapeStudioSessionStatus,
    imagePath: row.image_path,
    imageMime: row.image_mime,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function isExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

async function markTableSessionExpired(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("shape_studio_sessions")
    .update({ status: "expired" })
    .eq("session_id", sessionId)
    .neq("status", "image_uploaded");
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

async function getTableSession(
  sessionId: string,
): Promise<SessionPollResult | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shape_studio_sessions")
    .select("session_id, status, image_path, image_mime, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Shape Studio session read failed: ${error.message}`);
  }
  if (!data) return null;

  const record = rowToRecord({
    ...data,
    created_at: "",
  });

  if (record.status !== "image_uploaded" && isExpired(record.expiresAt)) {
    await markTableSessionExpired(sessionId);
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

  if (row.status === "expired") {
    throw new Error("Session expired");
  }

  const expiresAt = row.expires_at as string;
  if (isExpired(expiresAt)) {
    await markTableSessionExpired(input.sessionId);
    throw new Error("Session expired");
  }

  if (row.status === "image_uploaded") {
    throw new Error("Session already has an image");
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
    .eq("session_id", input.sessionId);

  if (updateError) {
    throw new Error(`Shape Studio session update failed: ${updateError.message}`);
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

  if (record.status === "expired" || isExpired(record.expiresAt)) {
    await markStorageSessionExpired(input.sessionId);
    throw new Error("Session expired");
  }

  if (record.status === "image_uploaded") {
    throw new Error("Session already has an image");
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

  await updateStorageSessionAfterUpload({
    sessionId: input.sessionId,
    imagePath: objectPath,
    imageMime: mime,
  });
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

/** Test helper: force session expiry simulation. */
export async function expireShapeStudioSessionForTest(
  sessionId: string,
): Promise<void> {
  const backend = await resolveBackend();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();

  if (backend === "storage") {
    await forceExpireStorageSessionForTest(sessionId, expiredAt);
    return;
  }

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
