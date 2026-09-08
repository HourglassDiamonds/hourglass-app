/**
 * Persist Calendar association Candidates with identity dedupe.
 * Founder review_status is preserved across reprocess.
 * Does not mutate #22 CalendarEventEvidence.
 */

import type {
  CandidateSourceSystem,
  CandidateStore,
  ContinuumCandidate,
} from "@/lib/continuum/candidates/types";
import { logicalProposalKey } from "@/lib/continuum/candidates/identity";
import { CALENDAR_SOURCE_SYSTEM } from "../types";
import {
  proposeCalendarAssociationCandidates,
  type ProposeCalendarAssociationInput,
  type ProposeCalendarAssociationResult,
} from "./propose";
import { parseCalendarCandidateSourceRef } from "./source-ref";

export type IngestCalendarAssociationResult = ProposeCalendarAssociationResult & {
  insertedIds: string[];
  duplicateIds: string[];
};

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

export async function listCalendarAssociationCandidates(
  store: CandidateStore,
  sourceRef?: string,
): Promise<ContinuumCandidate[]> {
  if (sourceRef) {
    const parsed = parseCalendarCandidateSourceRef(sourceRef);
    if (parsed && hasSourceRefPrefixQuery(store)) {
      return (await store.listBySourceRefPrefix(CALENDAR_SOURCE_SYSTEM, sourceRef)).filter(
        (row) => row.sourceRef === sourceRef,
      );
    }
    return (await store.list()).filter(
      (row) =>
        row.sourceSystem === CALENDAR_SOURCE_SYSTEM && row.sourceRef === sourceRef,
    );
  }
  if (hasSourceRefPrefixQuery(store)) {
    return store.listBySourceRefPrefix(CALENDAR_SOURCE_SYSTEM, "cal1|");
  }
  return (await store.list()).filter(
    (row) => row.sourceSystem === CALENDAR_SOURCE_SYSTEM,
  );
}

function sourceMs(row: ContinuumCandidate): number {
  const ms = Date.parse(row.sourceTimestamp);
  return Number.isFinite(ms) ? ms : 0;
}

function evidenceState(
  row: ContinuumCandidate,
): ContinuumCandidate["candidateState"] {
  if (row.candidateState === "conflict") return "conflict";
  return "active";
}

export async function applyCalendarAssociationLineage(
  store: CandidateStore,
): Promise<void> {
  const rows = await listCalendarAssociationCandidates(store);
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

export async function ingestCalendarAssociationCandidates(
  store: CandidateStore,
  input: ProposeCalendarAssociationInput,
): Promise<IngestCalendarAssociationResult> {
  const proposed = proposeCalendarAssociationCandidates(input);
  const insertedIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const row of proposed.candidates) {
    const result = await store.put(row);
    if (result.status === "inserted") insertedIds.push(result.record.candidateId);
    else duplicateIds.push(result.record.candidateId);
  }
  await applyCalendarAssociationLineage(store);
  return {
    ...proposed,
    candidates: await listCalendarAssociationCandidates(store),
    insertedIds,
    duplicateIds,
  };
}
