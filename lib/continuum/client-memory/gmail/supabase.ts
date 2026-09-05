/**
 * Supabase protected Gmail source-index adapter.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Service-role only. Never writes Persons, facts, notes, wishes, projects,
 * or kernel Event/Evidence/Observation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  assertGmailCheckpoint,
  buildGmailIndexedMessage,
  isGmailMessageDirection,
  mergeIndexedGmailMessage,
} from "./record";
import type { GmailIndexStore } from "./store";
import {
  GMAIL_SOURCE_SYSTEM,
  GMAIL_SYNC_ALREADY_RUNNING,
  type GmailCheckpoint,
  type GmailCheckpointJobKey,
  type GmailIndexInput,
  type GmailIndexedMessage,
  type GmailMessageDirection,
  type IndexGmailMessageResult,
} from "./types";

const MESSAGE_COLUMNS =
  "message_id, thread_id, sent_at, indexed_at, subject, from_email_hash, to_email_hashes, cc_email_hashes, bcc_email_hashes, direction, label_ids, has_attachments, source_system";

const CHECKPOINT_COLUMNS =
  "job_key, status, window_start, window_end, page_token, history_id, cursor_message_id, indexed_count, updated_at, error_code";

const UNIQUE_VIOLATION = "23505";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function rowToMessage(row: Record<string, unknown>): GmailIndexedMessage {
  if (!isGmailMessageDirection(row.direction)) {
    throw new Error("gmail-direction-invalid");
  }
  if (row.source_system !== GMAIL_SOURCE_SYSTEM) {
    throw new Error("gmail-source-system-invalid");
  }
  return {
    messageId: String(row.message_id),
    threadId: String(row.thread_id),
    sentAt: String(row.sent_at),
    indexedAt: String(row.indexed_at),
    subject: row.subject == null ? null : String(row.subject),
    fromEmailHash: row.from_email_hash == null ? null : String(row.from_email_hash),
    toEmailHashes: asStringArray(row.to_email_hashes),
    ccEmailHashes: asStringArray(row.cc_email_hashes),
    bccEmailHashes: asStringArray(row.bcc_email_hashes),
    direction: row.direction,
    labelIds: asStringArray(row.label_ids),
    hasAttachments: Boolean(row.has_attachments),
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function messageToRow(message: GmailIndexedMessage): Record<string, unknown> {
  return {
    message_id: message.messageId,
    thread_id: message.threadId,
    sent_at: message.sentAt,
    indexed_at: message.indexedAt,
    subject: message.subject,
    from_email_hash: message.fromEmailHash,
    to_email_hashes: [...message.toEmailHashes],
    cc_email_hashes: [...message.ccEmailHashes],
    bcc_email_hashes: [...message.bccEmailHashes],
    direction: message.direction,
    label_ids: [...message.labelIds],
    has_attachments: message.hasAttachments,
    source_system: GMAIL_SOURCE_SYSTEM,
  };
}

function rowToCheckpoint(row: Record<string, unknown>): GmailCheckpoint {
  return {
    jobKey: row.job_key as GmailCheckpointJobKey,
    status: row.status as GmailCheckpoint["status"],
    windowStart: row.window_start == null ? null : String(row.window_start),
    windowEnd: row.window_end == null ? null : String(row.window_end),
    pageToken: row.page_token == null ? null : String(row.page_token),
    historyId: row.history_id == null ? null : String(row.history_id),
    cursorMessageId:
      row.cursor_message_id == null ? null : String(row.cursor_message_id),
    indexedCount: Number(row.indexed_count),
    updatedAt: String(row.updated_at),
    errorCode: row.error_code == null ? null : String(row.error_code),
  };
}

function checkpointToRow(row: GmailCheckpoint): Record<string, unknown> {
  return {
    job_key: row.jobKey,
    status: row.status,
    window_start: row.windowStart,
    window_end: row.windowEnd,
    page_token: row.pageToken,
    history_id: row.historyId,
    cursor_message_id: row.cursorMessageId,
    indexed_count: row.indexedCount,
    updated_at: row.updatedAt,
    error_code: row.errorCode,
  };
}

export class SupabaseGmailIndexStore implements GmailIndexStore {
  constructor(private readonly client: SupabaseClient) {}

  async indexMessage(
    input: GmailIndexInput,
    indexedAt: string,
  ): Promise<IndexGmailMessageResult> {
    const incoming = buildGmailIndexedMessage(input, indexedAt);
    const existing = await this.getMessage(incoming.messageId);
    if (!existing) {
      const { data, error } = await this.client
        .from("continuum_gmail_messages")
        .insert(messageToRow(incoming))
        .select(MESSAGE_COLUMNS)
        .single();
      if (error) {
        if (isUniqueViolation(error)) {
          const raced = await this.getMessage(incoming.messageId);
          if (!raced) throw error;
          return this.persistMerge(raced, incoming);
        }
        throw error;
      }
      return { status: "inserted", record: rowToMessage(data) };
    }

    return this.persistMerge(existing, incoming);
  }

  private async persistMerge(
    existing: GmailIndexedMessage,
    incoming: GmailIndexedMessage,
  ): Promise<IndexGmailMessageResult> {
    const merged = mergeIndexedGmailMessage(existing, incoming);
    if (merged.status !== "updated") return merged;

    const { data, error } = await this.client
      .from("continuum_gmail_messages")
      .update({
        subject: merged.record.subject,
        from_email_hash: merged.record.fromEmailHash,
        to_email_hashes: [...merged.record.toEmailHashes],
        cc_email_hashes: [...merged.record.ccEmailHashes],
        bcc_email_hashes: [...merged.record.bccEmailHashes],
        direction: merged.record.direction,
        label_ids: [...merged.record.labelIds],
        has_attachments: merged.record.hasAttachments,
      })
      .eq("message_id", merged.record.messageId)
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) throw error;
    return { status: "updated", record: rowToMessage(data) };
  }

  async getMessage(messageId: string): Promise<GmailIndexedMessage | null> {
    const { data, error } = await this.client
      .from("continuum_gmail_messages")
      .select(MESSAGE_COLUMNS)
      .eq("message_id", messageId.trim())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToMessage(data);
  }

  async deleteMessage(
    messageId: string,
  ): Promise<"deleted" | "already-absent"> {
    const { data, error } = await this.client
      .from("continuum_gmail_messages")
      .delete()
      .eq("message_id", messageId.trim())
      .select("message_id")
      .maybeSingle();
    if (error) throw error;
    return data ? "deleted" : "already-absent";
  }

  async listMessagesByThread(threadId: string): Promise<GmailIndexedMessage[]> {
    const { data, error } = await this.client
      .from("continuum_gmail_messages")
      .select(MESSAGE_COLUMNS)
      .eq("thread_id", threadId.trim())
      .order("sent_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => rowToMessage(row));
  }

  async listMessagesMatchingSubjectTokens(
    tokens: readonly string[],
  ): Promise<GmailIndexedMessage[]> {
    const needles = [
      ...new Set(tokens.map((token) => token.trim()).filter((token) => token.length >= 2)),
    ].slice(0, 24);
    if (needles.length === 0) return [];
    const byId = new Map<string, GmailIndexedMessage>();
    for (const token of needles) {
      const rows = await this.listSubjectIlikePages(escapeIlike(token));
      for (const row of rows) byId.set(row.messageId, row);
    }
    return [...byId.values()];
  }

  async listMessagesTouchingEmailHash(
    emailHash: string,
  ): Promise<GmailIndexedMessage[]> {
    const hash = emailHash.trim();
    if (!hash) return [];
    const byId = new Map<string, GmailIndexedMessage>();
    for (const column of [
      "from_email_hash",
      "to_email_hashes",
      "cc_email_hashes",
      "bcc_email_hashes",
    ] as const) {
      const rows =
        column === "from_email_hash"
          ? await this.listColumnEqPages(column, hash)
          : await this.listArrayContainsPages(column, hash);
      for (const row of rows) byId.set(row.messageId, row);
    }
    return [...byId.values()];
  }

  async listLatestByDirection(
    direction: GmailMessageDirection,
    limit: number,
  ): Promise<GmailIndexedMessage[]> {
    const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 0;
    if (cap === 0) return [];
    const { data, error } = await this.client
      .from("continuum_gmail_messages")
      .select(MESSAGE_COLUMNS)
      .eq("direction", direction)
      .order("sent_at", { ascending: false })
      .limit(cap);
    if (error) throw error;
    return (data ?? []).map((row) => rowToMessage(row));
  }

  private async listSubjectIlikePages(escapedToken: string): Promise<GmailIndexedMessage[]> {
    return this.pageMessages((from, to) =>
      this.client
        .from("continuum_gmail_messages")
        .select(MESSAGE_COLUMNS)
        .ilike("subject", `%${escapedToken}%`)
        .order("sent_at", { ascending: true })
        .range(from, to),
    );
  }

  private async listColumnEqPages(
    column: "from_email_hash",
    value: string,
  ): Promise<GmailIndexedMessage[]> {
    return this.pageMessages((from, to) =>
      this.client
        .from("continuum_gmail_messages")
        .select(MESSAGE_COLUMNS)
        .eq(column, value)
        .order("sent_at", { ascending: true })
        .range(from, to),
    );
  }

  private async listArrayContainsPages(
    column: "to_email_hashes" | "cc_email_hashes" | "bcc_email_hashes",
    value: string,
  ): Promise<GmailIndexedMessage[]> {
    return this.pageMessages((from, to) =>
      this.client
        .from("continuum_gmail_messages")
        .select(MESSAGE_COLUMNS)
        .contains(column, [value])
        .order("sent_at", { ascending: true })
        .range(from, to),
    );
  }

  private async pageMessages(
    query: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>,
  ): Promise<GmailIndexedMessage[]> {
    const rows: GmailIndexedMessage[] = [];
    const page = 1000;
    const cap = 5000;
    for (let offset = 0; offset < cap; offset += page) {
      const { data, error } = await query(offset, offset + page - 1);
      if (error) throw error;
      const chunk = (data ?? []).map((row) => rowToMessage(row));
      rows.push(...chunk);
      if (chunk.length < page) break;
    }
    return rows;
  }

  async getCheckpoint(
    jobKey: GmailCheckpointJobKey,
  ): Promise<GmailCheckpoint | null> {
    const { data, error } = await this.client
      .from("continuum_gmail_checkpoints")
      .select(CHECKPOINT_COLUMNS)
      .eq("job_key", jobKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToCheckpoint(data);
  }

  async putCheckpoint(row: GmailCheckpoint): Promise<GmailCheckpoint> {
    assertGmailCheckpoint(row);
    const { data, error } = await this.client
      .from("continuum_gmail_checkpoints")
      .upsert(checkpointToRow(row), { onConflict: "job_key" })
      .select(CHECKPOINT_COLUMNS)
      .single();
    if (error) throw error;
    return rowToCheckpoint(data);
  }

  async tryClaimHistoricalChunk(nowIso: string, leaseMs: number): Promise<boolean> {
    return this.tryClaimJob("gmail-historical", nowIso, leaseMs);
  }

  async releaseHistoricalChunk(nowIso: string): Promise<void> {
    return this.releaseJob("gmail-historical", nowIso);
  }

  async tryClaimIncrementalChunk(nowIso: string, leaseMs: number): Promise<boolean> {
    return this.tryClaimJob("gmail-memory-daily", nowIso, leaseMs);
  }

  async releaseIncrementalChunk(nowIso: string): Promise<void> {
    return this.releaseJob("gmail-memory-daily", nowIso);
  }

  private async tryClaimJob(
    jobKey: GmailCheckpointJobKey,
    nowIso: string,
    leaseMs: number,
  ): Promise<boolean> {
    const existing = await this.getCheckpoint(jobKey);
    if (!existing) {
      const { error } = await this.client.from("continuum_gmail_checkpoints").insert(
        checkpointToRow({
          jobKey,
          status: "idle",
          windowStart: null,
          windowEnd: null,
          pageToken: null,
          historyId: null,
          cursorMessageId: null,
          indexedCount: 0,
          updatedAt: nowIso,
          errorCode: GMAIL_SYNC_ALREADY_RUNNING,
        }),
      );
      if (isUniqueViolation(error)) return false;
      if (error) throw error;
      return true;
    }
    if (existing.errorCode === GMAIL_SYNC_ALREADY_RUNNING) {
      const age = Date.parse(nowIso) - Date.parse(existing.updatedAt);
      if (Number.isFinite(age) && age >= 0 && age < leaseMs) return false;
    }
    let query = this.client
      .from("continuum_gmail_checkpoints")
      .update({
        error_code: GMAIL_SYNC_ALREADY_RUNNING,
        updated_at: nowIso,
      })
      .eq("job_key", jobKey);
    if (existing.errorCode === GMAIL_SYNC_ALREADY_RUNNING) {
      query = query
        .eq("error_code", GMAIL_SYNC_ALREADY_RUNNING)
        .lt("updated_at", new Date(Date.parse(nowIso) - leaseMs).toISOString());
    } else if (existing.errorCode) {
      query = query.eq("error_code", existing.errorCode);
    } else {
      query = query.is("error_code", null);
    }
    const { data, error } = await query.select("job_key").maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  private async releaseJob(
    jobKey: GmailCheckpointJobKey,
    nowIso: string,
  ): Promise<void> {
    const existing = await this.getCheckpoint(jobKey);
    if (!existing || existing.errorCode !== GMAIL_SYNC_ALREADY_RUNNING) return;
    const { error } = await this.client
      .from("continuum_gmail_checkpoints")
      .update({ error_code: null, updated_at: nowIso })
      .eq("job_key", jobKey)
      .eq("error_code", GMAIL_SYNC_ALREADY_RUNNING);
    if (error) throw error;
  }
}

export function createSupabaseGmailIndexStore(
  client?: SupabaseClient | null,
): SupabaseGmailIndexStore {
  return new SupabaseGmailIndexStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
