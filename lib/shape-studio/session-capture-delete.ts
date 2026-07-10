import { getSupabaseAdmin } from "@/lib/supabase/client";
import { SHAPE_STUDIO_CAPTURES_BUCKET } from "./session-config";
import { isValidSessionId } from "./session-id";

/**
 * Derive the only allowed capture object prefix for a session.
 * Never accept a client-supplied storage path.
 */
export function trustedCapturePrefix(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }
  return `${sessionId}/`;
}

export function isPathInsideTrustedCapturePrefix(
  sessionId: string,
  objectPath: string,
): boolean {
  const prefix = trustedCapturePrefix(sessionId);
  return (
    objectPath.startsWith(prefix) &&
    !objectPath.includes("..") &&
    objectPath !== prefix
  );
}

export function sessionMetaObjectPath(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }
  return `sessions/${sessionId}.json`;
}

/**
 * Delete capture image object(s) for a session.
 * Tolerates missing objects. Does not delete session tombstone JSON.
 */
export async function deleteShapeStudioCaptureObjects(
  sessionId: string,
  knownImagePath?: string | null,
): Promise<{ deleted: number }> {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const prefix = trustedCapturePrefix(sessionId);
  const toDelete = new Set<string>();

  if (knownImagePath && isPathInsideTrustedCapturePrefix(sessionId, knownImagePath)) {
    toDelete.add(knownImagePath);
  }

  const { data: listed, error: listError } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .list(sessionId, { limit: 50 });

  if (!listError && listed) {
    for (const entry of listed) {
      if (!entry.name || entry.name.endsWith("/")) continue;
      const full = `${prefix}${entry.name}`;
      if (isPathInsideTrustedCapturePrefix(sessionId, full)) {
        toDelete.add(full);
      }
    }
  }

  if (toDelete.size === 0) {
    return { deleted: 0 };
  }

  const paths = [...toDelete];
  const { error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(`Capture object delete failed: ${error.message}`);
  }

  return { deleted: paths.length };
}
