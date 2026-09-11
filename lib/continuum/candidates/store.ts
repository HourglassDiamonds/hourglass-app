/**
 * In-memory Candidate store.
 * Duplicate identity is idempotent and preserves founder review.
 * Lineage is additive, not destructive.
 */

import { applyFounderReview } from "./review";
import { logicalProposalKey } from "./identity";
import type {
  ApplyReviewResult,
  CandidateStore,
  ContinuumCandidate,
  FounderReviewInput,
  PutCandidateResult,
} from "./types";

function clonePayload(
  payload: ContinuumCandidate["payload"],
): ContinuumCandidate["payload"] {
  return { ...payload };
}

function clone(row: ContinuumCandidate): ContinuumCandidate {
  return {
    ...row,
    evidenceBasis: {
      ruleIds: [...row.evidenceBasis.ruleIds],
      matchedText: row.evidenceBasis.matchedText,
      supportingSourceRefs: row.evidenceBasis.supportingSourceRefs?.length
        ? [...row.evidenceBasis.supportingSourceRefs]
        : undefined,
    },
    proposedTarget: { ...row.proposedTarget },
    payload: clonePayload(row.payload),
    founderEditedPayload: row.founderEditedPayload
      ? clonePayload(row.founderEditedPayload)
      : null,
    founderEditedTarget: row.founderEditedTarget
      ? { ...row.founderEditedTarget }
      : null,
  };
}

export function adapterInsert(row: ContinuumCandidate): ContinuumCandidate {
  return clone({
    ...row,
    canonical: false,
    automaticApply: false,
    candidateState: row.candidateState === "conflict" ? "conflict" : "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
  });
}

export class InMemoryCandidateStore implements CandidateStore {
  private readonly rows = new Map<string, ContinuumCandidate>();

  async put(row: ContinuumCandidate): Promise<PutCandidateResult> {
    const existing = this.rows.get(row.candidateId);
    if (existing) {
      return { status: "duplicate", record: clone(existing) };
    }
    const stored = adapterInsert(row);
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

  async applyReview(
    candidateId: string,
    input: FounderReviewInput,
    reviewedAt: string,
  ): Promise<ApplyReviewResult> {
    const existing = this.rows.get(candidateId.trim());
    if (!existing) return { ok: false, reason: "not-found" };
    const reviewed = applyFounderReview(existing, input, reviewedAt);
    this.rows.set(reviewed.candidateId, clone(reviewed));
    return { ok: true, record: clone(reviewed) };
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
