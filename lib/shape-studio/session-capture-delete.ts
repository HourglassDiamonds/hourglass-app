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

/** Folder of immutable meta revisions — unique keys bypass Storage CDN staleness. */
export function sessionMetaRevisionPrefix(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }
  return `sessions/${sessionId}`;
}

/**
 * Lexicographically sortable revision id: zero-padded ms + zero-padded tie-break.
 * Newer writes always sort after older writes under string compare.
 */
export function buildSessionMetaRevisionId(
  nowMs: number = Date.now(),
  tieBreak: number = Math.floor(Math.random() * 1_000_000),
): string {
  const ms = Math.max(0, Math.floor(nowMs));
  const tie = Math.max(0, Math.min(999_999, Math.floor(tieBreak)));
  return `${String(ms).padStart(15, "0")}-${String(tie).padStart(6, "0")}`;
}

export function isSessionMetaRevisionId(revisionId: string): boolean {
  return (
    /^\d{13,}-\d+$/.test(revisionId) ||
    /^\d{15}-\d{6}$/.test(revisionId) ||
    /^\d{13,}$/.test(revisionId)
  );
}

export function sessionMetaRevisionObjectPath(
  sessionId: string,
  revisionId: string,
): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }
  if (!isSessionMetaRevisionId(revisionId)) {
    throw new Error("Invalid session meta revision");
  }
  return `sessions/${sessionId}/${revisionId}.json`;
}

/** Pick the newest revision filename (with or without .json). */
export function selectNewestSessionMetaRevisionName(
  names: readonly string[],
): string | null {
  const normalized = names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => (name.endsWith(".json") ? name : `${name}.json`))
    .filter((name) => {
      const id = name.replace(/\.json$/, "");
      return isSessionMetaRevisionId(id);
    });
  if (normalized.length === 0) return null;

  const rank = (name: string): { ms: number; tie: number } => {
    const id = name.replace(/\.json$/, "");
    const [msPart, tiePart] = id.split("-");
    return {
      ms: Number(msPart),
      tie: tiePart != null && tiePart !== "" ? Number(tiePart) : 0,
    };
  };

  return (
    normalized.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (rb.ms !== ra.ms) return rb.ms - ra.ms;
      if (rb.tie !== ra.tie) return rb.tie - ra.tie;
      return b.localeCompare(a);
    })[0] ?? null
  );
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

/**
 * Delete legacy flat meta + every immutable revision for a session.
 * Tolerates missing objects. Does not delete capture images under `{sessionId}/`.
 */
export async function deleteShapeStudioSessionMetaObjects(
  sessionId: string,
): Promise<{ deleted: number }> {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const toDelete = new Set<string>([sessionMetaObjectPath(sessionId)]);
  const prefix = sessionMetaRevisionPrefix(sessionId);

  const { data: listed, error: listError } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .list(prefix, { limit: 100 });

  if (!listError && listed) {
    for (const entry of listed) {
      if (!entry.name?.endsWith(".json")) continue;
      const revisionId = entry.name.replace(/\.json$/, "");
      if (!isSessionMetaRevisionId(revisionId)) continue;
      toDelete.add(sessionMetaRevisionObjectPath(sessionId, revisionId));
    }
  }

  const paths = [...toDelete];
  const { error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(`Session meta delete failed: ${error.message}`);
  }

  return { deleted: paths.length };
}

/**
 * Keep only the newest revision object; remove older immutable revisions.
 * Leaves the legacy flat `sessions/{id}.json` path untouched.
 */
export async function pruneOlderSessionMetaRevisions(
  sessionId: string,
  keepRevisionId: string,
): Promise<{ deleted: number }> {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session ID");
  }
  if (!isSessionMetaRevisionId(keepRevisionId)) {
    throw new Error("Invalid session meta revision");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const keepName = `${keepRevisionId}.json`;
  const prefix = sessionMetaRevisionPrefix(sessionId);
  const { data: listed, error: listError } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .list(prefix, { limit: 100 });

  if (listError || !listed) {
    return { deleted: 0 };
  }

  const toDelete: string[] = [];
  for (const entry of listed) {
    if (!entry.name?.endsWith(".json")) continue;
    if (entry.name === keepName) continue;
    const revisionId = entry.name.replace(/\.json$/, "");
    if (!isSessionMetaRevisionId(revisionId)) continue;
    toDelete.push(sessionMetaRevisionObjectPath(sessionId, revisionId));
  }

  if (toDelete.length === 0) return { deleted: 0 };

  const { error } = await supabase.storage
    .from(SHAPE_STUDIO_CAPTURES_BUCKET)
    .remove(toDelete);

  if (error) {
    throw new Error(`Session meta prune failed: ${error.message}`);
  }

  return { deleted: toDelete.length };
}
