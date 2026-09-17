/**
 * Read-only Today Gmail identity context.
 * Joins indexed subjects (and optional live From metadata) without writing
 * Person/Project state. Does not mint, merge, or link.
 */

import "server-only";

import {
  candidateProjectId,
  isFounderIdentityName,
  sourceThreadId,
  type TodayGmailThreadContext,
} from "@/lib/continuum/candidates/founder-attention";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  getContinuumGmailFounderEmail,
  getContinuumGmailInternalAddresses,
} from "./env";
import { parseGmailFromHeader } from "./payload";
import { executeLiveSourceViewerFetch } from "./source-viewer-run";

const THREAD_QUERY_CHUNK = 40;

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
    });
  }
  return merged;
}

export async function loadIndexedTodayThreadContext(
  candidates: readonly ContinuumCandidate[],
): Promise<Map<string, TodayGmailThreadContext>> {
  const threadIds = ungroupedGmailThreadIds(candidates);
  const out = new Map<string, TodayGmailThreadContext>();
  if (threadIds.length === 0) return out;
  const client = getSupabaseAdmin();
  if (!client) return out;
  for (let index = 0; index < threadIds.length; index += THREAD_QUERY_CHUNK) {
    const chunk = threadIds.slice(index, index + THREAD_QUERY_CHUNK);
    const { data, error } = await client
      .from("continuum_gmail_messages")
      .select("thread_id, sent_at, subject")
      .in("thread_id", chunk)
      .order("sent_at", { ascending: false });
    if (error || !data) continue;
    for (const row of data) {
      const threadId = String(row.thread_id ?? "").trim();
      if (!threadId || out.has(threadId)) continue;
      out.set(threadId, {
        subject: row.subject == null ? null : String(row.subject),
      });
    }
  }
  return out;
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
  };
}
