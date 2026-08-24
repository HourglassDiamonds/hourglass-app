/**
 * Supabase founder passkey store.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Service-role only. Not Client Memory.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { CONTINUUM_FOUNDER_WEBAUTHN_USER_ID } from "./config";
import type {
  FounderPasskeyInsert,
  FounderPasskeyRecord,
  FounderPasskeyStore,
  PasskeyChallengeIssue,
  PasskeyChallengeKind,
  PasskeyChallengeLedger,
  PasskeyChallengeRecord,
  PasskeyPairingInsert,
  PasskeyPairingRecord,
  PasskeyPairingStore,
} from "./types";

const TABLE = "continuum_founder_passkeys";

type PasskeyRow = {
  id: string;
  founder_user_id: string;
  credential_id: string;
  public_key: string;
  counter: number | string;
  transports: string[] | null;
  device_type: string | null;
  backed_up: boolean | null;
  created_at: string;
  last_used_at: string | null;
  label: string | null;
  revoked_at: string | null;
};

function asCounter(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error("invalid-counter");
}

function decodePublicKey(value: string): Uint8Array {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length === 0) throw new Error("invalid-public-key");
  return new Uint8Array(bytes);
}

function encodePublicKey(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function rowToRecord(row: PasskeyRow): FounderPasskeyRecord {
  return {
    id: row.id,
    founderUserId: row.founder_user_id,
    credentialId: row.credential_id,
    publicKey: decodePublicKey(row.public_key),
    counter: asCounter(row.counter),
    transports: Array.isArray(row.transports) ? row.transports : null,
    deviceType: row.device_type,
    backedUp: row.backed_up,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    label: row.label,
    revokedAt: row.revoked_at,
  };
}

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

export class SupabaseFounderPasskeyStore implements FounderPasskeyStore {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<FounderPasskeyRecord[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(
        "id, founder_user_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at, label, revoked_at",
      )
      .eq("founder_user_id", CONTINUUM_FOUNDER_WEBAUTHN_USER_ID)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => rowToRecord(row as PasskeyRow));
  }

  async getByCredentialId(
    credentialId: string,
  ): Promise<FounderPasskeyRecord | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(
        "id, founder_user_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at, label, revoked_at",
      )
      .eq("founder_user_id", CONTINUUM_FOUNDER_WEBAUTHN_USER_ID)
      .eq("credential_id", credentialId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToRecord(data as PasskeyRow);
  }

  async insert(record: FounderPasskeyInsert): Promise<FounderPasskeyRecord> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        founder_user_id: record.founderUserId,
        credential_id: record.credentialId,
        public_key: encodePublicKey(record.publicKey),
        counter: record.counter,
        transports: record.transports,
        device_type: record.deviceType,
        backed_up: record.backedUp,
        created_at: record.createdAt,
        label: record.label,
      })
      .select(
        "id, founder_user_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at, label, revoked_at",
      )
      .single();
    if (error) throw error;
    return rowToRecord(data as PasskeyRow);
  }

  async updateAfterAuthentication(
    credentialId: string,
    update: {
      counter: number;
      lastUsedAt: string;
      backedUp: boolean | null;
      deviceType: string | null;
    },
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from(TABLE)
      .update({
        counter: update.counter,
        last_used_at: update.lastUsedAt,
        backed_up: update.backedUp,
        device_type: update.deviceType,
      })
      .eq("founder_user_id", CONTINUUM_FOUNDER_WEBAUTHN_USER_ID)
      .eq("credential_id", credentialId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async revoke(id: string, revokedAt: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(TABLE)
      .update({ revoked_at: revokedAt })
      .eq("founder_user_id", CONTINUUM_FOUNDER_WEBAUTHN_USER_ID)
      .eq("id", id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async hasActive(): Promise<boolean> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("id")
      .eq("founder_user_id", CONTINUUM_FOUNDER_WEBAUTHN_USER_ID)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
}

export function createSupabaseFounderPasskeyStore(): FounderPasskeyStore {
  return new SupabaseFounderPasskeyStore(requireClient(getSupabaseAdmin()));
}

const CHALLENGE_TABLE = "continuum_founder_webauthn_challenges";
const CONSUME_RPC = "continuum_founder_webauthn_consume_challenge";

type ChallengeRow = {
  jti: string;
  purpose: PasskeyChallengeKind;
  founder_user_id: string;
  challenge: string;
  origin: string;
  rp_id: string;
  session_fingerprint: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

function rowToChallenge(row: ChallengeRow): PasskeyChallengeRecord {
  return {
    jti: row.jti,
    purpose: row.purpose,
    founderUserId: row.founder_user_id,
    challenge: row.challenge,
    origin: row.origin,
    rpId: row.rp_id,
    sessionFingerprint: row.session_fingerprint,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

export class SupabasePasskeyChallengeLedger implements PasskeyChallengeLedger {
  constructor(private readonly client: SupabaseClient) {}

  async issue(record: PasskeyChallengeIssue): Promise<void> {
    const { error } = await this.client.from(CHALLENGE_TABLE).insert({
      jti: record.jti,
      purpose: record.purpose,
      founder_user_id: record.founderUserId,
      challenge: record.challenge,
      origin: record.origin,
      rp_id: record.rpId,
      session_fingerprint: record.sessionFingerprint,
      expires_at: record.expiresAt,
      created_at: record.createdAt,
    });
    if (error) throw error;
  }

  async consume(jti: string): Promise<
    | { ok: true; record: PasskeyChallengeRecord }
    | { ok: false; reason: "missing-challenge" | "replayed-challenge" | "expired-challenge" }
  > {
    const { data, error } = await this.client.rpc(CONSUME_RPC, { p_jti: jti });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, reason: "replayed-challenge" };
    return { ok: true, record: rowToChallenge(row as ChallengeRow) };
  }
}

export function createSupabasePasskeyChallengeLedger(): PasskeyChallengeLedger {
  return new SupabasePasskeyChallengeLedger(requireClient(getSupabaseAdmin()));
}

const PAIRING_TABLE = "continuum_founder_passkey_pairings";
const PAIRING_CLAIM_RPC = "continuum_founder_passkey_pairing_claim";
const PAIRING_TRANSITION_RPC = "continuum_founder_passkey_pairing_transition";
const PAIRING_CANCEL_RPC = "continuum_founder_passkey_pairing_cancel";

type PairingRow = {
  id: string;
  founder_user_id: string;
  token_hash: string;
  status: PasskeyPairingRecord["status"];
  match_code: string;
  device_hint: string | null;
  claimed_session_hash: string | null;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
};

function rowToPairing(row: PairingRow): PasskeyPairingRecord {
  return {
    id: row.id,
    founderUserId: row.founder_user_id,
    tokenHash: row.token_hash,
    status: row.status,
    matchCode: row.match_code,
    deviceHint: row.device_hint,
    claimedSessionHash: row.claimed_session_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at,
    approvedAt: row.approved_at,
    completedAt: row.completed_at,
  };
}

export class SupabasePasskeyPairingStore implements PasskeyPairingStore {
  constructor(private readonly client: SupabaseClient) {}

  async insert(record: PasskeyPairingInsert): Promise<PasskeyPairingRecord> {
    const { data, error } = await this.client
      .from(PAIRING_TABLE)
      .insert({
        founder_user_id: record.founderUserId,
        token_hash: record.tokenHash,
        status: "pending",
        match_code: record.matchCode,
        created_at: record.createdAt,
        expires_at: record.expiresAt,
      })
      .select(
        "id, founder_user_id, token_hash, status, match_code, device_hint, claimed_session_hash, created_at, expires_at, claimed_at, approved_at, completed_at",
      )
      .single();
    if (error) throw error;
    return rowToPairing(data as PairingRow);
  }

  async getById(id: string): Promise<PasskeyPairingRecord | null> {
    const { data, error } = await this.client
      .from(PAIRING_TABLE)
      .select(
        "id, founder_user_id, token_hash, status, match_code, device_hint, claimed_session_hash, created_at, expires_at, claimed_at, approved_at, completed_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToPairing(data as PairingRow);
  }

  async claim(input: {
    tokenHash: string;
    claimedSessionHash: string;
    deviceHint: string | null;
  }): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "invalid-pairing" | "already-claimed" | "pairing-expired" }
  > {
    const { data, error } = await this.client.rpc(PAIRING_CLAIM_RPC, {
      p_token_hash: input.tokenHash,
      p_claimed_session_hash: input.claimedSessionHash,
      p_device_hint: input.deviceHint,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, reason: "already-claimed" };
    return { ok: true, record: rowToPairing(row as PairingRow) };
  }

  async transition(
    id: string,
    from: "claimed" | "approved",
    to: "approved" | "completed",
  ): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "pairing-not-usable" }
  > {
    const { data, error } = await this.client.rpc(PAIRING_TRANSITION_RPC, {
      p_id: id,
      p_from_status: from,
      p_to_status: to,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, reason: "pairing-not-usable" };
    return { ok: true, record: rowToPairing(row as PairingRow) };
  }

  async cancel(id: string): Promise<
    | { ok: true; record: PasskeyPairingRecord }
    | { ok: false; reason: "pairing-not-usable" }
  > {
    const { data, error } = await this.client.rpc(PAIRING_CANCEL_RPC, {
      p_id: id,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, reason: "pairing-not-usable" };
    return { ok: true, record: rowToPairing(row as PairingRow) };
  }
}

export function createSupabasePasskeyPairingStore(): PasskeyPairingStore {
  return new SupabasePasskeyPairingStore(requireClient(getSupabaseAdmin()));
}
