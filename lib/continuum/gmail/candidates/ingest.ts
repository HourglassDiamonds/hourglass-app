/**
 * Persist Gmail candidates with identity dedupe and auditable lineage.
 * Newer evidence supersedes stale proposals without deleting them.
 */

import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { logicalProposalKey } from "@/lib/continuum/candidates/identity";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import {
  proposeGmailCandidates,
  type ProposeGmailCandidatesInput,
  type ProposeGmailCandidatesResult,
} from "./propose";

export type IngestGmailCandidatesResult = ProposeGmailCandidatesResult & {
  insertedIds: string[];
  duplicateIds: string[];
};

function sourceMs(row: ContinuumCandidate): number {
  const ms = Date.parse(row.sourceTimestamp);
  return Number.isFinite(ms) ? ms : 0;
}

export async function applyCandidateLineage(
  store: InMemoryCandidateStore,
): Promise<void> {
  const rows = await store.list();
  const groups = new Map<string, ContinuumCandidate[]>();
  for (const row of rows) {
    const key = logicalProposalKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const delta = sourceMs(a) - sourceMs(b);
      if (delta !== 0) return delta;
      return a.candidateId.localeCompare(b.candidateId);
    });
    const newest = sorted[sorted.length - 1]!;
    const previous = sorted[sorted.length - 2] ?? null;
    await store.replace({
      ...newest,
      status:
        newest.status === "conflict_review_required"
          ? "conflict_review_required"
          : newest.status === "superseded"
            ? "pending"
            : newest.status,
      supersedesCandidateId: previous?.candidateId ?? null,
      supersededByCandidateId: null,
    });
    for (const row of sorted) {
      if (row.candidateId === newest.candidateId) continue;
      await store.replace({
        ...row,
        status: "superseded",
        supersededByCandidateId: newest.candidateId,
        supersedesCandidateId: row.supersedesCandidateId,
      });
    }
  }
}

export async function ingestGmailCandidates(
  store: CandidateStore,
  input: ProposeGmailCandidatesInput,
): Promise<IngestGmailCandidatesResult> {
  const proposed = proposeGmailCandidates(input);
  const insertedIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const row of proposed.candidates) {
    const result = await store.put(row);
    if (result.status === "inserted") insertedIds.push(result.record.candidateId);
    else duplicateIds.push(result.record.candidateId);
  }
  if (store instanceof InMemoryCandidateStore) {
    await applyCandidateLineage(store);
  }
  return {
    ...proposed,
    candidates: await store.list(),
    insertedIds,
    duplicateIds,
  };
}
