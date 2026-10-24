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
import { collectPagedRows } from "@/lib/continuum/candidates/page";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  getContinuumGmailFounderEmail,
  getContinuumGmailInternalAddresses,
} from "./env";
import { parseGmailFromHeader } from "./payload";
import {
  createLiveSourceViewerBatch,
  executeLiveSourceViewerFetch,
  type LiveSourceViewerBatch,
} from "./source-viewer-run";
import { extractCurrentMessageOperationalFacts } from "@/lib/continuum/source-events/operational-facts";
import { classifyLiveMessageExtraction } from "./live-extraction-diagnostics";

const THREAD_QUERY_CHUNK = 40;
const MESSAGES_PER_THREAD = 80;
const LIVE_FACT_CONCURRENCY = 4;
export const TODAY_LIVE_THREAD_REQUEST_BUDGET = 48;
const INDEX_SELECT =
  "thread_id, message_id, sent_at, direction, subject, label_ids, from_email_hash, to_email_hashes, has_attachments";

export type TodayLiveEnrichmentDiagnostics = {
  requestedThreadCount: number;
  completedThreadCount: number;
  failedThreadCount: number;
  providerRateLimitedThreadCount: number;
  otherProviderErrorThreadCount: number;
  missingIndexedThreadCount: number;
  missingLiveMessageThreadCount: number;
  budgetDeferredThreadCount: number;
  threadFetches: number;
  durationMs: number;
  failuresByCode: Readonly<Record<string, number>>;
  sizeBuckets: Readonly<Record<"small" | "medium" | "large", { completed: number; failed: number }>>;
  attachmentThreads: { completed: number; failed: number };
  nonAttachmentThreads: { completed: number; failed: number };
};

export type TodayLiveThreadOutcome = {
  threadId: string;
  status: "complete_live" | "indexed_excerpt_only" | "unavailable";
  indexedMessageCount: number;
  liveMessageCount: number;
  safeErrorCategory: string | null;
  latestIndexedMessageAt?: string | null;
  latestLiveMessageAt?: string | null;
  verifiedAt?: string | null;
};

function latestTimestamp(values: readonly (string | null | undefined)[]): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

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

function asEmailHashes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const hashes = value
    .map((row) => String(row ?? "").trim().toLowerCase())
    .filter((row) => /^[a-f0-9]{64}$/.test(row));
  return hashes.length > 0 ? [...new Set(hashes)] : undefined;
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
      liveEnrichmentAttempted:
        next.liveEnrichmentAttempted === true ||
        prior.liveEnrichmentAttempted === true,
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
          toEmailHashes: asEmailHashes(row.to_email_hashes),
          subject: row.subject == null ? null : String(row.subject),
          hasAttachments: Boolean(row.has_attachments),
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
      liveEnrichmentAttempted: existing.liveEnrichmentAttempted,
      messages,
      attachmentFilenames: existing.attachmentFilenames,
    });
  }
  return threadIds;
}

export async function loadIndexedTodayThreadContext(
  candidates: readonly ContinuumCandidate[],
  options: {
    client?: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  } = {},
): Promise<Map<string, TodayGmailThreadContext>> {
  const ids = collectExactGmailIds(candidates);
  const out = new Map<string, TodayGmailThreadContext>();
  if (ids.threadIds.length === 0 && ids.messageIds.length === 0) return out;
  const client = options.client ?? getSupabaseAdmin();
  if (!client) return out;

  const founderHashes = founderEmailHashes();
  const loadThreads = async (threadIds: readonly string[]) => {
    for (let index = 0; index < threadIds.length; index += THREAD_QUERY_CHUNK) {
      const chunk = threadIds.slice(index, index + THREAD_QUERY_CHUNK);
      try {
        const data = await collectPagedRows(async (from, to) => {
          const { data: page, error } = await client
            .from("continuum_gmail_messages")
            .select(INDEX_SELECT)
            .in("thread_id", chunk)
            .order("sent_at", { ascending: false })
            .order("message_id", { ascending: true })
            .range(from, to);
          if (error) throw new Error(error.message);
          return (page ?? []) as Record<string, unknown>[];
        });
        ingestIndexedRows(out, data, founderHashes);
      } catch {
        continue;
      }
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
      .in("message_id", chunk)
      .order("message_id", { ascending: true })
      .order("thread_id", { ascending: true });
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

/**
 * Finds already-indexed chronology for an exact, server-resolved identity hash.
 * This is not name matching and it does not list or retrieve live mailbox data.
 */
export async function loadIndexedTodayThreadContextByEmailHashes(
  emailHashes: readonly string[],
  options: { client?: NonNullable<ReturnType<typeof getSupabaseAdmin>>; sinceIso?: string } = {},
): Promise<Map<string, TodayGmailThreadContext>> {
  const hashes = [...new Set(emailHashes.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
  const out = new Map<string, TodayGmailThreadContext>();
  if (hashes.length === 0) return out;
  const client = options.client ?? getSupabaseAdmin();
  if (!client) return out;
  const founderHashes = founderEmailHashes();
  const rows: Record<string, unknown>[] = [];
  for (let index = 0; index < hashes.length; index += THREAD_QUERY_CHUNK) {
    const chunk = hashes.slice(index, index + THREAD_QUERY_CHUNK);
    for (const query of [
      () => {
        const query = client.from("continuum_gmail_messages").select(INDEX_SELECT).in("from_email_hash", chunk);
        return options.sinceIso ? query.gte("sent_at", options.sinceIso) : query;
      },
      () => {
        const query = client.from("continuum_gmail_messages").select(INDEX_SELECT).overlaps("to_email_hashes", chunk);
        return options.sinceIso ? query.gte("sent_at", options.sinceIso) : query;
      },
    ]) {
      try {
        const { data, error } = await query();
        if (!error) rows.push(...((data ?? []) as Record<string, unknown>[]));
      } catch {
        // A failed identity-side lookup supplies no evidence and never broadens scope.
      }
    }
  }
  const threadIds = ingestIndexedRows(out, rows.sort((a, b) =>
    String(b.sent_at ?? "").localeCompare(String(a.sent_at ?? "")) ||
    String(a.message_id ?? "").localeCompare(String(b.message_id ?? ""))), founderHashes);
  if (threadIds.length > 0) {
    for (let index = 0; index < threadIds.length; index += THREAD_QUERY_CHUNK) {
      const chunk = threadIds.slice(index, index + THREAD_QUERY_CHUNK);
      try {
        const data = await collectPagedRows(async (from, to) => {
          const { data: page, error } = await client.from("continuum_gmail_messages").select(INDEX_SELECT)
            .in("thread_id", chunk).order("sent_at", { ascending: false }).order("message_id", { ascending: true })
            .range(from, to);
          if (error) throw new Error(error.message);
          return (page ?? []) as Record<string, unknown>[];
        });
        ingestIndexedRows(out, data, founderHashes);
      } catch {
        continue;
      }
    }
    await loadIndexedAttachmentFilenames(client, out);
  }
  return out;
}

async function loadIndexedAttachmentFilenames(
  client: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  out: Map<string, TodayGmailThreadContext>,
): Promise<void> {
  const threadIds = [...out.keys()].sort();
  if (threadIds.length === 0) return;
  for (let index = 0; index < threadIds.length; index += THREAD_QUERY_CHUNK) {
    const chunk = threadIds.slice(index, index + THREAD_QUERY_CHUNK);
    let data: Record<string, unknown>[];
    try {
      data = await collectPagedRows(async (from, to) => {
        const { data: page, error } = await client
          .from("continuum_gmail_attachments")
          .select("thread_id, message_id, filename")
          .in("thread_id", chunk)
          .order("thread_id", { ascending: true })
          .order("message_id", { ascending: true })
          .order("filename", { ascending: true })
          .range(from, to);
        if (error) throw new Error(error.message);
        return (page ?? []) as Record<string, unknown>[];
      });
    } catch {
      continue;
    }
    const byThread = new Map<string, string[]>();
    const byMessage = new Map<string, string[]>();
    for (const row of data) {
      const threadId = String(row.thread_id ?? "").trim();
      const messageId = String(row.message_id ?? "").trim();
      const filename = String(row.filename ?? "").trim();
      if (!threadId || !filename) continue;
      const list = byThread.get(threadId) ?? [];
      if (!list.includes(filename)) list.push(filename);
      byThread.set(threadId, list);
      if (messageId) {
        const messageList = byMessage.get(`${threadId}|${messageId}`) ?? [];
        if (!messageList.includes(filename)) messageList.push(filename);
        byMessage.set(`${threadId}|${messageId}`, messageList);
      }
    }
    for (const [threadId, filenames] of byThread) {
      const existing = out.get(threadId);
      if (!existing) continue;
      const messages = (existing.messages ?? []).map((message) => {
        const extra = byMessage.get(`${threadId}|${message.messageId}`) ?? [];
        if (extra.length === 0) return message;
        return {
          ...message,
          hasAttachments: true,
          attachmentFilenames: [...new Set([...(message.attachmentFilenames ?? []), ...extra])],
        };
      });
      out.set(threadId, {
        ...existing,
        messages,
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

/**
 * Reads exact already-indexed threads and retains only quote-stripped operational
 * excerpts on the ephemeral Today model. Full Gmail bodies are never persisted
 * or copied into the thread context.
 */
export async function loadLiveTodayOperationalFacts(
  base: ReadonlyMap<string, TodayGmailThreadContext>,
  options: {
    createBatch?: () => Promise<LiveSourceViewerBatch | null>;
    requireComplete?: boolean;
    threadIds?: readonly string[];
    onDiagnostics?: (diagnostics: TodayLiveEnrichmentDiagnostics) => void;
    onThreadOutcome?: (outcome: TodayLiveThreadOutcome) => void;
    maxThreadFetches?: number;
    preserveThreadOrder?: boolean;
  } = {},
): Promise<Map<string, TodayGmailThreadContext>> {
  const out = new Map(base);
  const uniqueThreadIds = [
    ...new Set((options.threadIds ?? [...base.keys()]).map((threadId) => threadId.trim()).filter(Boolean)),
  ];
  const threadIds = options.preserveThreadOrder ? uniqueThreadIds : uniqueThreadIds.sort();
  const startedAt = Date.now();
  const failuresByCode: Record<string, number> = {};
  const sizeBuckets = {
    small: { completed: 0, failed: 0 },
    medium: { completed: 0, failed: 0 },
    large: { completed: 0, failed: 0 },
  };
  const attachmentThreads = { completed: 0, failed: 0 };
  const nonAttachmentThreads = { completed: 0, failed: 0 };
  let completedThreadCount = 0;
  let failedThreadCount = 0;
  let missingIndexedThreadCount = 0;
  let missingLiveMessageThreadCount = 0;
  let budgetDeferredThreadCount = 0;
  const recordOutcome = (
    current: TodayGmailThreadContext | undefined,
    completed: boolean,
    failureCode?: string,
  ) => {
    const size = current?.messages?.length ?? 0;
    const bucket = size <= 5 ? "small" : size <= 20 ? "medium" : "large";
    sizeBuckets[bucket][completed ? "completed" : "failed"] += 1;
    const attachmentBucket = current?.messages?.some((message) => message.hasAttachments === true)
      ? attachmentThreads
      : nonAttachmentThreads;
    attachmentBucket[completed ? "completed" : "failed"] += 1;
    if (completed) completedThreadCount += 1;
    else {
      failedThreadCount += 1;
      const code = failureCode ?? "unknown";
      failuresByCode[code] = (failuresByCode[code] ?? 0) + 1;
    }
  };
  const emitDiagnostics = (threadFetches: number) => {
    const providerRateLimitedThreadCount = failuresByCode.rate_limited ?? 0;
    const otherProviderErrorThreadCount = Object.entries(failuresByCode)
      .filter(([code]) => code !== "rate_limited" && code !== "not-requested-budget-exhausted" &&
        code !== "missing-indexed-context")
      .reduce((total, [, count]) => total + count, 0);
    try {
      options.onDiagnostics?.({
        requestedThreadCount: threadIds.length,
        completedThreadCount,
        failedThreadCount,
        providerRateLimitedThreadCount,
        otherProviderErrorThreadCount,
        missingIndexedThreadCount,
        missingLiveMessageThreadCount,
        budgetDeferredThreadCount,
        threadFetches,
        durationMs: Date.now() - startedAt,
        failuresByCode,
        sizeBuckets,
        attachmentThreads,
        nonAttachmentThreads,
      });
    } catch {
      // Aggregate observability must never change publication truth.
    }
  };
  const emitThreadOutcome = (outcome: TodayLiveThreadOutcome) => {
    try {
      options.onThreadOutcome?.(outcome);
    } catch {
      // Evidence-gate observability must never alter Gmail retrieval behavior.
    }
  };
  if (threadIds.length === 0) {
    emitDiagnostics(0);
    return out;
  }
  const budget = Math.max(0, Math.floor(options.maxThreadFetches ?? TODAY_LIVE_THREAD_REQUEST_BUDGET));
  const attemptedThreadIds = threadIds.slice(0, budget);
  for (const threadId of threadIds.slice(budget)) {
    const current = out.get(threadId);
    budgetDeferredThreadCount += 1;
    recordOutcome(current, false, "not-requested-budget-exhausted");
    emitThreadOutcome({
      threadId,
      status: "unavailable",
      indexedMessageCount: current?.messages?.length ?? 0,
      liveMessageCount: 0,
      safeErrorCategory: "not-requested-budget-exhausted",
      latestIndexedMessageAt: latestTimestamp(current?.messages?.map((message) => message.sentAt) ?? []),
      latestLiveMessageAt: null,
    });
  }
  const batch = await (options.createBatch ?? createLiveSourceViewerBatch)();
  if (!batch) {
    for (const threadId of attemptedThreadIds) {
      const current = out.get(threadId);
      recordOutcome(current, false, "batch-unavailable");
      emitThreadOutcome({
        threadId,
        status: "unavailable",
        indexedMessageCount: current?.messages?.length ?? 0,
        liveMessageCount: 0,
        safeErrorCategory: "batch-unavailable",
        latestIndexedMessageAt: latestTimestamp(current?.messages?.map((message) => message.sentAt) ?? []),
        latestLiveMessageAt: null,
      });
    }
    emitDiagnostics(0);
    if (options.requireComplete) throw new Error("today-live-enrichment-unavailable");
    return out;
  }
  const extracted = new Map<string, string | null>();
  let cursor = 0;
  let incomplete = false;
  const worker = async () => {
    while (cursor < attemptedThreadIds.length) {
      const threadId = attemptedThreadIds[cursor++]!;
      const current = out.get(threadId);
      if (!current?.messages?.length) {
        incomplete = true;
        missingIndexedThreadCount += 1;
        recordOutcome(current, false, "missing-indexed-context");
        emitThreadOutcome({
          threadId,
          status: "unavailable",
          indexedMessageCount: 0,
          liveMessageCount: 0,
          safeErrorCategory: "missing-indexed-context",
          latestIndexedMessageAt: null,
          latestLiveMessageAt: null,
        });
        continue;
      }
      out.set(threadId, { ...current, liveEnrichmentAttempted: true });
      const fetched = await batch.fetchThread({
        threadId,
        indexed: current.messages.map((message) => ({
          messageId: message.messageId,
          threadId,
          sentAt: message.sentAt,
          subject: message.subject ?? current.subject ?? null,
        })),
      });
      if (!fetched.ok) {
        incomplete = true;
        recordOutcome(current, false, fetched.safeErrorCode);
        emitThreadOutcome({
          threadId,
          status: "unavailable",
          indexedMessageCount: current.messages.length,
          liveMessageCount: 0,
          safeErrorCategory: fetched.safeErrorCode,
          latestIndexedMessageAt: latestTimestamp(current.messages.map((message) => message.sentAt)),
          latestLiveMessageAt: null,
        });
        continue;
      }
      const liveById = new Map(fetched.messages.map((message) => [message.messageId, message]));
      const missingLiveMessage = current.messages.some((message) => !liveById.has(message.messageId));
      if (missingLiveMessage) {
        incomplete = true;
        missingLiveMessageThreadCount += 1;
      }
      const messages = current.messages.map((message) => {
        const live = liveById.get(message.messageId);
        if (!live) return message;
        const extractionKey = `${threadId}|${message.messageId}|${message.sentAt}`;
        let operationalText = extracted.get(extractionKey);
        if (operationalText === undefined) {
          operationalText = extractCurrentMessageOperationalFacts(
            live.plainText ?? live.snippet,
          );
          extracted.set(extractionKey, operationalText);
        }
        const liveAttachmentFilenames = live.attachments
          .map((attachment) => attachment.filename)
          .filter((filename): filename is string => Boolean(filename));
        const attachmentFilenames: string[] = [
          ...new Set([
            ...(message.attachmentFilenames ?? []),
            ...liveAttachmentFilenames,
          ]),
        ];
        return {
          ...message,
          operationalText,
          liveExtractionDiagnostic: classifyLiveMessageExtraction({
            plainText: live.plainText,
            providerSnippet: live.snippet,
            attachmentMetadataPresent: live.attachments.length > 0,
            bodyExtractionStatus: live.bodyExtractionStatus,
          }),
          hasAttachments: message.hasAttachments === true || attachmentFilenames.length > 0,
          attachmentFilenames,
        };
      });
      let fromDisplayName = current.fromDisplayName ?? null;
      let fromEmail = current.fromEmail ?? null;
      for (const live of [...fetched.messages].reverse()) {
        const parsed = parseGmailFromHeader(live.fromRaw ?? null);
        const display = parsed.displayName?.trim() || null;
        const email = (parsed.email ?? live.fromEmail)?.trim() || null;
        if (isInternalAddress(display, email)) continue;
        if (!display && !email) continue;
        fromDisplayName = display;
        fromEmail = email;
        break;
      }
      out.set(threadId, {
        ...current,
        subject: fetched.indexedSubject ?? current.subject ?? null,
        fromDisplayName,
        fromEmail,
        liveIdentityLoaded: true,
        liveEnrichmentAttempted: true,
        messages,
        attachmentFilenames: [
          ...new Set([
            ...(current.attachmentFilenames ?? []),
            ...messages.flatMap((message) => message.attachmentFilenames ?? []),
          ]),
        ],
      });
      recordOutcome(current, !missingLiveMessage, missingLiveMessage ? "missing-live-message" : undefined);
      emitThreadOutcome({
        threadId,
        status: missingLiveMessage ? "indexed_excerpt_only" : "complete_live",
        indexedMessageCount: current.messages.length,
        liveMessageCount: fetched.messages.length,
        safeErrorCategory: missingLiveMessage ? "missing-live-message" : null,
        latestIndexedMessageAt: latestTimestamp(current.messages.map((message) => message.sentAt)),
        latestLiveMessageAt: latestTimestamp(fetched.messages.map((message) => message.sentAt)),
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(LIVE_FACT_CONCURRENCY, attemptedThreadIds.length) }, () => worker()),
  );
  emitDiagnostics(batch.metrics?.threadFetches ?? threadIds.length);
  if (options.requireComplete && incomplete) {
    throw new Error("today-live-enrichment-incomplete");
  }
  return out;
}
