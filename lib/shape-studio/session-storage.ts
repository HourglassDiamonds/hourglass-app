import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  CreateSessionResult,
  SessionPollResult,
  ShapeStudioSessionStatus,
} from "./session-types";
import {
  SHAPE_STUDIO_CAPTURES_BUCKET,
  SHAPE_STUDIO_SESSION_TTL_MS,
  SHAPE_STUDIO_SIGNED_URL_TTL_SEC,
} from "./session-config";

type StorageSessionRecord = {
  sessionId: string;
  status: ShapeStudioSessionStatus;
  imagePath: string | null;
  imageMime: string | null;
  createdAt: string;
  expiresAt: string;
};

function sessionMetaPath(sessionId: string): string {
  return `sessions/${sessionId}.json`;
}

function isExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

async function readStorageSession(
  sessionId: string,
): Promise<StorageSessionRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .download(sessionMetaPath(sessionId));

  if (error || !data) return null;

  const text = await data.text();
  return JSON.parse(text) as StorageSessionRecord;
}

async function writeStorageSession(record: StorageSessionRecord): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .upload(sessionMetaPath(record.sessionId), JSON.stringify(record), {
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
  });

  return {
    sessionId,
    capturePath: `/diamond-shape-studio/capture/${sessionId}`,
    expiresAt,
  };
}

export async function getStorageShapeStudioSession(
  sessionId: string,
): Promise<SessionPollResult | null> {
  const record = await readStorageSession(sessionId);
  if (!record) return null;

  if (record.status === "expired") {
    return {
      sessionId,
      status: "expired",
      expiresAt: record.expiresAt,
    };
  }

  if (record.status !== "image_uploaded" && isExpired(record.expiresAt)) {
    await writeStorageSession({ ...record, status: "expired" });
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
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.storage
        .from(SHAPE_STUDIO_CAPTURES_BUCKET)
        .createSignedUrl(record.imagePath, SHAPE_STUDIO_SIGNED_URL_TTL_SEC);
      if (!error && data?.signedUrl) {
        result.imageUrl = data.signedUrl;
      }
    }
  }

  return result;
}

export async function markStorageSessionExpired(sessionId: string): Promise<void> {
  const record = await readStorageSession(sessionId);
  if (!record || record.status === "image_uploaded") return;
  await writeStorageSession({ ...record, status: "expired" });
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
  if (record.status !== "image_uploaded" && isExpired(record.expiresAt)) {
    await writeStorageSession({ ...record, status: "expired" });
  }
}

export async function forceExpireStorageSessionForTest(
  sessionId: string,
  expiredAt: string,
): Promise<void> {
  const record = await readStorageSession(sessionId);
  if (!record) return;
  await writeStorageSession({
    ...record,
    status: "expired",
    expiresAt: expiredAt,
  });
}
