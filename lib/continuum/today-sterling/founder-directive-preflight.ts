import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { createSupabaseClientMemoryNoteWriter } from
  "@/lib/continuum/client-memory/write/supabase";
import { isSterlingOperationalShadowEnabled } from "./server-config";
import { isVerifiedOperationalShadowRuntime } from "./operational-shadow-review";
import { authorizedNovember20FounderDirectives } from
  "./authorized-founder-updates-2026-11-20";
import { loadSterlingFounderDirectives } from "./founder-directive-load";
import { recordSterlingFounderDirective } from "./founder-directive";

export type FounderDirectivePreflightResult =
  | {
      ok: true;
      status: "ready";
      directives: Array<{
        directiveId: string;
        noteId: string;
        writeStatus: "inserted" | "already-present";
        workUnitId: string;
        projectId: string | null;
        personId: string | null;
      }>;
    }
  | { ok: false; reason: string };

async function writeAndReadAuthorizedFounderDirectives(
  client: SupabaseClient,
): Promise<FounderDirectivePreflightResult> {
  const approved = authorizedNovember20FounderDirectives();
  const writer = createSupabaseClientMemoryNoteWriter(client);
  const writes = [];
  for (const directive of approved) {
    const result = await recordSterlingFounderDirective({ writer, directive });
    if (!result.ok) return { ok: false, reason: `founder-directive-write-failed:${result.reason}` };
    writes.push({ directive, noteId: result.noteId, writeStatus: result.status });
  }
  const loaded = await loadSterlingFounderDirectives(client);
  const readable = writes.map(({ directive, noteId, writeStatus }) => {
    const match = loaded.find((row) => row.directiveId === directive.directiveId);
    return match ? {
      directiveId: match.directiveId,
      noteId,
      writeStatus,
      workUnitId: match.workUnitId,
      projectId: match.projectId,
      personId: match.personId,
    } : null;
  });
  if (readable.some((row) => row === null)) {
    return { ok: false, reason: "founder-directive-readback-failed" };
  }
  return { ok: true, status: "ready", directives: readable as NonNullable<(typeof readable)[number]>[] };
}

/** Founder-authenticated gate. It never claims a run lease or touches Gmail/model execution. */
export async function prepareAuthenticatedOperationalShadowFounderDirectives():
  Promise<FounderDirectivePreflightResult> {
  if (!isVerifiedOperationalShadowRuntime() || !isSterlingOperationalShadowEnabled()) {
    return { ok: false, reason: "shadow-runtime-disabled" };
  }
  const auth = await getAuthenticatedGmailHistoryStores();
  if (!auth.ok) return { ok: false, reason: "founder-session-unavailable" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, reason: "database-unavailable" };
  try {
    return await writeAndReadAuthorizedFounderDirectives(client);
  } catch {
    return { ok: false, reason: "founder-directive-preflight-failed" };
  }
}
