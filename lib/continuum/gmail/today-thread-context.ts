/**
 * Read-only Today Gmail identity context.
 * Joins indexed subjects, labels, hashes, and optional live From metadata
 * without writing Person/Project state. Recovers thread chronology from
 * exact persisted thread ids, then exact message ids. Does not mint, merge, or link.
 */

import "server-only";

import {
  candidateProjectId,
  isFounderIdentityName,
  sourceThreadId,
  type TodayGmailIndexedMessage,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { collectExactGmailIds } from "@/lib/continuum/candidates/exact-gmail-ids";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  getContinuumGmailFounderEmail,
  getContinuumGmailInternalAddresses,
} from "./env";
import { parseGmailFromHeader } from "./payload";
import { executeLiveSourceViewerFetch } from "./source-viewer-run";

const THREAD_QUERY_CHUNK = 40;
const MESSAGES_PER_THREAD = 80;
const INDEX_SELECT =
  "thread_id, message_id, sent_at, direction, subject, label_ids, from_email_hash";

function indexedDirection(
  value: unknown,
  fromEmailHash?: string | null,
  founderHashes?: ReadonlySet<string>,
): TodayGmailIndexedMessage["direction"] {
  if (value === "outbound") return "outbound";
  if (value === "inbound") return "inbound";
  const hash = fromEmailHash?.trim().toLowerCase() ?? "";
  if (hash && founderHashes?.has(hash)) return "outbound";
  if (hash) return "inbound";
  return "unknown";
}

function founderEmailHashes(): Set<string> {
  const hashes = new Set<string>();
  for (const email of internalEmails()) {
    const hash = hashEmail(email)?.trim().toLowerCase() ?? "";
    if (hash) hashes.add(hash);
  }
  return hashes;
}

function asLabelIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const labels = value
    .map((row) => String(row ?? "").trim())
    .filter(Boolean);
  return labels.length > 0 ? labels : undefined;
}

function internalEmails(): string[] {
  const founder = getContinuumGmailFounderEmail();
  return [...getContinuumGmailInternalAddresses(), ...(founder ? [founder] : [])];
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function isStudioMailbox(email: string): boolean {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return (
    domain === "hourglassdiamonds.com" || domain.endsWith(".hourglassdiamonds.com")
  );
}

function isInternalAddress(
  displayName: string | null,
  email: string | null,
): boolean {
  if (isFounderIdentityName(displayName)) return true;
  if (!email) return false;
  if (isStudioMailbox(email)) return true;
  const key = normalizeAddress(email);
  return internalEmails().some((row) => normalizeAddress(row) === key);
}

export function ungroupedGmailThreadIds(
  candidates: readonly ContinuumCandidate[],
): string[] {
  return [
    ...new Set(
      candidates
        .filter((row) => !candidateProjectId(row))
        .map((row) => sourceThreadId(row))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

export function mergeTodayThreadContext(
  base: ReadonlyMap<string, TodayGmailThreadContext>,
  extra: ReadonlyMap<string, TodayGmailThreadContext>,
): Map<string, TodayGmailThreadContext> {
  const merged = new Map(base);
  for (const [threadId, next] of extra) {
    const prior = merged.get(threadId) ?? {};
    merged.set(threadId, {
      subject: next.subject ?? prior.subject ?? null,
      fromDisplayName: next.fromDisplayName ?? prior.fromDisplayName ?? null,
      fromEmail: next.fromEmail ?? prior.fromEmail ?? null,
      liveIdentityLoaded:
        next.liveIdentityLoaded === true || prior.liveIdentityLoaded === true,
      messages:
        next.messages && next.messages.length > 0
          ? next.messages
          : prior.messages,
      attachmentFilenames: [
        ...new Set([
          ...(prior.attachmentFilenames ?? []),
          ...(next.attachmentFilenames ?? []),
        ]),
      ],
    });
  }
  return merged;
}

function ingestIndexedRows(
  out: Map<string, TodayGmailThreadContext>,
  data: readonly Record<string, unknown>[],
  founderHashes?: ReadonlySet<string>,
): string[] {
  const threadIds: string[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const threadId = String(row.thread_id ?? "").trim();
    if (!threadId) continue;
    if (!seen.has(threadId)) {
      seen.add(threadId);
      threadIds.push(threadId);
    }
    const existing = out.get(threadId) ?? {};
    const messages = [...(existing.messages ?? [])];
    if (messages.length < MESSAGES_PER_THREAD) {
      const messageId = String(row.message_id ?? "").trim();
      const sentAt = String(row.sent_at ?? "").trim();
      if (messageId && sentAt && !messages.some((item) => item.messageId === messageId)) {
        const fromEmailHash =
          row.from_email_hash == null ? null : String(row.from_email_hash);
        messages.push({
          messageId,
          sentAt,
          direction: indexedDirection(row.direction, fromEmailHash, founderHashes),
          labelIds: asLabelIds(row.label_ids),
          fromEmailHash,
        });
      }
    }
    out.set(threadId, {
      subject:
        existing.subject ??
        (row.subject == null ? null : String(row.subject)),
      fromDisplayName: existing.fromDisplayName ?? null,
      fromEmail: existing.fromEmail ?? null,
      liveIdentityLoaded: existing.liveIdentityLoaded,
      messages,
      attachmentFilenames: existing.attachmentFilenames,
    });
  }
  return threadIds;
}

export async function loadIndexedTodayThreadContext(
  candidates: readonly ContinuumCandidate[],
): Promise<Map<string, TodayGmailThreadContext>> {
  const ids = collectExactGmailIds(candidates);
  const out = new Map<string, TodayGmailThreadContext>();
  if (ids.threadIds.length === 0 && ids.messageIds.length === 0) return out;
  const client = getSupabaseAdmin();
  if (!client) return out;

  const founderHashes = founderEmailHashes();
  const loadThreads = async (threadIds: readonly string[]) => {
    for (let index = 0; index < threadIds.length; index += THREAD_QUERY_CHUNK) {
      const chunk = threadIds.slice(index, index + THREAD_QUERY_CHUNK);
      const { data, error } = await client
        .from("continuum_gmail_messages")
        .select(INDEX_SELECT)
        .in("thread_id", chunk)
        .order("sent_at", { ascending: false });
      if (error || !data) continue;
      ingestIndexedRows(out, data as Record<string, unknown>[], founderHashes);
    }
  };

  await loadThreads(ids.threadIds);

  const seenMessageIds = new Set(
    [...out.values()].flatMap((thread) =>
      (thread.messages ?? []).map((row) => row.messageId),
    ),
  );
  const orphanMessageIds = ids.messageIds.filter((id) => !seenMessageIds.has(id));
  const recoveredThreadIds: string[] = [];
  const seenRecovered = new Set(out.keys());
  for (let index = 0; index < orphanMessageIds.length; index += THREAD_QUERY_CHUNK) {
    const chunk = orphanMessageIds.slice(index, index + THREAD_QUERY_CHUNK);
    const { data, error } = await client
      .from("continuum_gmail_messages")
      .select(INDEX_SELECT)
      .in("message_id", chunk);
    if (error || !data) continue;
    for (const threadId of ingestIndexedRows(
      out,
      data as Record<string, unknown>[],
      founderHashes,
    )) {
      if (seenRecovered.has(threadId)) continue;
      seenRecovered.add(threadId);
      recoveredThreadIds.push(threadId);
    }
  }
  if (recoveredThreadIds.length > 0) {
    await loadThreads(recoveredThreadIds);
  }
  await loadIndexedAttachmentFilenames(client, out);
  return out;
}

async function loadIndexedAttachmentFilenames(
  client: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  out: Map<string, TodayGmailThreadContext>,
): Promise<void> {
  const threadIds = [...out.keys()];
  if (threadIds.length === 0) return;
  for (let index = 0; index < threadIds.length; index += THREAD_QUERY_CHUNK) {
    const chunk = threadIds.slice(index, index + THREAD_QUERY_CHUNK);
    const { data, error } = await client
      .from("continuum_gmail_attachments")
      .select("thread_id, filename")
      .in("thread_id", chunk);
    if (error || !data) continue;
    const byThread = new Map<string, string[]>();
    for (const row of data as Record<string, unknown>[]) {
      const threadId = String(row.thread_id ?? "").trim();
      const filename = String(row.filename ?? "").trim();
      if (!threadId || !filename) continue;
      const list = byThread.get(threadId) ?? [];
      if (!list.includes(filename)) list.push(filename);
      byThread.set(threadId, list);
    }
    for (const [threadId, filenames] of byThread) {
      const existing = out.get(threadId);
      if (!existing) continue;
      out.set(threadId, {
        ...existing,
        attachmentFilenames: [
          ...new Set([...(existing.attachmentFilenames ?? []), ...filenames]),
        ],
      });
    }
  }
}

export async function loadLiveExternalThreadIdentity(
  threadId: string,
): Promise<TodayGmailThreadContext | null> {
  const id = threadId.trim();
  if (!id) return null;
  const fetched = await executeLiveSourceViewerFetch({
    founderSessionOk: true,
    threadId: id,
  });
  if (!fetched.ok) return null;
  let fromDisplayName: string | null = null;
  let fromEmail: string | null = null;
  for (const message of [...fetched.messages].reverse()) {
    const parsed = parseGmailFromHeader(message.fromRaw ?? null);
    const display = parsed.displayName?.trim() || null;
    const email = (parsed.email ?? message.fromEmail)?.trim() || null;
    if (isInternalAddress(display, email)) continue;
    if (!display && !email) continue;
    fromDisplayName = display;
    fromEmail = email;
    break;
  }
  return {
    subject: fetched.indexedSubject,
    fromDisplayName,
    fromEmail,
    liveIdentityLoaded: true,
  };
}
