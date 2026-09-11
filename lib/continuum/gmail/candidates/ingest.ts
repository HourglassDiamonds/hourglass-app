/**
 * Persist Gmail candidates with identity dedupe and auditable lineage.
 * Newer evidence supersedes stale proposals without deleting them.
 * Founder review_status is preserved across reprocess and supersession.
 */

import type { CandidateStore, ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { logicalProposalKey } from "@/lib/continuum/candidates/identity";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { candidateHasGeneratedOperatingMailRule } from "./generated-source";
import {
  proposeGmailCandidates,
  type ProposeGmailCandidatesInput,
  type ProposeGmailCandidatesResult,
} from "./propose";
import {
  attachObservedSupportingGmailProvenance,
  mergeSupportingGmailProvenance,
} from "./supporting-source";

export type IngestGmailCandidatesResult = ProposeGmailCandidatesResult & {
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

async function applyLineageSubset(
  store: CandidateStore,
  group: readonly ContinuumCandidate[],
): Promise<void> {
  if (group.length < 2) return;
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

export async function applyCandidateLineage(
  store: CandidateStore,
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
    const generated = group.filter((row) =>
      candidateHasGeneratedOperatingMailRule(row.evidenceBasis.ruleIds),
    );
    const real = group.filter(
      (row) => !candidateHasGeneratedOperatingMailRule(row.evidenceBasis.ruleIds),
    );
    await applyLineageSubset(store, real);
    await applyLineageSubset(store, generated);
  }
}

export async function ingestGmailCandidates(
  store: CandidateStore,
  input: ProposeGmailCandidatesInput,
): Promise<IngestGmailCandidatesResult> {
  const proposed = proposeGmailCandidates(input);
  const observed = attachObservedSupportingGmailProvenance([
    ...(await store.list()),
    ...proposed.candidates,
  ]);
  const incomingById = new Map(
    observed
      .filter((row) =>
        proposed.candidates.some((item) => item.candidateId === row.candidateId),
      )
      .map((row) => [row.candidateId, row]),
  );
  const insertedIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const row of proposed.candidates) {
    const incoming = incomingById.get(row.candidateId) ?? row;
    const result = await store.put(incoming);
    if (result.status === "inserted") {
      insertedIds.push(result.record.candidateId);
      continue;
    }
    duplicateIds.push(result.record.candidateId);
    const merged = mergeSupportingGmailProvenance(result.record, incoming);
    if (merged) await store.replace(merged);
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
