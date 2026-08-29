/**
 * Supabase adapters for Gmail connections and attachment metadata.
 * Service-role only. Never writes Persons, projects, CoS, or kernel rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { GmailAttachmentStore } from "./attachments";
import type { GmailConnectionStore } from "./connection";
import {
  GMAIL_FOUNDER_MAILBOX_SLOT,
  GMAIL_TOKEN_ENC_ALG,
  type GmailAttachmentMeta,
  type GmailConnection,
  type GmailConnectionStatus,
  type GmailTokenCiphertext,
} from "./types";

const CONNECTION_COLUMNS =
  "connection_id, mailbox_slot, mailbox_email_hash, status, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, token_enc_alg, token_enc_version, granted_scope, provider_token_type, connected_at, updated_at, last_sync_at, status_error_code";

const ATTACHMENT_COLUMNS =
  "message_id, attachment_id, thread_id, filename, mime_type, size_bytes, indexed_at";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function isConnectionStatus(value: unknown): value is GmailConnectionStatus {
  return (
    value === "connected" ||
    value === "paused" ||
    value === "disconnected" ||
    value === "revoked"
  );
}

function rowToCiphertext(row: Record<string, unknown>): GmailTokenCiphertext | null {
  if (
    row.refresh_token_ciphertext == null ||
    row.refresh_token_iv == null ||
    row.refresh_token_tag == null
  ) {
    return null;
  }
  return {
    alg: GMAIL_TOKEN_ENC_ALG,
    version: 1,
    iv: String(row.refresh_token_iv),
    tag: String(row.refresh_token_tag),
    ciphertext: String(row.refresh_token_ciphertext),
  };
}

function rowToConnection(row: Record<string, unknown>): GmailConnection {
  if (!isConnectionStatus(row.status)) throw new Error("gmail-connection-status-invalid");
  if (row.mailbox_slot !== GMAIL_FOUNDER_MAILBOX_SLOT) {
    throw new Error("gmail-mailbox-slot-invalid");
  }
  return {
    connectionId: String(row.connection_id),
    mailboxSlot: GMAIL_FOUNDER_MAILBOX_SLOT,
    mailboxEmailHash: String(row.mailbox_email_hash),
    status: row.status,
    refreshToken: rowToCiphertext(row),
    grantedScope: row.granted_scope == null ? null : String(row.granted_scope),
    providerTokenType:
      row.provider_token_type == null ? null : String(row.provider_token_type),
    connectedAt: row.connected_at == null ? null : String(row.connected_at),
    updatedAt: String(row.updated_at),
    lastSyncAt: row.last_sync_at == null ? null : String(row.last_sync_at),
    statusErrorCode:
      row.status_error_code == null ? null : String(row.status_error_code),
  };
}

function connectionToRow(row: GmailConnection): Record<string, unknown> {
  return {
    connection_id: row.connectionId,
    mailbox_slot: row.mailboxSlot,
    mailbox_email_hash: row.mailboxEmailHash,
    status: row.status,
    refresh_token_ciphertext: row.refreshToken?.ciphertext ?? null,
    refresh_token_iv: row.refreshToken?.iv ?? null,
    refresh_token_tag: row.refreshToken?.tag ?? null,
    token_enc_alg: row.refreshToken?.alg ?? null,
    token_enc_version: row.refreshToken?.version ?? null,
    granted_scope: row.grantedScope,
    provider_token_type: row.providerTokenType,
    connected_at: row.connectedAt,
    updated_at: row.updatedAt,
    last_sync_at: row.lastSyncAt,
    status_error_code: row.statusErrorCode,
  };
}

function rowToAttachment(row: Record<string, unknown>): GmailAttachmentMeta {
  return {
    messageId: String(row.message_id),
    attachmentId: String(row.attachment_id),
    threadId: String(row.thread_id),
    filename: row.filename == null ? null : String(row.filename),
    mimeType: row.mime_type == null ? null : String(row.mime_type),
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    indexedAt: String(row.indexed_at),
  };
}

function attachmentToRow(row: GmailAttachmentMeta): Record<string, unknown> {
  return {
    message_id: row.messageId,
    attachment_id: row.attachmentId,
    thread_id: row.threadId,
    filename: row.filename,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    indexed_at: row.indexedAt,
  };
}

export class SupabaseGmailConnectionStore implements GmailConnectionStore {
  constructor(private readonly client: SupabaseClient) {}

  async getFounderConnection(): Promise<GmailConnection | null> {
    const { data, error } = await this.client
      .from("continuum_gmail_connections")
      .select(CONNECTION_COLUMNS)
      .eq("mailbox_slot", GMAIL_FOUNDER_MAILBOX_SLOT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToConnection(data);
  }

  async putConnection(row: GmailConnection): Promise<GmailConnection> {
    const { data, error } = await this.client
      .from("continuum_gmail_connections")
      .upsert(connectionToRow(row), { onConflict: "mailbox_slot" })
      .select(CONNECTION_COLUMNS)
      .single();
    if (error) throw error;
    return rowToConnection(data);
  }
}

export class SupabaseGmailAttachmentStore implements GmailAttachmentStore {
  constructor(private readonly client: SupabaseClient) {}

  async putAttachment(row: GmailAttachmentMeta): Promise<GmailAttachmentMeta> {
    const { data, error } = await this.client
      .from("continuum_gmail_attachments")
      .upsert(attachmentToRow(row), {
        onConflict: "message_id,attachment_id",
      })
      .select(ATTACHMENT_COLUMNS)
      .single();
    if (error) throw error;
    return rowToAttachment(data);
  }

  async listByMessage(messageId: string): Promise<GmailAttachmentMeta[]> {
    const { data, error } = await this.client
      .from("continuum_gmail_attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("message_id", messageId.trim())
      .order("indexed_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => rowToAttachment(row));
  }

  async listByThread(threadId: string): Promise<GmailAttachmentMeta[]> {
    const { data, error } = await this.client
      .from("continuum_gmail_attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("thread_id", threadId.trim())
      .order("indexed_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => rowToAttachment(row));
  }
}

export function createSupabaseGmailConnectionStore(
  client?: SupabaseClient | null,
): SupabaseGmailConnectionStore {
  return new SupabaseGmailConnectionStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}

export function createSupabaseGmailAttachmentStore(
  client?: SupabaseClient | null,
): SupabaseGmailAttachmentStore {
  return new SupabaseGmailAttachmentStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
