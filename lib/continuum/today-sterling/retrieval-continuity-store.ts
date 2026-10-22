import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SterlingThreadVerificationMetadata } from "./retrieval-continuity";

export type SterlingVerificationLoadResult =
  | { available: true; rows: readonly SterlingThreadVerificationMetadata[] }
  | { available: false; rows: readonly [] };

export type SterlingVerificationSaveResult = "stored" | "conflict" | "unavailable";

export type SterlingThreadVerificationStore = {
  load(threadKeyDigests: readonly string[]): Promise<SterlingVerificationLoadResult>;
  save(
    metadata: SterlingThreadVerificationMetadata,
    expectedRevision: number | null,
  ): Promise<SterlingVerificationSaveResult>;
};

function asMetadata(value: unknown): SterlingThreadVerificationMetadata | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const threadKeyDigest = String(row.thread_key_digest ?? "");
  const indexedFingerprint = String(row.indexed_fingerprint ?? "");
  const verifiedAt = String(row.verified_at ?? "");
  const expiresAt = String(row.expires_at ?? "");
  const latestIndexedMessageAt = row.latest_indexed_message_at == null
    ? null : String(row.latest_indexed_message_at);
  const indexedMessageCount = Number(row.indexed_message_count);
  const revision = Number(row.revision);
  if (!/^[a-f0-9]{64}$/.test(threadKeyDigest) || !/^[a-f0-9]{64}$/.test(indexedFingerprint) ||
      !Number.isFinite(Date.parse(verifiedAt)) || !Number.isFinite(Date.parse(expiresAt)) ||
      (latestIndexedMessageAt != null && !Number.isFinite(Date.parse(latestIndexedMessageAt))) ||
      !Number.isInteger(indexedMessageCount) || indexedMessageCount < 0 ||
      row.verification_status !== "complete_live" || !Number.isSafeInteger(revision) || revision < 1) return null;
  return {
    threadKeyDigest,
    indexedFingerprint,
    verifiedAt,
    expiresAt,
    latestIndexedMessageAt,
    indexedMessageCount,
    outcome: "complete_live",
    revision,
  };
}

/** Service-role-only RPC adapter. Invalid or unavailable metadata fails closed. */
export function createSupabaseSterlingThreadVerificationStore(
  client: SupabaseClient,
): SterlingThreadVerificationStore {
  return {
    async load(threadKeyDigests) {
      if (threadKeyDigests.length === 0) return { available: true, rows: [] };
      const { data, error } = await client.rpc("continuum_read_sterling_today_thread_verifications", {
        p_thread_key_digests: [...threadKeyDigests],
      });
      if (error || !Array.isArray(data)) return { available: false, rows: [] };
      const rows = data.map(asMetadata);
      if (rows.some((row) => row == null)) return { available: false, rows: [] };
      return { available: true, rows: rows as SterlingThreadVerificationMetadata[] };
    },
    async save(metadata, expectedRevision) {
      const { data, error } = await client.rpc("continuum_record_sterling_today_thread_verification", {
        p_thread_key_digest: metadata.threadKeyDigest,
        p_indexed_fingerprint: metadata.indexedFingerprint,
        p_verified_at: metadata.verifiedAt,
        p_latest_indexed_message_at: metadata.latestIndexedMessageAt,
        p_indexed_message_count: metadata.indexedMessageCount,
        p_expected_revision: expectedRevision,
      });
      if (error) return "unavailable";
      if (data == null) return "conflict";
      return Number.isSafeInteger(Number(data)) && Number(data) > 0 ? "stored" : "unavailable";
    },
  };
}

/** Test/reference store with the same compare-and-swap behavior as the RPC. */
export class InMemorySterlingThreadVerificationStore implements SterlingThreadVerificationStore {
  private readonly rows = new Map<string, SterlingThreadVerificationMetadata>();
  available = true;

  constructor(initial: readonly SterlingThreadVerificationMetadata[] = []) {
    for (const row of initial) this.rows.set(row.threadKeyDigest, { ...row });
  }

  async load(threadKeyDigests: readonly string[]): Promise<SterlingVerificationLoadResult> {
    if (!this.available) return { available: false, rows: [] };
    return {
      available: true,
      rows: threadKeyDigests.flatMap((digest) => {
        const row = this.rows.get(digest);
        return row ? [{ ...row }] : [];
      }),
    };
  }

  async save(
    metadata: SterlingThreadVerificationMetadata,
    expectedRevision: number | null,
  ): Promise<SterlingVerificationSaveResult> {
    if (!this.available) return "unavailable";
    const current = this.rows.get(metadata.threadKeyDigest);
    if (!current) {
      if (expectedRevision != null) return "conflict";
      this.rows.set(metadata.threadKeyDigest, { ...metadata, revision: 1 });
      return "stored";
    }
    if (current.indexedFingerprint === metadata.indexedFingerprint &&
        current.verifiedAt === metadata.verifiedAt && current.expiresAt === metadata.expiresAt &&
        current.latestIndexedMessageAt === metadata.latestIndexedMessageAt &&
        current.indexedMessageCount === metadata.indexedMessageCount) return "stored";
    if (expectedRevision == null || current.revision !== expectedRevision) return "conflict";
    this.rows.set(metadata.threadKeyDigest, { ...metadata, revision: current.revision + 1 });
    return "stored";
  }
}
