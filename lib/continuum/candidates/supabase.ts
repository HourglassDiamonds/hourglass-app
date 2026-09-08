/**
 * Durable CandidateStore against public.continuum_candidates.
 * Service-role only. Schema remains UNAPPLIED until a later change.
 * Does not write Persons, specs, lifecycle, Kind, Open Jobs, or Gmail.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { applyFounderReview } from "./review";
import { adapterInsert } from "./store";
import {
  CONTINUUM_CANDIDATES_TABLE,
  candidateStorageStateFromError,
} from "./activation";
import { collectPagedRows } from "./page";
import {
  candidateToRow,
  preserveReviewOnReplace,
  rowToCandidate,
} from "./rows";
import type {
  ApplyReviewResult,
  CandidateSourceSystem,
  CandidateStore,
  ContinuumCandidate,
  FounderReviewInput,
  PutCandidateResult,
} from "./types";

const UNIQUE_VIOLATION = "23505";
const COLUMNS =
  "candidate_id, source_system, source_ref, source_timestamp, candidate_type, proposed_target, payload, confidence, evidence_basis, candidate_state, review_status, last_review_action, founder_edited_payload, founder_edited_target, reviewed_at, created_at, canonical, automatic_apply, parser_version, supersedes_candidate_id, superseded_by_candidate_id";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function throwIfStorageError(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (candidateStorageStateFromError(error) === "not-activated") {
    throw new Error("candidate-storage-not-activated");
  }
  throw new Error(error.message || "candidate-store-unavailable");
}

export class SupabaseCandidateStore implements CandidateStore {
  constructor(private readonly client: SupabaseClient) {}

  async put(row: ContinuumCandidate): Promise<PutCandidateResult> {
    const inserted = candidateToRow(adapterInsert(row));
    const { error } = await this.client.from(CONTINUUM_CANDIDATES_TABLE).insert(inserted);
    if (error?.code === UNIQUE_VIOLATION) {
      const existing = await this.get(row.candidateId);
      if (!existing) throw new Error("candidate-store-unavailable");
      return { status: "duplicate", record: existing };
    }
    throwIfStorageError(error);
    return { status: "inserted", record: rowToCandidate(inserted) };
  }

  async get(candidateId: string): Promise<ContinuumCandidate | null> {
    const { data, error } = await this.client
      .from(CONTINUUM_CANDIDATES_TABLE)
      .select(COLUMNS)
      .eq("candidate_id", candidateId.trim())
      .maybeSingle();
    throwIfStorageError(error);
    if (!data) return null;
    return rowToCandidate(data as Record<string, unknown>);
  }

  async list(): Promise<ContinuumCandidate[]> {
    const rows = await collectPagedRows(async (from, to) => {
      const { data, error } = await this.client
        .from(CONTINUUM_CANDIDATES_TABLE)
        .select(COLUMNS)
        .order("created_at", { ascending: true })
        .range(from, to);
      throwIfStorageError(error);
      return (data ?? []) as Record<string, unknown>[];
    });
    return rows.map((row) => rowToCandidate(row));
  }

  async listBySourceRefPrefix(
    sourceSystem: CandidateSourceSystem,
    sourceRefPrefix: string,
  ): Promise<ContinuumCandidate[]> {
    const rows = await collectPagedRows(async (from, to) => {
      const { data, error } = await this.client
        .from(CONTINUUM_CANDIDATES_TABLE)
        .select(COLUMNS)
        .eq("source_system", sourceSystem)
        .like("source_ref", `${sourceRefPrefix}%`)
        .order("created_at", { ascending: true })
        .range(from, to);
      throwIfStorageError(error);
      return (data ?? []) as Record<string, unknown>[];
    });
    return rows.map((row) => rowToCandidate(row));
  }

  async replace(row: ContinuumCandidate): Promise<ContinuumCandidate> {
    const existing = await this.get(row.candidateId);
    const merged = preserveReviewOnReplace(existing, row);
    const stored = candidateToRow(merged);
    const { error } = await this.client
      .from(CONTINUUM_CANDIDATES_TABLE)
      .update(stored)
      .eq("candidate_id", stored.candidate_id);
    throwIfStorageError(error);
    return rowToCandidate(stored);
  }

  async applyReview(
    candidateId: string,
    input: FounderReviewInput,
    reviewedAt: string,
  ): Promise<ApplyReviewResult> {
    const existing = await this.get(candidateId);
    if (!existing) return { ok: false, reason: "not-found" };
    const reviewed = applyFounderReview(existing, input, reviewedAt);
    const stored = candidateToRow(reviewed);
    const { error } = await this.client
      .from(CONTINUUM_CANDIDATES_TABLE)
      .update(stored)
      .eq("candidate_id", stored.candidate_id);
    throwIfStorageError(error);
    return { ok: true, record: rowToCandidate(stored) };
  }
}

export function createSupabaseCandidateStore(
  client: SupabaseClient | null = getSupabaseAdmin(),
): SupabaseCandidateStore {
  return new SupabaseCandidateStore(requireClient(client));
}
