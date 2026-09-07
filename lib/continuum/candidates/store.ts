/**
 * In-memory Candidate store.
 * Duplicate identity is idempotent. Lineage is additive, not destructive.
 */

import { logicalProposalKey } from "./identity";
import type {
  CandidateStore,
  ContinuumCandidate,
  PutCandidateResult,
} from "./types";

function clone(row: ContinuumCandidate): ContinuumCandidate {
  return {
    ...row,
    evidenceBasis: {
      ruleIds: [...row.evidenceBasis.ruleIds],
      matchedText: row.evidenceBasis.matchedText,
    },
    proposedTarget: { ...row.proposedTarget },
    payload: { ...row.payload },
  };
}

export class InMemoryCandidateStore implements CandidateStore {
  private readonly rows = new Map<string, ContinuumCandidate>();

  async put(row: ContinuumCandidate): Promise<PutCandidateResult> {
    const existing = this.rows.get(row.candidateId);
    if (existing) {
      return { status: "duplicate", record: clone(existing) };
    }
    const stored = clone(row);
    this.rows.set(row.candidateId, stored);
    return { status: "inserted", record: clone(stored) };
  }

  async get(candidateId: string): Promise<ContinuumCandidate | null> {
    const existing = this.rows.get(candidateId.trim());
    return existing ? clone(existing) : null;
  }

  async list(): Promise<ContinuumCandidate[]> {
    return [...this.rows.values()].map(clone);
  }

  async replace(row: ContinuumCandidate): Promise<ContinuumCandidate> {
    const stored = clone(row);
    this.rows.set(row.candidateId, stored);
    return clone(stored);
  }
}

export function sameLogicalProposal(
  left: ContinuumCandidate,
  right: ContinuumCandidate,
): boolean {
  return logicalProposalKey(left) === logicalProposalKey(right);
}

export async function persistCandidates(
  store: InMemoryCandidateStore,
  incoming: readonly ContinuumCandidate[],
  superseded: readonly ContinuumCandidate[] = [],
): Promise<PutCandidateResult[]> {
  for (const row of superseded) {
    await store.replace(row);
  }
  const results: PutCandidateResult[] = [];
  for (const row of incoming) {
    results.push(await store.put(row));
  }
  return results;
}
