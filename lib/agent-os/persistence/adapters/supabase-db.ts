/**
 * Injectable database operations for SupabasePersistenceAdapter.
 *
 * Production uses PostgREST via @supabase/supabase-js.
 * Tests inject an in-memory FakeAgentOsClaimDb that mirrors the SQL semantics:
 *
 * Atomic primitives (documented):
 * 1. insertClaim — INSERT; unique PK conflict ⇒ no row (create-if-absent)
 * 2. updateClaimWhere status=reserved AND lease_expires_at < now — reclaim
 * 3. updateClaimWhere status=sending AND lease_expires_at < now → uncertain
 *    (never reclaim sending for another send)
 * 4. updateClaimWhere status=failed → reserved (operator-resolved retry)
 * 5. updateClaimWhere expected owner/status — owner-sensitive transitions
 * 6. updateStateCas — UPDATE … WHERE scope AND version = expected (CAS)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentOsDeliveryRecord, DeliveryStatus } from "../types";
import { redactSecretsAndPii } from "../../redaction";
import { DELIVERY_CLAIM_LEASE_MS } from "../store";

export type StateRow = {
  scope: string;
  state: unknown;
  version: number;
  updated_at: string;
};

export type ClaimRow = {
  idempotency_key: string;
  delivery_id: string;
  kind: string;
  cadence_id: string;
  cadence_window: string;
  status: string;
  brief_fingerprint: string;
  recipient_config_fingerprint: string;
  run_id: string;
  provider_message_id: string | null;
  error_summary: string | null;
  suppression_reason: string | null;
  reserved_at: string;
  updated_at: string;
  sent_at: string | null;
  lease_expires_at: string;
  claim_owner: string;
  resolution_audit: unknown;
};

export type ClaimUpdateMatch = {
  statusIn?: string[];
  statusEq?: string;
  leaseExpiredBefore?: string;
  claimOwner?: string;
};

export type AgentOsSupabaseDb = {
  selectState(scope: string): Promise<StateRow | null>;
  insertState(row: StateRow): Promise<{ ok: true } | { ok: false; message: string }>;
  /**
   * CAS: UPDATE WHERE scope = ? AND version = expectedVersion.
   * Returns null when no row matched (stale version).
   */
  updateStateCas(input: {
    scope: string;
    expectedVersion: number;
    nextVersion: number;
    state: unknown;
    updatedAt: string;
  }): Promise<StateRow | null>;
  listClaims(limit: number): Promise<ClaimRow[]>;
  selectClaim(idempotencyKey: string): Promise<ClaimRow | null>;
  /** INSERT create-if-absent; returns null on unique conflict. */
  insertClaim(row: ClaimRow): Promise<ClaimRow | null>;
  /**
   * Conditional UPDATE matching match filters; returns updated row or null.
   * Equivalent to UPDATE … WHERE idempotency_key = ? AND <match> RETURNING *.
   */
  updateClaimWhere(input: {
    idempotencyKey: string;
    match: ClaimUpdateMatch;
    patch: Partial<ClaimRow>;
  }): Promise<ClaimRow | null>;
};

export function rowToRecord(row: ClaimRow): AgentOsDeliveryRecord {
  return {
    schemaVersion: 2,
    deliveryId: row.delivery_id,
    idempotencyKey: row.idempotency_key,
    cadenceId: row.cadence_id,
    cadenceWindow: row.cadence_window,
    runId: row.run_id,
    briefFingerprint: row.brief_fingerprint,
    recipientConfigFingerprint: row.recipient_config_fingerprint,
    kind: row.kind as AgentOsDeliveryRecord["kind"],
    status: row.status as DeliveryStatus,
    suppressionReason: row.suppression_reason,
    providerMessageId: row.provider_message_id,
    errorSummary: row.error_summary,
    reservedAt: row.reserved_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    leaseExpiresAt: row.lease_expires_at,
    claimOwner: row.claim_owner,
    resolutionAudit: Array.isArray(row.resolution_audit)
      ? (row.resolution_audit as AgentOsDeliveryRecord["resolutionAudit"])
      : [],
  };
}

export function recordToRow(record: AgentOsDeliveryRecord): ClaimRow {
  return {
    idempotency_key: record.idempotencyKey,
    delivery_id: record.deliveryId,
    kind: record.kind,
    cadence_id: record.cadenceId,
    cadence_window: record.cadenceWindow,
    status: record.status,
    brief_fingerprint: record.briefFingerprint,
    recipient_config_fingerprint: record.recipientConfigFingerprint,
    run_id: record.runId,
    provider_message_id: record.providerMessageId,
    error_summary: record.errorSummary
      ? redactSecretsAndPii(record.errorSummary).slice(0, 400)
      : null,
    suppression_reason: record.suppressionReason,
    reserved_at: record.reservedAt,
    updated_at: record.updatedAt,
    sent_at: record.sentAt,
    lease_expires_at:
      record.leaseExpiresAt ??
      new Date(Date.parse(record.updatedAt) + DELIVERY_CLAIM_LEASE_MS).toISOString(),
    claim_owner: record.claimOwner ?? "unknown",
    resolution_audit: (record.resolutionAudit ?? []).map((e) => ({
      ...e,
      note: e.note ? redactSecretsAndPii(e.note).slice(0, 240) : null,
    })),
  };
}

function matchesClaim(row: ClaimRow, match: ClaimUpdateMatch): boolean {
  if (match.statusEq != null && row.status !== match.statusEq) return false;
  if (match.statusIn != null && !match.statusIn.includes(row.status)) return false;
  if (match.claimOwner != null && row.claim_owner !== match.claimOwner) return false;
  if (match.leaseExpiredBefore != null) {
    if (!(Date.parse(row.lease_expires_at) < Date.parse(match.leaseExpiredBefore))) {
      return false;
    }
  }
  return true;
}

/** In-memory fake mirroring Postgres UNIQUE + conditional UPDATE semantics. */
export function createFakeAgentOsSupabaseDb(): AgentOsSupabaseDb & {
  _states: Map<string, StateRow>;
  _claims: Map<string, ClaimRow>;
  reset(): void;
} {
  const states = new Map<string, StateRow>();
  const claims = new Map<string, ClaimRow>();

  return {
    _states: states,
    _claims: claims,
    reset() {
      states.clear();
      claims.clear();
    },
    async selectState(scope) {
      return states.get(scope) ?? null;
    },
    async insertState(row) {
      if (states.has(row.scope)) {
        return { ok: false, message: "duplicate key value violates unique constraint" };
      }
      states.set(row.scope, { ...row });
      return { ok: true };
    },
    async updateStateCas(input) {
      const cur = states.get(input.scope);
      if (!cur || cur.version !== input.expectedVersion) return null;
      const next: StateRow = {
        scope: input.scope,
        state: input.state,
        version: input.nextVersion,
        updated_at: input.updatedAt,
      };
      states.set(input.scope, next);
      return { ...next };
    },
    async listClaims(limit) {
      return [...claims.values()]
        .sort(
          (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
        )
        .slice(0, limit);
    },
    async selectClaim(idempotencyKey) {
      const row = claims.get(idempotencyKey);
      return row ? { ...row } : null;
    },
    async insertClaim(row) {
      if (claims.has(row.idempotency_key)) return null;
      // Also enforce uniqueness boundary (cadence, window, kind, recipient fp)
      for (const existing of claims.values()) {
        if (
          existing.cadence_id === row.cadence_id &&
          existing.cadence_window === row.cadence_window &&
          existing.kind === row.kind &&
          existing.recipient_config_fingerprint ===
            row.recipient_config_fingerprint
        ) {
          return null;
        }
      }
      const stored = { ...row, resolution_audit: row.resolution_audit };
      claims.set(row.idempotency_key, stored);
      return { ...stored };
    },
    async updateClaimWhere(input) {
      const cur = claims.get(input.idempotencyKey);
      if (!cur || !matchesClaim(cur, input.match)) return null;
      const next = { ...cur, ...input.patch };
      claims.set(input.idempotencyKey, next);
      return { ...next };
    },
  };
}

/** Live PostgREST implementation over Supabase client. */
export function createSupabaseAgentOsDb(
  client: SupabaseClient,
): AgentOsSupabaseDb {
  return {
    async selectState(scope) {
      const { data, error } = await client
        .from("agent_os_persisted_state")
        .select("scope,state,version,updated_at")
        .eq("scope", scope)
        .maybeSingle();
      if (error) throw new Error(redactSecretsAndPii(error.message));
      return (data as StateRow | null) ?? null;
    },
    async insertState(row) {
      const { error } = await client.from("agent_os_persisted_state").insert(row);
      if (error) {
        return { ok: false, message: redactSecretsAndPii(error.message) };
      }
      return { ok: true };
    },
    async updateStateCas(input) {
      const { data, error } = await client
        .from("agent_os_persisted_state")
        .update({
          state: input.state,
          version: input.nextVersion,
          updated_at: input.updatedAt,
        })
        .eq("scope", input.scope)
        .eq("version", input.expectedVersion)
        .select("scope,state,version,updated_at")
        .maybeSingle();
      if (error) throw new Error(redactSecretsAndPii(error.message));
      return (data as StateRow | null) ?? null;
    },
    async listClaims(limit) {
      const { data, error } = await client
        .from("agent_os_delivery_claims")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(redactSecretsAndPii(error.message));
      return (data as ClaimRow[]) ?? [];
    },
    async selectClaim(idempotencyKey) {
      const { data, error } = await client
        .from("agent_os_delivery_claims")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(redactSecretsAndPii(error.message));
      return (data as ClaimRow | null) ?? null;
    },
    async insertClaim(row) {
      const { data, error } = await client
        .from("agent_os_delivery_claims")
        .insert(row)
        .select("*")
        .maybeSingle();
      if (error) {
        // Unique violation → treat as conflict (create-if-absent miss)
        if (
          /duplicate|unique|23505/i.test(error.message) ||
          error.code === "23505"
        ) {
          return null;
        }
        throw new Error(redactSecretsAndPii(error.message));
      }
      return (data as ClaimRow | null) ?? null;
    },
    async updateClaimWhere(input) {
      let q = client
        .from("agent_os_delivery_claims")
        .update(input.patch)
        .eq("idempotency_key", input.idempotencyKey);
      if (input.match.statusEq) {
        q = q.eq("status", input.match.statusEq);
      }
      if (input.match.statusIn) {
        q = q.in("status", input.match.statusIn);
      }
      if (input.match.claimOwner) {
        q = q.eq("claim_owner", input.match.claimOwner);
      }
      if (input.match.leaseExpiredBefore) {
        q = q.lt("lease_expires_at", input.match.leaseExpiredBefore);
      }
      const { data, error } = await q.select("*").maybeSingle();
      if (error) throw new Error(redactSecretsAndPii(error.message));
      return (data as ClaimRow | null) ?? null;
    },
  };
}
