/**
 * Persist Human Intake candidates with identity dedupe and auditable lineage.
 * Newer evidence supersedes stale proposals without deleting them.
 * Founder review_status is preserved across reprocess and supersession.
 */

import type {
  CandidateSourceSystem,
  CandidateStore,
  ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { logicalProposalKey } from "@/lib/continuum/candidates/identity";
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

export const HUMAN_INTAKE_SOURCE_REF_VERSION_PREFIX = "hi1|" as const;

export function humanIntakeSourceRefPrefix(sourceId: string): string {
  return `${HUMAN_INTAKE_SOURCE_REF_VERSION_PREFIX}${sourceId.trim()}|`;
}

type CandidateStoreWithSourceQuery = CandidateStore & {
  listBySourceRefPrefix(
    sourceSystem: CandidateSourceSystem,
    sourceRefPrefix: string,
  ): Promise<ContinuumCandidate[]>;
};

function hasSourceRefPrefixQuery(
  store: CandidateStore,
): store is CandidateStoreWithSourceQuery {
  return (
    typeof (store as CandidateStoreWithSourceQuery).listBySourceRefPrefix ===
    "function"
  );
}

export async function listHumanIntakeCandidatesForSource(
  store: CandidateStore,
  sourceId: string,
): Promise<ContinuumCandidate[]> {
  const prefix = humanIntakeSourceRefPrefix(sourceId);
  if (hasSourceRefPrefixQuery(store)) {
    return store.listBySourceRefPrefix("human-intake", prefix);
  }
  return (await store.list()).filter(
    (row) =>
      row.sourceSystem === "human-intake" &&
      sourceIdFromCandidateSourceRef(row.sourceRef) === sourceId,
  );
}

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
  sourceId?: string,
): Promise<void> {
  const rows = sourceId
    ? await listHumanIntakeCandidatesForSource(store, sourceId)
    : (await store.list()).filter((row) => row.sourceSystem === "human-intake");
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
  await applyHumanIntakeCandidateLineage(store, input.evidence.sourceId);
  return {
    ...proposed,
    candidates: await listHumanIntakeCandidatesForSource(store, input.evidence.sourceId),
    insertedIds,
    duplicateIds,
  };
}
