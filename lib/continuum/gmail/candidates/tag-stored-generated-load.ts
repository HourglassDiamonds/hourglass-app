/**
 * Load-time join: stored Gmail candidates × indexed from_email_hash.
 * Does not call the Gmail API. Does not write Candidates.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { generatedOperatingMailHashesFromEnv } from "./generated-source";
import { parseGmailCandidateSourceRef } from "./source-ref";
import { withIndexedGeneratedOperatingMail } from "./tag-stored-generated";

const MESSAGE_ID_CHUNK = 100;

function uniqueMessageIds(candidates: readonly ContinuumCandidate[]): string[] {
  const seen = new Set<string>();
  for (const row of candidates) {
    const parsed = parseGmailCandidateSourceRef(row.sourceRef);
    const messageId = parsed?.messageId.trim() ?? "";
    if (!messageId || seen.has(messageId)) continue;
    seen.add(messageId);
  }
  return [...seen];
}

async function fromEmailHashByMessageId(
  client: SupabaseClient,
  messageIds: readonly string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (let offset = 0; offset < messageIds.length; offset += MESSAGE_ID_CHUNK) {
    const chunk = messageIds.slice(offset, offset + MESSAGE_ID_CHUNK);
    const { data, error } = await client
      .from("continuum_gmail_messages")
      .select("message_id, from_email_hash")
      .in("message_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      const messageId = String(row.message_id ?? "").trim();
      if (!messageId) continue;
      const hash = row.from_email_hash == null ? null : String(row.from_email_hash);
      map.set(messageId, hash);
    }
  }
  return map;
}

export async function tagStoredGeneratedOperatingMailCandidates(
  client: SupabaseClient | null,
  candidates: readonly ContinuumCandidate[],
): Promise<ContinuumCandidate[]> {
  const hashes = generatedOperatingMailHashesFromEnv();
  if (!client || hashes.length === 0 || candidates.length === 0) {
    return [...candidates];
  }
  const messageIds = uniqueMessageIds(candidates);
  if (messageIds.length === 0) return [...candidates];
  try {
    const fromById = await fromEmailHashByMessageId(client, messageIds);
    return withIndexedGeneratedOperatingMail(candidates, fromById, hashes);
  } catch {
    return [...candidates];
  }
}
