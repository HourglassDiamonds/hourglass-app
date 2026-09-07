/**
 * Persist Human Intake candidates with identity dedupe and auditable lineage.
 * Newer evidence supersedes stale proposals without deleting them.
 * Founder review_status is preserved across reprocess and supersession.
 */

import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { logicalProposalKey } from "@/lib/continuum/candidates/identity";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import {
  proposeHumanIntakeCandidates,
  type ProposeHumanIntakeCandidatesInput,
  type ProposeHumanIntakeCandidatesResult,
} from "./propose";
import { sourceIdFromCandidateSourceRef } from "./source-ref";

export type IngestHumanIntakeCandidatesResult = ProposeHumanIntakeCandidatesResult & {
  insertedIds: string[];
  duplicateIds: string[];
};

function sourceMs(row: ContinuumCandidate): number {
  const ms = Date.parse(row.sourceTimestamp);
  return Number.isFinite(ms) ? ms : 0;
}

function evidenceState(row: ContinuumCandidate): ContinuumCandidate["candidateState"] {
  if (row.candidateState === "conflict") return "conflict";
  return "active";
}

export async function applyHumanIntakeCandidateLineage(
  store: CandidateStore,
): Promise<void> {
  const rows = await store.list();
  const groups = new Map<string, ContinuumCandidate[]>();
  for (const row of rows) {
    if (row.sourceSystem !== "human-intake") continue;
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
      candidateState: evidenceState(newest),
      supersedesCandidateId: previous?.candidateId ?? null,
      supersededByCandidateId: null,
    });
    for (const row of sorted) {
      if (row.candidateId === newest.candidateId) continue;
      await store.replace({
        ...row,
        candidateState: "superseded",
        supersededByCandidateId: newest.candidateId,
        supersedesCandidateId: row.supersedesCandidateId,
      });
    }
  }
}

export async function ingestHumanIntakeCandidates(
  store: CandidateStore,
  input: ProposeHumanIntakeCandidatesInput,
): Promise<IngestHumanIntakeCandidatesResult> {
  const proposed = proposeHumanIntakeCandidates(input);
  const insertedIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const row of proposed.candidates) {
    const result = await store.put(row);
    if (result.status === "inserted") insertedIds.push(result.record.candidateId);
    else duplicateIds.push(result.record.candidateId);
  }
  if (store instanceof InMemoryCandidateStore) {
    await applyHumanIntakeCandidateLineage(store);
  }
  return {
    ...proposed,
    candidates: (await store.list()).filter(
      (row) =>
        row.sourceSystem === "human-intake" &&
        sourceIdFromCandidateSourceRef(row.sourceRef) === input.evidence.sourceId,
    ),
    insertedIds,
    duplicateIds,
  };
}
