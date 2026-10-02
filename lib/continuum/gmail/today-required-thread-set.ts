import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { exactGmailIdsFromCandidate } from "@/lib/continuum/candidates/exact-gmail-ids";
import { parseGmailCandidateSourceRef } from "./candidates/source-ref";
import { parseGmailWebHref } from "@/lib/continuum/chief-of-staff/operating-loop/evidence";
import type {
  CosDocketItemView,
  CosWatchingItem,
} from "@/lib/continuum/chief-of-staff/operating-loop/types";
import type { TodayBriefingPacket } from "@/lib/continuum/chief-of-staff/operating-loop/briefing-packet";

export const TODAY_THREAD_FRONTIER_CATEGORIES = [
  "actionable",
  "watching",
  "identity",
  "project_context",
  "historical_superseded",
  "invalid_stale",
  "duplicate_alias",
  "unknown",
] as const;

export type TodayThreadFrontierCategory =
  (typeof TODAY_THREAD_FRONTIER_CATEGORIES)[number];

type RequiredTodayThreadInput = {
  upNext: readonly CosDocketItemView[];
  watching: readonly CosWatchingItem[];
  candidates: readonly ContinuumCandidate[];
  associatedGmailThreadsByProject?: ReadonlyMap<string, readonly string[]>;
  unresolvedIdentityThreadIds?: readonly string[];
  /** Diagnostic-only baseline from the superseded unfinalized identity scan. */
  priorBroadIdentityThreadIds?: readonly string[];
};

export type TodayThreadFrontier = {
  requiredThreadIds: string[];
  priorBroadThreadCount: number;
  counts: Readonly<Record<TodayThreadFrontierCategory, number>>;
};

function threadIdFromRef(value: string | null | undefined): string | null {
  const ref = value?.trim() ?? "";
  if (!ref) return null;
  return (
    parseGmailCandidateSourceRef(ref)?.threadId ??
    parseGmailWebHref(ref)?.threadId ??
    null
  );
}

function addRef(ids: Set<string>, value: string | null | undefined): void {
  const threadId = threadIdFromRef(value);
  if (threadId) ids.add(threadId);
}

function addPacketFrontier(
  ids: Set<string>,
  packet: TodayBriefingPacket | null | undefined,
): boolean {
  if (!packet) return false;
  const controlling = packet.projection?.controllingSourceRefs ?? [];
  if (controlling.length > 0) {
    for (const ref of controlling) addRef(ids, ref);
    return true;
  }
  for (const ref of packet.sourceRefs) addRef(ids, ref);
  for (const event of packet.sourceEvents ?? []) {
    if (event.threadId?.trim()) ids.add(event.threadId.trim());
    addRef(ids, event.sourceRef);
  }
  return false;
}

function addPacketAll(
  ids: Set<string>,
  packet: TodayBriefingPacket | null | undefined,
): void {
  if (!packet) return;
  for (const ref of packet.sourceRefs) addRef(ids, ref);
  for (const event of packet.sourceEvents ?? []) {
    if (event.threadId?.trim()) ids.add(event.threadId.trim());
    addRef(ids, event.sourceRef);
  }
}

function addCandidateThreads(
  ids: Set<string>,
  candidateIds: ReadonlySet<string>,
  candidates: readonly ContinuumCandidate[],
): void {
  for (const candidate of candidates) {
    if (!candidateIds.has(candidate.candidateId)) continue;
    for (const threadId of exactGmailIdsFromCandidate(candidate).threadIds) {
      ids.add(threadId);
    }
  }
}

function directActionableThreads(input: RequiredTodayThreadInput): Set<string> {
  const ids = new Set<string>();
  const candidateIds = new Set<string>();
  for (const item of input.upNext) {
    const packetControls = addPacketFrontier(ids, item.briefingPacket);
    addRef(ids, item.job?.sourceRef);
    addRef(ids, item.decision?.sourceHref);
    for (const candidateId of item.decision?.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
    addRef(ids, item.anomaly?.sourceHref);
    for (const candidateId of item.anomaly?.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
    if (!packetControls && item.brief) {
      if (item.brief.canonicalGmailThreadId?.trim()) {
        ids.add(item.brief.canonicalGmailThreadId.trim());
      }
      if (item.brief.recoveredGmailThreadId?.trim()) {
        ids.add(item.brief.recoveredGmailThreadId.trim());
      }
      for (const ref of item.brief.evidence) addRef(ids, ref.sourceHref);
      for (const action of item.brief.actions) addRef(ids, action.href);
      for (const event of item.brief.sourceEvents ?? []) {
        if (event.threadId?.trim()) ids.add(event.threadId.trim());
        addRef(ids, event.sourceRef);
      }
      for (const candidateId of item.brief.candidateIds) {
        candidateIds.add(candidateId);
      }
    }
  }
  addCandidateThreads(ids, candidateIds, input.candidates);
  return ids;
}

function directWatchingThreads(input: RequiredTodayThreadInput): Set<string> {
  const ids = new Set<string>();
  const candidateIds = new Set<string>();
  for (const item of input.watching) {
    const packetControls = addPacketFrontier(ids, item.briefingPacket);
    if (!packetControls) {
      for (const candidateId of item.candidateIds ?? []) {
        candidateIds.add(candidateId);
      }
    }
  }
  addCandidateThreads(ids, candidateIds, input.candidates);
  return ids;
}

function priorBroadDirectThreads(input: RequiredTodayThreadInput): Set<string> {
  const ids = new Set<string>();
  const candidateIds = new Set<string>();
  for (const item of input.upNext) {
    addPacketAll(ids, item.briefingPacket);
    addRef(ids, item.job?.sourceRef);
    addRef(ids, item.decision?.sourceHref);
    for (const candidateId of item.decision?.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
    addRef(ids, item.anomaly?.sourceHref);
    for (const candidateId of item.anomaly?.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
    if (item.brief) {
      if (item.brief.canonicalGmailThreadId?.trim()) {
        ids.add(item.brief.canonicalGmailThreadId.trim());
      }
      if (item.brief.recoveredGmailThreadId?.trim()) {
        ids.add(item.brief.recoveredGmailThreadId.trim());
      }
      for (const ref of item.brief.evidence) addRef(ids, ref.sourceHref);
      for (const action of item.brief.actions) addRef(ids, action.href);
      for (const event of item.brief.sourceEvents ?? []) {
        if (event.threadId?.trim()) ids.add(event.threadId.trim());
        addRef(ids, event.sourceRef);
      }
      for (const candidateId of item.brief.candidateIds) {
        candidateIds.add(candidateId);
      }
    }
  }
  for (const item of input.watching) {
    addPacketAll(ids, item.briefingPacket);
    for (const candidateId of item.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
  }
  addCandidateThreads(ids, candidateIds, input.candidates);
  return ids;
}

function associatedThreadIds(
  associated: ReadonlyMap<string, readonly string[]> | undefined,
  projectIds: ReadonlySet<string>,
): Set<string> {
  const ids = new Set<string>();
  if (!associated) return ids;
  for (const projectId of projectIds) {
    const threadIds = associated.get(projectId) ?? [];
    for (const threadId of threadIds) {
      const id = threadId.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

function docketProjectIds(input: RequiredTodayThreadInput): Set<string> {
  const ids = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = value?.trim() ?? "";
    if (id) ids.add(id);
  };
  for (const item of input.upNext) {
    add(item.briefingPacket?.projectId);
    add(item.job?.projectId);
    add(item.brief?.projectId);
    add(item.decision?.projectId);
    add(item.anomaly?.projectId);
  }
  for (const item of input.watching) {
    add(item.projectId);
    add(item.briefingPacket?.projectId);
  }
  return ids;
}

function candidateThreads(
  candidates: readonly ContinuumCandidate[],
): Map<string, ContinuumCandidate[]> {
  const rows = new Map<string, ContinuumCandidate[]>();
  for (const candidate of candidates) {
    for (const threadId of exactGmailIdsFromCandidate(candidate).threadIds) {
      const grouped = rows.get(threadId) ?? [];
      grouped.push(candidate);
      rows.set(threadId, grouped);
    }
  }
  return rows;
}

/**
 * Classifies the former broad project closure without exposing mailbox
 * identifiers. Only A/B/C are publishability dependencies; D-H remain useful
 * indexed context and cannot veto a Today snapshot.
 */
export function classifyTodayLiveThreadFrontier(
  input: RequiredTodayThreadInput,
): TodayThreadFrontier {
  const actionable = directActionableThreads(input);
  const watching = directWatchingThreads(input);
  const identity = new Set(
    (input.unresolvedIdentityThreadIds ?? [])
      .map((threadId) => threadId.trim())
      .filter(Boolean),
  );
  const required = new Set([...actionable, ...watching, ...identity]);
  const broad = new Set([
    ...required,
    ...priorBroadDirectThreads(input),
    ...(input.priorBroadIdentityThreadIds ?? [])
      .map((threadId) => threadId.trim())
      .filter(Boolean),
    ...associatedThreadIds(
      input.associatedGmailThreadsByProject,
      docketProjectIds(input),
    ),
  ]);
  const byThread = candidateThreads(input.candidates);
  const counts = Object.fromEntries(
    TODAY_THREAD_FRONTIER_CATEGORIES.map((category) => [category, 0]),
  ) as Record<TodayThreadFrontierCategory, number>;

  for (const threadId of broad) {
    if (identity.has(threadId)) counts.identity += 1;
    else if (actionable.has(threadId)) counts.actionable += 1;
    else if (watching.has(threadId)) counts.watching += 1;
    else {
      const rows = byThread.get(threadId) ?? [];
      if (
        rows.length === 0 ||
        rows.every((row) => row.reviewStatus === "discarded")
      ) {
        counts.invalid_stale += 1;
      } else if (rows.every((row) => row.candidateState === "superseded")) {
        counts.historical_superseded += 1;
      } else {
        const aliasOfRequired = rows.some((row) => {
          const primary =
            parseGmailCandidateSourceRef(row.sourceRef)?.threadId ?? null;
          return primary !== threadId && Boolean(primary && required.has(primary));
        });
        if (aliasOfRequired) counts.duplicate_alias += 1;
        else counts.project_context += 1;
      }
    }
  }

  return {
    requiredThreadIds: [...required].sort(),
    priorBroadThreadCount: broad.size,
    counts,
  };
}

/**
 * Live Gmail is required only for the causal frontier of the current docket.
 * Persisted/indexed evidence remains available for historical project context,
 * but it cannot make an unrelated or superseded thread a publication veto.
 */
export function requiredTodayLiveThreadIds(
  input: RequiredTodayThreadInput,
): string[] {
  const identity = (input.unresolvedIdentityThreadIds ?? [])
    .map((threadId) => threadId.trim())
    .filter(Boolean);
  return [
    ...new Set([
      ...directActionableThreads(input),
      ...directWatchingThreads(input),
      ...identity,
    ]),
  ].sort();
}
