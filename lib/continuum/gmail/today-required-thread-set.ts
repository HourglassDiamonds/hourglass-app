import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { exactGmailIdsFromCandidate } from "@/lib/continuum/candidates/exact-gmail-ids";
import { parseGmailCandidateSourceRef } from "./candidates/source-ref";
import { parseGmailWebHref } from "@/lib/continuum/chief-of-staff/operating-loop/evidence";
import type {
  CosDocketItemView,
  CosWatchingItem,
} from "@/lib/continuum/chief-of-staff/operating-loop/types";

type RequiredTodayThreadInput = {
  upNext: readonly CosDocketItemView[];
  watching: readonly CosWatchingItem[];
  candidates: readonly ContinuumCandidate[];
  associatedGmailThreadsByProject?: ReadonlyMap<string, readonly string[]>;
  unresolvedIdentityThreadIds?: readonly string[];
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

function addProjectThreads(
  ids: Set<string>,
  projectIds: ReadonlySet<string>,
  associated: ReadonlyMap<string, readonly string[]> | undefined,
): void {
  if (!associated) return;
  for (const projectId of projectIds) {
    for (const threadId of associated.get(projectId) ?? []) {
      const id = threadId.trim();
      if (id) ids.add(id);
    }
  }
}

/**
 * Live Gmail is required only for the current docket frontier. Persisted
 * Candidates, indexed messages, and attachment metadata establish that
 * frontier; live reads may refine its currentness and identity, but unrelated
 * historical threads cannot veto publication.
 */
export function requiredTodayLiveThreadIds(
  input: RequiredTodayThreadInput,
): string[] {
  const ids = new Set<string>();
  const projectIds = new Set<string>();
  const candidateIds = new Set<string>();

  const addPacket = (
    packet: CosDocketItemView["briefingPacket"] | CosWatchingItem["briefingPacket"],
  ) => {
    if (!packet) return;
    if (packet.projectId) projectIds.add(packet.projectId);
    for (const ref of packet.sourceRefs) addRef(ids, ref);
    for (const event of packet.sourceEvents ?? []) {
      if (event.threadId?.trim()) ids.add(event.threadId.trim());
      addRef(ids, event.sourceRef);
    }
  };

  for (const item of input.upNext) {
    addPacket(item.briefingPacket);
    if (item.job?.projectId) projectIds.add(item.job.projectId);
    addRef(ids, item.job?.sourceRef);
    if (item.decision?.projectId) projectIds.add(item.decision.projectId);
    addRef(ids, item.decision?.sourceHref);
    for (const candidateId of item.decision?.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
    if (item.anomaly?.projectId) projectIds.add(item.anomaly.projectId);
    addRef(ids, item.anomaly?.sourceHref);
    for (const candidateId of item.anomaly?.candidateIds ?? []) {
      candidateIds.add(candidateId);
    }
    if (item.brief) {
      if (item.brief.projectId) projectIds.add(item.brief.projectId);
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
      for (const candidateId of item.brief.candidateIds) candidateIds.add(candidateId);
    }
  }

  for (const item of input.watching) {
    addPacket(item.briefingPacket);
    if (item.projectId) projectIds.add(item.projectId);
    for (const candidateId of item.candidateIds ?? []) candidateIds.add(candidateId);
  }

  for (const candidate of input.candidates) {
    if (!candidateIds.has(candidate.candidateId)) continue;
    for (const threadId of exactGmailIdsFromCandidate(candidate).threadIds) {
      ids.add(threadId);
    }
  }

  addProjectThreads(ids, projectIds, input.associatedGmailThreadsByProject);
  for (const threadId of input.unresolvedIdentityThreadIds ?? []) {
    const id = threadId.trim();
    if (id) ids.add(id);
  }
  return [...ids].sort();
}
