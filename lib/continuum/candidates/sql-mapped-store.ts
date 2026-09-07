/**
 * Durable CandidateStore over continuum_candidates row shape.
 * Used to prove reload/reprocess without applying Production SQL.
 * Not the production-intended #19 path — that is SupabaseCandidateStore.
 */

import { applyFounderReview } from "./review";
import { adapterInsert } from "./store";
import {
  candidateToRow,
  preserveReviewOnReplace,
  rowToCandidate,
  snapshotCandidateRows,
  type ContinuumCandidateRow,
} from "./rows";
import type {
  ApplyReviewResult,
  CandidateSourceSystem,
  CandidateStore,
  ContinuumCandidate,
  FounderReviewInput,
  PutCandidateResult,
} from "./types";

export class SqlMappedCandidateStore implements CandidateStore {
  private readonly rows = new Map<string, ContinuumCandidateRow>();

  static fromRows(rows: readonly ContinuumCandidateRow[]): SqlMappedCandidateStore {
    const store = new SqlMappedCandidateStore();
    for (const row of snapshotCandidateRows(rows)) {
      store.rows.set(row.candidate_id, row);
    }
    return store;
  }

  exportRows(): ContinuumCandidateRow[] {
    return snapshotCandidateRows(this.rows.values());
  }

  async put(row: ContinuumCandidate): Promise<PutCandidateResult> {
    const existing = this.rows.get(row.candidateId);
    if (existing) {
      return { status: "duplicate", record: rowToCandidate(existing) };
    }
    const stored = candidateToRow(adapterInsert(row));
    this.rows.set(stored.candidate_id, stored);
    return { status: "inserted", record: rowToCandidate(stored) };
  }

  async get(candidateId: string): Promise<ContinuumCandidate | null> {
    const existing = this.rows.get(candidateId.trim());
    return existing ? rowToCandidate(existing) : null;
  }

  async list(): Promise<ContinuumCandidate[]> {
    return [...this.rows.values()].map((row) => rowToCandidate(row));
  }

  async listBySourceRefPrefix(
    sourceSystem: CandidateSourceSystem,
    sourceRefPrefix: string,
  ): Promise<ContinuumCandidate[]> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.source_system === sourceSystem &&
          row.source_ref.startsWith(sourceRefPrefix),
      )
      .map((row) => rowToCandidate(row));
  }

  async replace(row: ContinuumCandidate): Promise<ContinuumCandidate> {
    const existing = this.rows.get(row.candidateId);
    const merged = preserveReviewOnReplace(
      existing ? rowToCandidate(existing) : null,
      row,
    );
    const stored = candidateToRow(merged);
    this.rows.set(stored.candidate_id, stored);
    return rowToCandidate(stored);
  }

  async applyReview(
    candidateId: string,
    input: FounderReviewInput,
    reviewedAt: string,
  ): Promise<ApplyReviewResult> {
    const existing = this.rows.get(candidateId.trim());
    if (!existing) return { ok: false, reason: "not-found" };
    const reviewed = applyFounderReview(rowToCandidate(existing), input, reviewedAt);
    const stored = candidateToRow(reviewed);
    this.rows.set(stored.candidate_id, stored);
    return { ok: true, record: rowToCandidate(stored) };
  }
}
