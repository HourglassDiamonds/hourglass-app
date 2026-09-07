/**
 * Supabase adapter for Calendar connection custody.
 * Service-role only. Never writes Persons, projects, CoS, Gmail, or event rows.
 * Event evidence is read-through; this table stores encrypted refresh tokens only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { CalendarConnectionStore } from "./connection";
import {
  CALENDAR_FOUNDER_SLOT,
  CALENDAR_TOKEN_ENC_ALG,
  type CalendarConnection,
  type CalendarConnectionStatus,
  type CalendarTokenCiphertext,
} from "./types";

const CONNECTION_COLUMNS =
  "connection_id, calendar_slot, calendar_email_hash, status, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, token_enc_alg, token_enc_version, granted_scope, provider_token_type, connected_at, updated_at, last_read_at, status_error_code";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function isConnectionStatus(value: unknown): value is CalendarConnectionStatus {
  return (
    value === "connected" ||
    value === "paused" ||
    value === "disconnected" ||
    value === "revoked"
  );
}

function rowToCiphertext(row: Record<string, unknown>): CalendarTokenCiphertext | null {
  if (
    row.refresh_token_ciphertext == null ||
    row.refresh_token_iv == null ||
    row.refresh_token_tag == null
  ) {
    return null;
  }
  return {
    alg: CALENDAR_TOKEN_ENC_ALG,
    version: 1,
    iv: String(row.refresh_token_iv),
    tag: String(row.refresh_token_tag),
    ciphertext: String(row.refresh_token_ciphertext),
  };
}

function rowToConnection(row: Record<string, unknown>): CalendarConnection {
  if (!isConnectionStatus(row.status)) {
    throw new Error("calendar-connection-status-invalid");
  }
  if (row.calendar_slot !== CALENDAR_FOUNDER_SLOT) {
    throw new Error("calendar-slot-invalid");
  }
  return {
    connectionId: String(row.connection_id),
    calendarSlot: CALENDAR_FOUNDER_SLOT,
    calendarEmailHash: String(row.calendar_email_hash),
    status: row.status,
    refreshToken: rowToCiphertext(row),
    grantedScope: row.granted_scope == null ? null : String(row.granted_scope),
    providerTokenType:
      row.provider_token_type == null ? null : String(row.provider_token_type),
    connectedAt: row.connected_at == null ? null : String(row.connected_at),
    updatedAt: String(row.updated_at),
    lastReadAt: row.last_read_at == null ? null : String(row.last_read_at),
    statusErrorCode:
      row.status_error_code == null ? null : String(row.status_error_code),
  };
}

function connectionToRow(row: CalendarConnection): Record<string, unknown> {
  return {
    connection_id: row.connectionId,
    calendar_slot: row.calendarSlot,
    calendar_email_hash: row.calendarEmailHash,
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
    last_read_at: row.lastReadAt,
    status_error_code: row.statusErrorCode,
  };
}

export class SupabaseCalendarConnectionStore implements CalendarConnectionStore {
  constructor(private readonly client: SupabaseClient) {}

  async getFounderConnection(): Promise<CalendarConnection | null> {
    const { data, error } = await this.client
      .from("continuum_calendar_connections")
      .select(CONNECTION_COLUMNS)
      .eq("calendar_slot", CALENDAR_FOUNDER_SLOT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToConnection(data);
  }

  async putConnection(row: CalendarConnection): Promise<CalendarConnection> {
    const { data, error } = await this.client
      .from("continuum_calendar_connections")
      .upsert(connectionToRow(row), { onConflict: "calendar_slot" })
      .select(CONNECTION_COLUMNS)
      .single();
    if (error) throw error;
    return rowToConnection(data);
  }
}

export function createSupabaseCalendarConnectionStore(
  client?: SupabaseClient | null,
): SupabaseCalendarConnectionStore {
  return new SupabaseCalendarConnectionStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
